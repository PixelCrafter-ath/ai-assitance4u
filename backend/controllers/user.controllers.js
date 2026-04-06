import uploadOnCloudinary from "../config/cloudinary.js";
import geminiResponse from "../gemini.js";
import User from "../models/user.model.js";
import Task from "../models/Task.js";
import moment from "moment"
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import NodeWebcam from 'node-webcam';
import axios from 'axios';

// Import logic from other controllers for direct use
import { addExpense, addCalendarEvent, sendEmail, summarizeText, translateText, systemControl, musicControl } from './advanced.controllers.js';

// 🧠 Gemini debounce memory
const geminiCooldownMap = new Map()

// System command execution helper
const executeCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password")
    if (!user) {
      return res.status(400).json({ message: "user not found" })
    }
    return res.status(200).json(user)
  } catch {
    return res.status(400).json({ message: "get current user error" })
  }
}

export const updateAssistant = async (req, res) => {
  try {
    const { assistantName, imageUrl } = req.body
    let assistantImage

    if (req.file) {
      assistantImage = await uploadOnCloudinary(req.file.path)
    } else {
      assistantImage = imageUrl
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { assistantName, assistantImage },
      { new: true }
    ).select("-password")

    return res.status(200).json(user)
  } catch {
    return res.status(400).json({ message: "updateAssistant error" })
  }
}

