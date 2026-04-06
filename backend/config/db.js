import mongoose from "mongoose"

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("db connected")
  } catch (error) {
    console.error("db error:", error)
    process.exit(1)
  }
}

export default connectDb
