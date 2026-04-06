import "./loadEnv.js"
import express from "express"
import connectDb from "./config/db.js"
import authRouter from "./routes/auth.routes.js"
import cors from "cors"
import cookieParser from "cookie-parser"
import userRouter from "./routes/user.routes.js"
import geminiResponse from "./gemini.js"
import taskRouter from "./routes/task.routes.js"
import advancedRouter from "./routes/advanced.routes.js"


const app=express()
app.use(cors({
    origin:["http://localhost:5173","http://localhost:5174"],
    credentials:true
}))
const port=process.env.PORT || 5000
app.use(express.json())
app.use(cookieParser())
app.use("/api/auth",authRouter)
app.use("/api/user",userRouter)
app.use("/api/task",taskRouter)
app.use("/api/advanced",advancedRouter)

console.log("OPENWEATHER_API_KEY loaded:", Boolean(process.env.OPENWEATHER_API_KEY || process.env.VITE_OPENWEATHER_API_KEY))

app.listen(port,()=>{
    connectDb()
    console.log("server started")
})

