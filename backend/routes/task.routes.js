import express from "express";
import { createTask, getTasks, updateTask, deleteTask } from "../controllers/task.controllers.js";
import isAuth from "../middlewares/isAuth.js";

const taskRouter = express.Router();

taskRouter.post("/", isAuth, createTask);
taskRouter.get("/", isAuth, getTasks);
taskRouter.put("/:taskId", isAuth, updateTask);
taskRouter.delete("/:taskId", isAuth, deleteTask);

export default taskRouter;