export const askToAssistant = async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.json({ 
        type: "error",
        response: "Please provide a command" 
      });
    }

    const text = command.toLowerCase();

    // 🔥 LOCAL COMMANDS (NO GEMINI)
    if (/^(hi|hello|hey)\b/.test(text)) {
      return res.json({
        type: "general",
        userInput: command,
        response: "Yes, I am listening"
      });
    }

    // Handle Camera (Local)
    if (/(?:open|start|launch)\s+(?:web\s*)?(?:cam|camera)/i.test(text)) {
      try {
        if (process.platform === 'win32') {
          executeCommand('start microsoft.windows.camera:').catch(console.error);
        } else if (process.platform === 'darwin') {
          executeCommand('open /System/Applications/Photo\\ Booth.app').catch(console.error);
        }
        return res.json({
          type: "camera-open",
          userInput: command,
          response: "Opening the camera"
        });
      } catch (error) {
        return res.json({
          type: "error",
          userInput: command,
          response: "I couldn't open the camera."
        });
      }
    }

    // Handle Local File (Local)
    const fileCommand = text.match(/(?:open|start|launch)\s+(?:file|folder)\s+(.+)/i);
    if (fileCommand) {
      const filePath = fileCommand[1].trim();
      try {
        if (process.platform === 'win32') {
          executeCommand(`start "" "${filePath}"`).catch(console.error);
        } else if (process.platform === 'darwin') {
          executeCommand(`open "${filePath}"`).catch(console.error);
        }
        return res.json({
          type: "file-open",
          userInput: command,
          response: `Opening file ${filePath}`
        });
      } catch (error) {
        return res.json({
          type: "error",
          userInput: command,
          response: `I couldn't open the file ${filePath}.`
        });
      }
    }

    // Handle Chrome commands
    const chromeCommand = text.match(/(?:open|start|launch|go to)\s+(?:chrome\s+)?(?:to\s+)?(?:the\s+)?(?:website\s+)?(.*?)(?:\s+on chrome)?$/i);
    const youtubePlayCommand = text.match(/(?:play)\s+(?:"([^"]+)"|(.*?))\s*(?:on\s+youtube|in\s+youtube|youtube)?$/i);
    const youtubeSearchCommand = text.match(/(?:search|find)\s+(?:"([^"]+)"|(.*?))\s*(?:on\s+youtube|in\s+youtube|youtube)\b/i);

    if (chromeCommand && chromeCommand[1]) {
      let url = chromeCommand[1].trim();
      
      // Add https:// if not present
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // Check if it's a common website that can be opened without www
        const commonSites = ['youtube', 'facebook', 'twitter', 'instagram', 'github', 'reddit', 'linkedin'];
        const hasExtension = url.includes('.');
        
        if (!hasExtension && commonSites.some(site => url.toLowerCase().startsWith(site))) {
          url = `https://www.${url}.com`;
        } else if (!hasExtension) {
          url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        } else {
          url = `https://${url}`;
        }
      }

      try {
        if (process.platform === 'win32') {
          executeCommand(`start chrome "${url}"`).catch(console.error);
          return res.json({
            type: "general",
            userInput: command,
            response: `Opening ${url} in Chrome`
          });
        } else if (process.platform === 'darwin') {
          executeCommand(`open -a "Google Chrome" "${url}"`).catch(console.error);
          return res.json({
            type: "general",
            userInput: command,
            response: `Opening ${url} in Chrome`
          });
        }
      } catch (error) {
        console.error('Error opening Chrome:', error);
        return res.json({
          type: "general",
          userInput: command,
          response: "I couldn't open Chrome. Please make sure it's installed."
        });
      }
    }
    // Handle YouTube specific commands
    else if (youtubePlayCommand || youtubeSearchCommand) {
      const match = youtubePlayCommand || youtubeSearchCommand;
      const searchQuery = (match[1] || match[2] || '').trim();
      let youtubeUrl = 'https://www.youtube.com';
      
      if (searchQuery) {
        if (searchQuery.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/i)) {
          // If it's already a YouTube URL
          youtubeUrl = searchQuery.startsWith('http') ? searchQuery : `https://${searchQuery}`;
        } else if (searchQuery.match(/^[a-zA-Z0-9_-]{11}$/)) {
          // If it's a YouTube video ID
          youtubeUrl = `https://www.youtube.com/watch?v=${searchQuery}`;
        } else {
          // Search YouTube
          youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        }
      }

      if (/youtube\.com\/watch\?/.test(youtubeUrl) || /youtu\.be\//.test(youtubeUrl)) {
        const separator = youtubeUrl.includes("?") ? "&" : "?";
        youtubeUrl = `${youtubeUrl}${separator}autoplay=1`;
      }

      return res.json({
        type: "youtube-play",
        userInput: command,
        response: searchQuery ? `Playing ${searchQuery} on YouTube` : "Opening YouTube",
        url: youtubeUrl
      });
    }

    if (/time/.test(text)) {
      return res.json({
        type: "get-time",
        userInput: command,
        response: `Current time is ${moment().format("hh:mm A")}`
      })
    }

    if (/date/.test(text)) {
      return res.json({
        type: "get-date",
        userInput: command,
        response: `Today's date is ${moment().format("YYYY-MM-DD")}`
      })
    }

    // Handle weather queries
    const weatherMatch = text.match(/(?:what'?s?|what is|tell me|show me)?\s*(?:the)?\s*(?:weather|temperature|forecast)(?:\s*(?:in|for|at|of))?\s*([^?]*)/i);
    if (weatherMatch) {
      const location = (weatherMatch[1] || "").trim();
      const openWeatherKey = process.env.OPENWEATHER_API_KEY || process.env.VITE_OPENWEATHER_API_KEY;
      if (!openWeatherKey) {
        return res.json({
          type: "weather",
          userInput: command,
          response: "Weather is not configured yet. Please add OPENWEATHER_API_KEY."
        });
      }
      if (!location) {
        return res.json({
          type: "weather",
          userInput: command,
          response: "Please tell me the city name for the weather (e.g., 'weather in Mumbai')."
        });
      }
      
      try {
        // First, get coordinates for the location
        const geoResponse = await axios.get(
          `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${openWeatherKey}`
        );
        
        if (!geoResponse.data || geoResponse.data.length === 0) {
          return res.json({
            type: "weather",
            userInput: command,
            response: `I couldn't find weather information for ${location}. Please try another location.`
          });
        }
        
        const { lat, lon, name, country } = geoResponse.data[0];
        
        // Then get weather data
        const weatherResponse = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherKey}&units=metric`
        );
        
        const { weather, main, wind } = weatherResponse.data;
        const weatherDescription = weather[0].description;
        const temperature = Math.round(main.temp);
        const feelsLike = Math.round(main.feels_like);
        const humidity = main.humidity;
        const windSpeed = Math.round(wind.speed * 3.6); // Convert m/s to km/h
        
        const weatherMessage = `The weather in ${name}, ${country} is ${weatherDescription}. ` +
          `Temperature: ${temperature}°C (feels like ${feelsLike}°C), ` +
          `Humidity: ${humidity}%, Wind: ${windSpeed} km/h`;
        
        return res.json({
          type: "weather",
          userInput: command,
          response: weatherMessage,
          weatherData: {
            location: `${name}, ${country}`,
            description: weatherDescription,
            temperature,
            feelsLike,
            humidity,
            windSpeed
          }
        });
        
      } catch (error) {
        console.error('Weather API error:', error);
        return res.json({
          type: "weather",
          userInput: command,
          response: "I'm having trouble getting the weather information right now. Please try again later."
        });
      }
    }

    // ⏳ GEMINI CALL (ONLY IF NEEDED)
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.json({
          type: "error",
          response: "User not found. Please log in again."
        });
      }

      // Get last 5 history items for context
      const historyContext = user.history ? user.history.slice(-10) : [];

      const result = await geminiResponse(
        command,
        user.assistantName || "Jarvis",
        user.name,
        historyContext
      );

      if (!result) {
        throw new Error('No response from Gemini API');
      }

      const jsonMatch = result.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        return res.json({
          type: "general",
          userInput: command,
          response: "I didn't understand that. Could you please rephrase?"
        });
      }

      try {
        console.log("Gemini Raw Result:", result); // Debug log
        const parsedResponse = JSON.parse(jsonMatch[0]);
        console.log("Parsed Response Type:", parsedResponse.type); // Debug log

        // Handle add-task type
        if (parsedResponse.type === 'add-task' && parsedResponse.taskTitle) {
          const task = new Task({
            title: parsedResponse.taskTitle,
            userId: user._id,
            completed: false
          });
          await task.save();
          parsedResponse.response = `${parsedResponse.response}. I've added the task "${parsedResponse.taskTitle}" to your to-do list.`;
        }

        // Handle list-tasks type
        if (parsedResponse.type === 'list-tasks') {
          const tasks = await Task.find({ userId: user._id }).sort({ createdAt: -1 });
          if (tasks.length === 0) {
            parsedResponse.response = `${parsedResponse.response}. You don't have any tasks in your to-do list.`;
          } else {
            const taskList = tasks.map(t => `- ${t.title} (${t.completed ? 'Done' : 'Pending'})`).join('\n');
            parsedResponse.response = `${parsedResponse.response}. Here are your tasks:\n${taskList}`;
            parsedResponse.tasks = tasks;
          }
        }

        // Handle complete-task type
        if (parsedResponse.type === 'complete-task' && parsedResponse.taskTitle) {
          const task = await Task.findOne({ userId: user._id, title: parsedResponse.taskTitle });
          if (task) {
            task.completed = true;
            await task.save();
            parsedResponse.response = `${parsedResponse.response}. I've marked the task "${parsedResponse.taskTitle}" as completed.`;
          } else {
            parsedResponse.response = `${parsedResponse.response}. I couldn't find the task "${parsedResponse.taskTitle}" in your list.`;
          }
        }

        // Handle set-reminder type
        if (parsedResponse.type === 'set-reminder' && parsedResponse.taskTitle && parsedResponse.reminderTime) {
          const reminderTime = new Date(parsedResponse.reminderTime);
          if (isNaN(reminderTime.getTime())) {
            parsedResponse.response = `${parsedResponse.response}. I couldn't parse the time for your reminder.`;
          } else {
            const task = new Task({
              title: parsedResponse.taskTitle,
              userId: user._id,
              completed: false,
              reminderTime: reminderTime
            });
            await task.save();
            parsedResponse.response = `${parsedResponse.response}. I've set a reminder for "${parsedResponse.taskTitle}" at ${reminderTime.toLocaleString()}.`;
          }
        }

        // Handle open-app type
        if (parsedResponse.type === 'open-app' && parsedResponse.appName) {
          const appName = parsedResponse.appName.toLowerCase();
          let appPath = '';
          
          // Define safe app mappings
          const appPaths = {
            'vs code': 'code',
            'visual studio code': 'code',
            'code': 'code',
            'spotify': 'spotify',
            'notepad': 'notepad',
            'paint': 'mspaint',
            'calculator': 'calc',
            'cmd': 'cmd',
            'command prompt': 'cmd',
            'powershell': 'powershell',
            'chrome': 'start chrome',
            'firefox': 'start firefox',
            'vlc': 'vlc',
            'word': 'start winword',
            'excel': 'start excel',
            'powerpoint': 'start powerpnt',
            'discord': 'discord',
            'telegram': 'telegram'
          };
          
          if (appPaths[appName]) {
            appPath = appPaths[appName];
          } else {
            // Try to match partial names
            for (const [key, path] of Object.entries(appPaths)) {
              if (key.includes(appName) || appName.includes(key)) {
                appPath = path;
                break;
              }
            }
          }
          
          if (appPath) {
            if (process.platform === 'win32') {
              executeCommand(`${appPath}`).catch(err => {
                console.error('Failed to open app:', err);
              });
              parsedResponse.response = `${parsedResponse.response}. I've opened ${parsedResponse.appName}.`;
            } else {
              parsedResponse.response = `${parsedResponse.response}. Sorry, I can only open apps on Windows.`;
            }
          } else {
            parsedResponse.response = `${parsedResponse.response}. I don't know how to open ${parsedResponse.appName}.`;
          }
        }

        // Helper to mock req/res for direct controller calls
        const mockRes = {
          status: () => mockRes,
          json: (data) => data
        };

        // Handle music-control type
        if (parsedResponse.type === 'music-control' && parsedResponse.musicAction) {
          try {
            const musicData = await musicControl({ body: { action: parsedResponse.musicAction }, userId: user._id }, mockRes);
            parsedResponse.response = `${parsedResponse.response}. ${musicData.message || `Music ${parsedResponse.musicAction} command executed.`}`;
          } catch (error) {
            console.error('Music control error:', error);
            parsedResponse.response = `${parsedResponse.response}. Sorry, I couldn't control the music player.`;
          }
        }

        // Handle system-control type
        if (parsedResponse.type === 'system-control' && parsedResponse.systemAction) {
          try {
            const systemData = await systemControl({ body: { action: parsedResponse.systemAction }, userId: user._id }, mockRes);
            parsedResponse.response = `${parsedResponse.response}. ${systemData.message || `System ${parsedResponse.systemAction} command executed.`}`;
          } catch (error) {
            console.error('System control error:', error);
            parsedResponse.response = `${parsedResponse.response}. Sorry, I couldn't execute the system command.`;
          }
        }

        // Handle expense-tracking type
        if (parsedResponse.type === 'expense-tracking' && parsedResponse.expenseAmount && parsedResponse.expenseCategory && parsedResponse.expenseDescription) {
          try {
            await addExpense({ 
              body: { 
                amount: parsedResponse.expenseAmount, 
                category: parsedResponse.expenseCategory, 
                description: parsedResponse.expenseDescription 
              }, 
              userId: user._id 
            }, mockRes);
            parsedResponse.response = `${parsedResponse.response}. I've logged your expense: ${parsedResponse.expenseDescription} for $${parsedResponse.expenseAmount} in ${parsedResponse.expenseCategory}.`;
          } catch (error) {
            console.error('Expense tracking error:', error);
            parsedResponse.response = `${parsedResponse.response}. Sorry, I couldn't log your expense.`;
          }
        }

        // Handle calendar-event type
        if (parsedResponse.type === 'calendar-event' && parsedResponse.eventTitle && parsedResponse.eventStartDate) {
          try {
            await addCalendarEvent({ 
              body: { 
                title: parsedResponse.eventTitle,
                description: parsedResponse.eventDescription,
                startDate: parsedResponse.eventStartDate,
                endDate: parsedResponse.eventEndDate,
                location: parsedResponse.eventLocation
              }, 
              userId: user._id 
            }, mockRes);
            parsedResponse.response = `${parsedResponse.response}. I've added the event "${parsedResponse.eventTitle}" to your calendar for ${new Date(parsedResponse.eventStartDate).toLocaleString()}.`;
          } catch (error) {
            console.error('Calendar event error:', error);
            parsedResponse.response = `${parsedResponse.response}. Sorry, I couldn't add the event to your calendar.`;
          }
        }

        // Handle send-email type
        if (parsedResponse.type === 'send-email' && parsedResponse.emailTo && parsedResponse.emailBody) {
          try {
            await sendEmail({ 
              body: { 
                to: parsedResponse.emailTo,
                subject: parsedResponse.emailSubject || 'No Subject',
                body: parsedResponse.emailBody
              }, 
              userId: user._id 
            }, mockRes);
            parsedResponse.response = `${parsedResponse.response}. I've sent an email to ${parsedResponse.emailTo}.`;
          } catch (error) {
            console.error('Email sending error:', error);
            parsedResponse.response = `${parsedResponse.response}. Sorry, I couldn't send the email.`;
          }
        }

        // Handle summarize-text type
        if (parsedResponse.type === 'summarize-text' && parsedResponse.textToSummarize) {
          try {
            const summaryData = await summarizeText({ body: { text: parsedResponse.textToSummarize }, userId: user._id }, mockRes);
            parsedResponse.response = `${parsedResponse.response}. Summary: ${summaryData.summary}`;
          } catch (error) {
            console.error('Text summarization error:', error);
            parsedResponse.response = `${parsedResponse.response}. Sorry, I couldn't summarize the text.`;
          }
        }

        // Handle translate-text type
        if (parsedResponse.type === 'translate-text' && parsedResponse.textToTranslate && parsedResponse.targetLanguage) {
          try {
            const translateData = await translateText({ 
              body: { 
                text: parsedResponse.textToTranslate,
                targetLang: parsedResponse.targetLanguage
              }, 
              userId: user._id 
            }, mockRes);
            parsedResponse.response = `${parsedResponse.response}. Translation: ${translateData.translatedText}`;
          } catch (error) {
            console.error('Text translation error:', error);
            parsedResponse.response = `${parsedResponse.response}. Sorry, I couldn't translate the text.`;
          }
        }

        // Handle write-code type
        if (parsedResponse.type === 'write-code' && parsedResponse.code) {
          const codeDir = path.join(process.cwd(), 'generated_code');
          if (!fs.existsSync(codeDir)) {
            fs.mkdirSync(codeDir, { recursive: true });
          }
          
          const filename = parsedResponse.filename || `code_${Date.now()}.${parsedResponse.language === 'python' ? 'py' : parsedResponse.language === 'javascript' ? 'js' : 'txt'}`;
          const filePath = path.join(codeDir, filename);
          
          fs.writeFileSync(filePath, parsedResponse.code);
          
          // Open the file in VS Code
          executeCommand(`code "${filePath}"`).catch(err => {
            console.error('Failed to open VS Code:', err);
          });
          
          // Auto-run logic (capture output to show inside app)
          let runCommand = '';
          if (parsedResponse.language === 'python' || filename.endsWith('.py')) {
             runCommand = `python "${filePath}"`;
          } else if (parsedResponse.language === 'javascript' || filename.endsWith('.js')) {
             runCommand = `node "${filePath}"`;
          } else if (parsedResponse.language === 'cpp' || parsedResponse.language === 'c++' || filename.endsWith('.cpp')) {
             const exePath = filePath.replace('.cpp', '.exe');
             runCommand = `g++ "${filePath}" -o "${exePath}" && "${exePath}"`;
          } else if (parsedResponse.language === 'java' || filename.endsWith('.java')) {
             runCommand = `java "${filePath}"`; // Single-file source-code programs (Java 11+)
          }

          if (runCommand) {
             console.log("Attempting to run command:", runCommand);
             try {
               const { stdout, stderr } = await executeCommand(runCommand);
               parsedResponse.runOutput = stdout;
               if (stderr) {
                 parsedResponse.runError = stderr;
               }
               parsedResponse.response = `${parsedResponse.response}. I ran the code and captured the output for you.`;
             } catch (err) {
               console.error('Failed to auto-run code:', err);
               parsedResponse.runError = err.message;
               parsedResponse.response = `${parsedResponse.response}. I generated the code, but there was an error while running it.`;
             }
          } else {
             parsedResponse.response = `${parsedResponse.response}. I have opened the code in VS Code.`;
          }

          // Save snippet to user profile
          try {
            user.snippets = user.snippets || [];
            user.snippets.push({
              language: parsedResponse.language || 'unknown',
              filename,
              code: parsedResponse.code,
              createdAt: new Date()
            });
            await user.save();
          } catch (saveError) {
            console.error('Failed to save snippet:', saveError);
          }
          
        }

        // Handle camera-open type (Gemini fallback)
        if (parsedResponse.type === 'camera-open') {
          if (process.platform === 'win32') {
            executeCommand('start microsoft.windows.camera:').catch(console.error);
          } else if (process.platform === 'darwin') {
            executeCommand('open /System/Applications/Photo\\ Booth.app').catch(console.error);
          }
        }

        // Handle take-photo type
        if (parsedResponse.type === 'take-photo') {
           const opts = {
             width: 1280,
             height: 720,
             quality: 100,
             delay: 0,
             saveShots: true,
             output: "jpeg",
             device: false,
             callbackReturn: "location",
             verbose: false
           };

           const Webcam = NodeWebcam.create(opts);
           const photosDir = path.join(process.cwd(), 'captured_photos');
           
           if (!fs.existsSync(photosDir)) {
             fs.mkdirSync(photosDir, { recursive: true });
           }

           const filename = `photo_${Date.now()}`;
           const filePath = path.join(photosDir, filename);

           Webcam.capture(filePath, (err, data) => {
             if (err) {
               console.error("Error capturing photo:", err);
             } else {
               console.log("Photo captured:", data);
               // Open the photo
               if (process.platform === 'win32') {
                 executeCommand(`start "" "${data}"`).catch(console.error);
               } else {
                 executeCommand(`open "${data}"`).catch(console.error);
               }
             }
           });
        }

        // Handle file-open type (Gemini fallback)
        if (parsedResponse.type === 'file-open' && parsedResponse.path) {
          if (process.platform === 'win32') {
            executeCommand(`start "" "${parsedResponse.path}"`).catch(console.error);
          } else if (process.platform === 'darwin') {
            executeCommand(`open "${parsedResponse.path}"`).catch(console.error);
          }
        }

        // Save to history
        user.history = user.history || [];
        user.history.push(`User: ${command}`);
        user.history.push(`${user.assistantName || 'Jarvis'}: ${parsedResponse.response}`);
        
        // Keep history manageable
        if (user.history.length > 50) {
          user.history = user.history.slice(-50);
        }
        await user.save();

        return res.json({
          ...parsedResponse,
          userInput: command
        });
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
        return res.json({
          type: "general",
          userInput: command,
          response: `I received an unexpected response: ${result.substring(0, 100)}...`
        });
      }
    } catch (error) {
      console.error('Error in askToAssistant:', error);
      return res.json({
        type: "error",
        userInput: command,
        response: `I'm having trouble processing your request: ${error.message}`
      });
    }
  } catch (error) {
    console.error('Unexpected error in askToAssistant:', error);
    return res.status(500).json({
      type: "error",
      response: "An unexpected error occurred. Please try again later."
    });
  }
}

export const getSnippets = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("snippets");
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }
    return res.status(200).json(user.snippets || []);
  } catch (error) {
    console.error("getSnippets error:", error);
    return res.status(500).json({ message: "getSnippets error" });
  }
};
