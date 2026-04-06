import Task from "../models/Task.js";
import User from "../models/user.model.js";
import cron from "node-cron";

// Initialize cron job to check for reminders every minute
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const reminders = await Task.find({
      reminderTime: { $lte: now },
      completed: false
    }).populate("userId", "name");

    for (const reminder of reminders) {
      // In a real app, you might send a notification, email, or trigger voice alert
      console.log(`⏰ Reminder for ${reminder.userId.name}: ${reminder.title}`);
      
      // Mark as completed after "triggering"
      reminder.completed = true;
      await reminder.save();
    }
  } catch (error) {
    console.error("Cron job error:", error);
  }
});

export const createTask = async (req, res) => {
  try {
    const { title, reminderTime } = req.body;
    const userId = req.userId;

    if (!title) {
      return res.status(400).json({ message: "Task title is required" });
    }

    const task = new Task({
      title,
      userId,
      reminderTime: reminderTime ? new Date(reminderTime) : null
    });

    await task.save();

    return res.status(201).json(task);
  } catch (error) {
    console.error("createTask error:", error);
    return res.status(500).json({ message: "createTask error" });
  }
};

export const getTasks = async (req, res) => {
  try {
    const userId = req.userId;

    const tasks = await Task.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json(tasks);
  } catch (error) {
    console.error("getTasks error:", error);
    return res.status(500).json({ message: "getTasks error" });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { completed } = req.body;
    const userId = req.userId;

    const task = await Task.findOne({ _id: taskId, userId });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (completed !== undefined) {
      task.completed = completed;
      task.updatedAt = new Date();
      await task.save();
    }

    return res.status(200).json(task);
  } catch (error) {
    console.error("updateTask error:", error);
    return res.status(500).json({ message: "updateTask error" });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId;

    const result = await Task.deleteOne({ _id: taskId, userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("deleteTask error:", error);
    return res.status(500).json({ message: "deleteTask error" });
  }
};