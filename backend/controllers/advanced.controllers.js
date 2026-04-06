import Expense from "../models/Expense.js";
import CalendarEvent from "../models/CalendarEvent.js";
import User from "../models/user.model.js";
import { exec } from 'child_process';
import axios from 'axios';
import geminiResponse from "../gemini.js";

// System controls
export const systemControl = async (req, res) => {
  try {
    const { action } = req.body;
    const userId = req.userId;

    if (!action) {
      return res.status(400).json({ message: "Action is required" });
    }

    let command = '';
    if (process.platform === 'win32') {
      switch(action) {
        case 'shutdown':
          command = 'shutdown /s /t 1';
          break;
        case 'restart':
          command = 'shutdown /r /t 1';
          break;
        case 'lock':
          command = 'rundll32.exe user32.dll,LockWorkStation';
          break;
        case 'hibernate':
          command = 'shutdown /h';
          break;
        case 'sleep':
          command = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
          break;
        case 'volume-up':
          command = 'nircmd.exe changesysvolume +5000'; // Requires NirCmd utility
          break;
        case 'volume-down':
          command = 'nircmd.exe changesysvolume -5000'; // Requires NirCmd utility
          break;
        case 'mute':
          command = 'nircmd.exe mutesysvolume 1'; // Requires NirCmd utility
          break;
        case 'unmute':
          command = 'nircmd.exe mutesysvolume 0'; // Requires NirCmd utility
          break;
        default:
          return res.status(400).json({ message: "Invalid system action" });
      }
    } else {
      // For macOS/Linux
      switch(action) {
        case 'shutdown':
          command = 'sudo shutdown -h now';
          break;
        case 'restart':
          command = 'sudo reboot';
          break;
        case 'lock':
          command = 'gnome-screensaver-command -l'; // For GNOME
          break;
        default:
          return res.status(400).json({ message: "Invalid system action" });
      }
    }

    if (command) {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing command: ${error}`);
          return res.status(500).json({ message: "System command failed", error: error.message });
        }
        res.status(200).json({ message: `System ${action} command executed` });
      });
    } else {
      res.status(200).json({ message: `System ${action} command not supported on this platform` });
    }
  } catch (error) {
    console.error("systemControl error:", error);
    return res.status(500).json({ message: "systemControl error" });
  }
};

// Music control
export const musicControl = async (req, res) => {
  try {
    const { action } = req.body;
    const userId = req.userId;

    if (!action) {
      return res.status(400).json({ message: "Action is required" });
    }

    let command = '';
    if (process.platform === 'win32') {
      switch(action) {
        case 'play':
        case 'pause':
          // Attempt using PowerShell (Built-in) first
          command = 'powershell -command "(Add-Type \'[DllImport(\\\"user32.dll\\\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);\' -Name Keybd -PassThru)::keybd_event(0xB3, 0, 0, 0)"';
          break;
        case 'next':
          command = 'powershell -command "(Add-Type \'[DllImport(\\\"user32.dll\\\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);\' -Name Keybd -PassThru)::keybd_event(0xB0, 0, 0, 0)"';
          break;
        case 'previous':
          command = 'powershell -command "(Add-Type \'[DllImport(\\\"user32.dll\\\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);\' -Name Keybd -PassThru)::keybd_event(0xB1, 0, 0, 0)"';
          break;
        case 'volume-up':
          command = 'powershell -command "(Add-Type \'[DllImport(\\\"user32.dll\\\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);\' -Name Keybd -PassThru)::keybd_event(0xAF, 0, 0, 0)"';
          break;
        case 'volume-down':
          command = 'powershell -command "(Add-Type \'[DllImport(\\\"user32.dll\\\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);\' -Name Keybd -PassThru)::keybd_event(0xAE, 0, 0, 0)"';
          break;
        default:
          return res.status(400).json({ message: "Invalid music action" });
      }
    } else {
      // For macOS/Linux
      switch(action) {
        case 'play':
        case 'pause':
          command = 'osascript -e "tell application \\"Music\\" to playpause"'; // For Apple Music
          break;
        case 'next':
          command = 'osascript -e "tell application \\"Music\\" to next track"';
          break;
        case 'previous':
          command = 'osascript -e "tell application \\"Music\\" to previous track"';
          break;
        default:
          return res.status(400).json({ message: "Invalid music action" });
      }
    }

    if (command) {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing music command: ${error}`);
          return res.status(500).json({ message: "Music command failed", error: error.message });
        }
        res.status(200).json({ message: `Music ${action} command executed` });
      });
    } else {
      res.status(200).json({ message: `Music ${action} command not supported on this platform` });
    }
  } catch (error) {
    console.error("musicControl error:", error);
    return res.status(500).json({ message: "musicControl error" });
  }
};

