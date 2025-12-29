// WHOLE_PROJECT/db.js
import mongoose from "mongoose";
import dotenv from "dotenv";

// Explicitly load .env
dotenv.config();

const connectDB = async () => {
  try {
    // DEBUGGING: Remove these lines after fixing
    // console.log("Current Directory:", process.cwd());
    // console.log("Environment Variables Loaded:", process.env.MONGODB_URI ? "YES" : "NO");

    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is not defined. Check .env placement or spelling."
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log(
      "MongoDB Connected successfully to database:",
      mongoose.connection.name
    );
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

export default connectDB;
