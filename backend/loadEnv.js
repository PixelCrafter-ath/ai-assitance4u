import dotenv from "dotenv"
import path from "path"

// Load .env from the current working directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

console.log("Environment variables loaded via loadEnv.js");
