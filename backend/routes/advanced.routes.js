import express from "express";
import { 
  systemControl, 
  musicControl, 
  addExpense, 
  getExpenses, 
  addCalendarEvent, 
  getCalendarEvents, 
  sendEmail, 
  summarizeText, 
  translateText 
} from "../controllers/advanced.controllers.js";
import isAuth from "../middlewares/isAuth.js";

const advancedRouter = express.Router();

// System controls
advancedRouter.post("/system-control", isAuth, systemControl);

// Music controls
advancedRouter.post("/music-control", isAuth, musicControl);

// Expense tracking
advancedRouter.post("/expense", isAuth, addExpense);
advancedRouter.get("/expenses", isAuth, getExpenses);

// Calendar events
advancedRouter.post("/calendar-event", isAuth, addCalendarEvent);
advancedRouter.get("/calendar-events", isAuth, getCalendarEvents);

// Email
advancedRouter.post("/email", isAuth, sendEmail);

// AI features
advancedRouter.post("/summarize", isAuth, summarizeText);
advancedRouter.post("/translate", isAuth, translateText);

export default advancedRouter;