// Expense tracking
export const addExpense = async (req, res) => {
  try {
    const { amount, category, description } = req.body;
    const userId = req.userId;

    if (!amount || !category || !description) {
      return res.status(400).json({ message: "Amount, category, and description are required" });
    }

    const expense = new Expense({
      userId,
      amount: parseFloat(amount),
      category,
      description
    });

    await expense.save();

    return res.status(201).json(expense);
  } catch (error) {
    console.error("addExpense error:", error);
    return res.status(500).json({ message: "addExpense error" });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = req.query;

    let filter = { userId };
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const expenses = await Expense.find(filter).sort({ date: -1 });

    return res.status(200).json(expenses);
  } catch (error) {
    console.error("getExpenses error:", error);
    return res.status(500).json({ message: "getExpenses error" });
  }
};

// Calendar events
export const addCalendarEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, location } = req.body;
    const userId = req.userId;

    if (!title || !startDate) {
      return res.status(400).json({ message: "Title and start date are required" });
    }

    const event = new CalendarEvent({
      userId,
      title,
      description,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      location
    });

    await event.save();

    return res.status(201).json(event);
  } catch (error) {
    console.error("addCalendarEvent error:", error);
    return res.status(500).json({ message: "addCalendarEvent error" });
  }
};

export const getCalendarEvents = async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = req.query;

    let filter = { userId };
    if (startDate && endDate) {
      filter.startDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      // If only start date is provided, get events from that date onwards
      filter.startDate = { $gte: new Date(startDate) };
    } else {
      // Default to upcoming events
      filter.startDate = { $gte: new Date() };
    }

    const events = await CalendarEvent.find(filter).sort({ startDate: 1 });

    return res.status(200).json(events);
  } catch (error) {
    console.error("getCalendarEvents error:", error);
    return res.status(500).json({ message: "getCalendarEvents error" });
  }
};

// Email functionality
export const sendEmail = async (req, res) => {
  try {
    // This is a placeholder implementation
    // In a real application, you would integrate with an email service like Nodemailer
    const { to, subject, body } = req.body;
    const userId = req.userId;

    if (!to || !body) {
      return res.status(400).json({ message: "Recipient and body are required" });
    }

    // Placeholder - in a real implementation you would send the email here
    console.log(`Email from user ${userId} to ${to}: ${subject || 'No Subject'} - ${body}`);

    return res.status(200).json({ message: "Email sent successfully (simulated)" });
  } catch (error) {
    console.error("sendEmail error:", error);
    return res.status(500).json({ message: "sendEmail error" });
  }
};

// Text summarization (using Gemini)
export const summarizeText = async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.userId;

    if (!text) {
      return res.status(400).json({ message: "Text to summarize is required" });
    }

    const user = await User.findById(userId);
    const geminiResult = await geminiResponse(
      `Summarize this text into 2-3 concise sentences: ${text}`,
      user?.assistantName || "Jarvis",
      user?.name || "User"
    );

    const jsonMatch = geminiResult.match(/{[\s\S]*}/);
    const responseData = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: geminiResult };
    
    return res.status(200).json({ summary: responseData.response });
  } catch (error) {
    console.error("summarizeText error:", error);
    return res.status(500).json({ message: "summarizeText error" });
  }
};

// Translation (using Gemini)
export const translateText = async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    const userId = req.userId;

    if (!text || !targetLang) {
      return res.status(400).json({ message: "Text and target language are required" });
    }

    const user = await User.findById(userId);
    const geminiResult = await geminiResponse(
      `Translate the following text to ${targetLang}: ${text}`,
      user?.assistantName || "Jarvis",
      user?.name || "User"
    );

    const jsonMatch = geminiResult.match(/{[\s\S]*}/);
    const responseData = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: geminiResult };
    
    return res.status(200).json({ translatedText: responseData.response, targetLang });
  } catch (error) {
    console.error("translateText error:", error);
    return res.status(500).json({ message: "translateText error" });
  }
};