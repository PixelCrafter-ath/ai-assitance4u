import React, { useContext, useEffect, useRef, useState } from 'react';
import { userDataContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CgMenuRight } from "react-icons/cg";
import { RxCross1 } from "react-icons/rx";
import { FaMicrophone, FaMicrophoneSlash, FaUser, FaRobot } from "react-icons/fa";

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext);
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [aiText, setAiText] = useState("");
  const [runOutput, setRunOutput] = useState("");
  const [runError, setRunError] = useState("");
  const [error, setError] = useState(null);
  const [ham, setHam] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [autoListen, setAutoListen] = useState(true);
  const recognitionRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const [voiceLang, setVoiceLang] = useState('en');

  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true });
      setUserData(null);
      navigate("/signin");
    } catch (error) {
      setUserData(null);
      console.error("Logout error:", error);
      setError("Failed to log out. Please try again.");
    }
  };

  const startRecognition = () => {
    if (!isSpeechSupported) {
      setError("Speech recognition is not supported in your browser.");
      return;
    }

    if (listening || isSpeakingRef.current) return;

    try {
      recognitionRef.current?.start();
      setError(null);
    } catch (error) {
      // Ignore "already started" errors
      if (error.name !== 'InvalidStateError') {
        console.error("Start error:", error);
        setError("Failed to start voice recognition.");
      }
    }
  };

  const stopRecognition = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const speak = (text) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const langCode = voiceLang === 'hi' ? 'hi-IN' : 'en-US';
    utterance.lang = langCode;
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find((voice) => voice.lang === langCode);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    isSpeakingRef.current = true;
    utterance.onend = () => {
      isSpeakingRef.current = false;
      setTimeout(() => startRecognition(), 500);
    };
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      setError("Error with speech synthesis.");
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      setError("Speech recognition is not supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = voiceLang === 'hi' ? 'hi-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setListening(false);
      // Only auto-restart if it ended naturally (no-speech) and autoListen is on
      if (!isSpeakingRef.current && autoListen) {
        const timer = setTimeout(() => {
          if (!listening && !isSpeakingRef.current) {
            startRecognition();
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      
      // Filter out non-errors
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return; 
      }

      console.error("Speech Recognition Error:", event.error);
      
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('Microphone access denied. Please allow it in browser settings.');
      } else if (event.error === 'network') {
        setError('Network error. AI voice requires an internet connection.');
      } else if (event.error === 'audio-capture') {
        setError('No microphone found. Please check your hardware.');
      } else {
        setError(`Voice Error: ${event.error}. Refresh the page.`);
      }
    };

    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      
      if (!transcript) return;

      try {
        const data = await getGeminiResponse(transcript);
        if (data?.response) {
          setAiText(data.response);
          setRunOutput(data.runOutput || "");
          setRunError(data.runError || "");
          
          // Update local history for instant UI feedback
          setUserData(prev => ({
            ...prev,
            history: [...(prev.history || []), `User: ${transcript}`, `Jarvis: ${data.response}`].slice(-50)
          }));

          speak(data.response);

          if (data.type === 'youtube-play' && data.url) {
            window.location.href = data.url;
          }
        } else {
          setAiText("I didn't understand that. Please try again.");
          setRunOutput("");
          setRunError("");
        }
      } catch (err) {
        console.error("Error processing command:", err);
        setError("Error processing your request. Please try again.");
      }
    };

    recognitionRef.current = recognition;
    startRecognition();

    return () => {
      recognition.stop();
    };
  }, [voiceLang, autoListen]);

  return (
    <div className='w-full min-h-screen bg-gradient-to-t from-[black] to-[#02023d] flex flex-col items-center py-8 px-4 overflow-auto'>
      {/* Header */}
      <header className='w-full max-w-4xl flex justify-between items-center mb-8 px-4'>
        <h1 className='text-2xl font-bold text-white'>{userData?.assistantName || 'AI Assistant'}</h1>
        <div className='flex items-center gap-4'>
          <div className={`text-sm ${listening ? 'text-green-300' : 'text-white'} opacity-90`}>
            {listening ? 'Listening...' : 'Voice Mode'}
          </div>

          <button
            onClick={() => setVoiceLang(prev => prev === 'en' ? 'hi' : 'en')}
            className='px-3 py-1 rounded-full text-xs font-semibold bg-gray-800 text-white border border-gray-600'
            title="Change Language"
          >
            {voiceLang === 'en' ? 'EN' : 'HI'}
          </button>

          <button
            onClick={() => setAutoListen(!autoListen)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${autoListen ? 'bg-green-600 border-green-400' : 'bg-gray-800 border-gray-600'} text-white`}
            title={autoListen ? "Auto-Listen On" : "Auto-Listen Off"}
          >
            {autoListen ? 'AUTO' : 'MANUAL'}
          </button>

          <CgMenuRight 
            className='text-white w-8 h-8 cursor-pointer lg:hidden' 
            onClick={() => setHam(!ham)}
          />
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className='w-full max-w-2xl bg-red-500 bg-opacity-20 border-l-4 border-red-500 text-white p-4 mb-6 rounded-r'>
          <p>{error}</p>
        </div>
      )}

      {/* Main Content */}
      <main className='flex-1 w-full max-w-2xl flex flex-col items-center justify-center'>
        {/* AI Response */}
        <div className='w-full min-h-[200px] flex flex-col items-center justify-center mb-8'>
          {aiText ? (
            <div className='w-full bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-6 text-white animate-fade-in'>
              <p className='whitespace-pre-line'>{aiText}</p>
              {runOutput && (
                <div className='mt-4 bg-black bg-opacity-40 rounded-xl p-3 text-sm font-mono whitespace-pre-wrap'>
                  <div className='font-semibold mb-1'>Program output:</div>
                  <pre className='whitespace-pre-wrap break-words'>{runOutput}</pre>
                </div>
              )}
              {runError && (
                <div className='mt-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-xl p-3 text-sm whitespace-pre-wrap'>
                  <div className='font-semibold mb-1'>Runtime error:</div>
                  <pre className='whitespace-pre-wrap break-words'>{runError}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className='text-white text-opacity-50 text-center'>
              <p>How can I help you today?</p>
              <p className='text-sm mt-2'>Tap the microphone to speak</p>
            </div>
          )}
        </div>

        {/* Voice Control */}
        <div className='fixed bottom-8 left-1/2 transform -translate-x-1/2'>
          <button
            onClick={listening ? stopRecognition : startRecognition}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all transform hover:scale-105 ${
              listening
                ? 'bg-red-500 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
            disabled={!isSpeechSupported}
            title={listening ? 'Stop Listening' : 'Start Listening'}
          >
            {listening ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
        </div>
      </main>

      {/* Mobile Menu */}
      {ham && (
        <div className='fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-start p-6 pt-20 overflow-y-auto'>
          <button 
            onClick={() => setHam(false)}
            className='fixed top-6 right-6 text-white text-2xl bg-gray-800 rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-700 transition-colors'
            aria-label='Close menu'
          >
            <RxCross1 />
          </button>
          
          <div className='w-full max-w-md bg-gray-900 rounded-xl p-6 space-y-6'>
            <div className='flex flex-col items-center'>
              <div className='w-24 h-24 rounded-full bg-gray-700 mb-4 overflow-hidden'>
                {userData?.assistantImage ? (
                  <img 
                    src={userData.assistantImage} 
                    alt="Assistant" 
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <div className='w-full h-full flex items-center justify-center bg-blue-600 text-white text-2xl'>
                    {userData?.assistantName?.[0] || 'A'}
                  </div>
                )}
              </div>
              <h2 className='text-xl font-bold text-white'>{userData?.assistantName || 'My Assistant'}</h2>
              <p className='text-gray-400 text-sm'>{userData?.email || 'User'}</p>
            </div>
            
            <div className='space-y-4'>
              <button 
                onClick={handleLogOut}
                className='w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2'
              >
                <span>Logout</span>
              </button>
                      
              <button 
                onClick={() => {
                  navigate("/customize");
                  setHam(false);
                }}
                className='w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2'
              >
                <span>Customize Assistant</span>
              </button>
            
              <button 
                onClick={() => {
                  navigate("/snippets");
                  setHam(false);
                }}
                className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2'
              >
                <span>My Code Snippets</span>
              </button>
            </div>
            
            <div className='pt-4 border-t border-gray-800'>
              <h3 className='text-white font-medium mb-3'>History</h3>
              <div className='space-y-2 max-h-48 overflow-y-auto'>
                {userData?.history?.length > 0 ? (
                  userData.history.map((item, index) => (
                    <div 
                      key={`history-${index}`}
                      className='text-gray-300 text-sm p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors cursor-pointer'
                      onClick={() => {
                        setHam(false);
                      }}
                    >
                      {item.length > 50 ? `${item.substring(0, 50)}...` : item}
                    </div>
                  ))
                ) : (
                  <p className='text-gray-500 text-sm text-center py-4'>No history yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={`absolute lg:hidden top-0 w-full h-full bg-[#00000053] backdrop-blur-lg p-[20px] flex flex-col gap-[20px] items-start ${ham?"translate-x-0":"translate-x-full"} transition-transform`}>
        <RxCross1 className=' text-white absolute top-[20px] right-[20px] w-[25px] h-[25px]' onClick={()=>setHam(false)}/>
        <button className='min-w-[150px] h-[60px]  text-black font-semibold   bg-white rounded-full cursor-pointer text-[19px] ' onClick={handleLogOut}>Log Out</button>
        <button className='min-w-[150px] h-[60px]  text-black font-semibold  bg-white  rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] ' onClick={()=>navigate("/customize")}>Customize your Assistant</button>

        {/* Rest of the code remains the same */}
<h1 className='text-white font-semibold text-[19px]'>History</h1>

<div className='w-full h-[400px] gap-[20px] overflow-y-auto flex flex-col truncate'>
  {userData.history?.map((his, index) => (
    <div key={`history-${index}`} className='text-gray-200 text-[18px] w-full h-[30px] truncate'>
      {his}
    </div>
  ))}

</div>

      </div>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold absolute hidden lg:block top-[20px] right-[20px]  bg-white rounded-full cursor-pointer text-[19px] ' onClick={handleLogOut}>Log Out</button>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold  bg-white absolute top-[100px] right-[20px] rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] hidden lg:block ' onClick={() => navigate("/customize")}>Customize your Assistant</button>
      <button className='min-w-[150px] h-[60px] mt-[30px] text-black font-semibold  bg-white absolute top-[180px] right-[20px] rounded-full cursor-pointer text-[19px] px-[20px] py-[10px] hidden lg:block ' onClick={() => navigate("/snippets")}>My Code Snippets</button>
    </div>
  )
}

export default Home