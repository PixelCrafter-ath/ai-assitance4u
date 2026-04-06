import React, { useContext, useEffect, useState } from 'react';
import { userDataContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

function Snippets() {
  const { serverUrl, userData } = useContext(userDataContext);
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        const response = await fetch(`${serverUrl}/api/user/snippets`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setSnippets(data);
        }
      } catch (error) {
        console.error('Error fetching snippets:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userData) {
      fetchSnippets();
    }
  }, [serverUrl, userData]);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  };

  const handleDownloadCode = (code, filename) => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!userData) {
    navigate('/signin');
    return null;
  }

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-t from-[black] to-[#02023d] flex items-center justify-center">
        <div className="text-white text-xl">Loading snippets...</div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-t from-[black] to-[#02023d] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-white">My Code Snippets</h1>
          <button 
            className="min-w-[100px] h-[40px] text-black font-semibold bg-white rounded-full cursor-pointer text-[16px]"
            onClick={() => navigate('/')}
          >
            Back
          </button>
        </div>

        {snippets.length === 0 ? (
          <div className="text-white text-center py-12">
            <p>You don't have any code snippets yet.</p>
            <p className="text-gray-400 mt-2">Generate some code using Jarvis to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {snippets.map((snippet, index) => (
              <div key={index} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-white font-semibold truncate">{snippet.filename || `Snippet ${index + 1}`}</h3>
                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                    {snippet.language || 'unknown'}
                  </span>
                </div>
                
                <div className="mb-4">
                  <pre className="text-xs text-gray-300 bg-gray-900 p-3 rounded overflow-x-auto max-h-40">
                    {snippet.code.substring(0, 200)}
                    {snippet.code.length > 200 && '...'}
                  </pre>
                </div>
                
                <div className="flex gap-2">
                  <button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg transition-colors"
                    onClick={() => handleCopyCode(snippet.code)}
                  >
                    Copy
                  </button>
                  <button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg transition-colors"
                    onClick={() => handleDownloadCode(snippet.code, snippet.filename || `snippet_${index + 1}.${snippet.language || 'txt'}`)}
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Snippets;