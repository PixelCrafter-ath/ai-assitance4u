import axios from "axios"

// 🧠 Multi-Key Management
const geminiCooldownMap = new Map();
const keyCooldowns = new Map(); // Tracks cooldown for each specific key
const rateLimitPenalty = 30000; // 30 seconds penalty for a specific key
const maxRetries = 3;
const baseDelay = 1000; // 1 second base cooldown between any requests

let currentKeyIndex = 0;

const getApiKey = () => {
  const keys = (process.env.GEMINI_API_KEY || "").split(",").map(k => k.trim()).filter(k => k);
  if (keys.length === 0) return null;

  // Find the first key that isn't on cooldown
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const index = (currentKeyIndex + i) % keys.length;
    const key = keys[index];
    const cooldownUntil = keyCooldowns.get(key) || 0;

    if (now > cooldownUntil) {
      currentKeyIndex = (index + 1) % keys.length;
      return key;
    }
  }

  // If all keys are on cooldown, return the one that expires soonest
  return keys[currentKeyIndex % keys.length];
};

const geminiResponse = async (command, assistantName, userName, history = [], retryCount = 0) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return JSON.stringify({
        type: "general",
        userInput: command,
        response: "AI is not configured. Please add GEMINI_API_KEY to your .env file."
      });
    }

    // Global rate limiting to prevent spamming the same session
    const now = Date.now();
    const lastRequest = geminiCooldownMap.get('global') || 0;
    if (now < lastRequest && retryCount === 0) {
      const waitTime = Math.ceil((lastRequest - now) / 1000);
      return JSON.stringify({
        type: "general",
        userInput: command,
        response: `Slow down! I'll be ready in ${waitTime} second${waitTime > 1 ? 's' : ''}.`
      });
    }
    geminiCooldownMap.set('global', now + baseDelay);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Format history for context
    const historyContext = history.length > 0 
      ? `Recent Conversation:\n${history.map(h => `- ${h}`).join('\n')}\n`
      : '';

    const prompt = `
You are a virtual assistant named ${assistantName} created by ${userName}.

${historyContext}

Respond ONLY in valid JSON.

If the user asks for code, a coding solution, or a programming task (e.g., "write python code", "create a script", "how to loop in java", "solve leetcode two sum"), ALWAYS use "write-code" type.
  If the user asks to open the camera or webcam, use "camera-open".
  If the user asks to take a photo or click a picture, use "take-photo".
  
  IMPORTANT: For "write-code", ensure the code is COMPLETE and RUNNABLE. 
  - If it's a LeetCode problem or algorithm, include a main function/driver code that executes the solution with example cases so it prints output when run.
  - Do not use placeholders like "pass". Write the full implementation.

  If the user wants to add a task, use "add-task" type.
  If the user wants to list tasks, use "list-tasks" type.
  If the user wants to mark a task as done, use "complete-task" type.
  If the user wants to set a reminder, use "set-reminder" type.
  If the user wants to open common apps, use "open-app" type.
  If the user wants to control music, use "music-control" type.
  If the user wants to control system functions, use "system-control" type.
  If the user wants to track expenses, use "expense-tracking" type.
  If the user wants to add a calendar event, use "calendar-event" type.
  If the user wants to send an email, use "send-email" type.
  If the user wants to summarize text, use "summarize-text" type.
  If the user wants to translate text, use "translate-text" type.

  JSON Schema:
  {
    "type": "general" | "google-search" | "youtube-search" | "youtube-play" |
          "get-time" | "get-date" | "get-day" | "get-month" |
          "calculator-open" | "instagram-open" | "facebook-open" | "weather-show" |
          "write-code" | "camera-open" | "file-open" | "take-photo" |
          "add-task" | "list-tasks" | "complete-task" | "set-reminder" | "open-app" |
          "music-control" | "system-control" | "expense-tracking" | "calendar-event" | "send-email" |
          "summarize-text" | "translate-text",
  "userInput": "<clean user input>",
  "response": "<short spoken reply>",
  "code": "<full code solution if type is write-code>",
  "language": "<programming language (e.g. python, javascript, cpp) if type is write-code>",
  "filename": "<suggested filename with extension if type is write-code>",
  "path": "<file path if type is file-open>",
  "taskTitle": "<title of task if type is add-task or set-reminder>",
  "reminderTime": "<ISO date string for reminder if type is set-reminder>",
  "appName": "<name of app to open if type is open-app>",
  "musicAction": "<action for music control: play, pause, next, previous, volume-up, volume-down>",
  "systemAction": "<action for system control: shutdown, restart, lock, hibernate>",
  "expenseAmount": "<amount for expense tracking>",
  "expenseCategory": "<category for expense tracking>",
  "expenseDescription": "<description for expense tracking>",
  "eventTitle": "<title of calendar event>",
  "eventDescription": "<description of calendar event>",
  "eventStartDate": "<ISO date string for calendar event start>",
  "eventEndDate": "<ISO date string for calendar event end>",
  "eventLocation": "<location of calendar event>",
  "emailTo": "<recipient email address>",
  "emailSubject": "<email subject>",
  "emailBody": "<email body>",
  "textToSummarize": "<text to summarize if type is summarize-text>",
  "textToTranslate": "<text to translate if type is translate-text>",
  "targetLanguage": "<target language code if type is translate-text>"
}

User input:
${command}
`;

    const result = await axios.post(apiUrl, {
      contents: [{ parts: [{ text: prompt }] }]
    });

    const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Empty Gemini response");
    }

    return text;

  } catch (error) {
    console.error('Gemini API Error:', error.response?.status, error.response?.data);
    
    // ⚠ RATE LIMIT HANDLING
    if (error.response?.status === 429) {
      const apiKey = getApiKey(); // Get the key that was just used
      if (apiKey) {
        keyCooldowns.set(apiKey, Date.now() + rateLimitPenalty);
        console.log(`Key ${apiKey.substring(0, 8)}... hit rate limit. Switching keys...`);
      }

      if (retryCount < maxRetries) {
        // Retry immediately with a DIFFERENT key
        return await geminiResponse(command, assistantName, userName, history, retryCount + 1);
      }
    }
    
    // Network or other errors
    if (retryCount < maxRetries) {
      console.log(`Network error. Retrying in ${baseDelay/1000} seconds (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      return await geminiResponse(command, assistantName, userName, history, retryCount + 1);
    }

    console.error('Gemini Error Details:', error.message);
    return JSON.stringify({
      type: "error",
      userInput: command,
      response: "AI service temporarily unavailable. Please try again later."
    });
  }
};

export default geminiResponse
