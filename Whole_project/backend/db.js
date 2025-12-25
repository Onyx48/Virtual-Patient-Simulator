// WHOLE_PROJECT/db.js
import mongoose from "mongoose";
import "dotenv/config"; // Ensures .env is loaded

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env file. Please check your .env configuration.");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    // mongoose.connection.name will show the database name it's connected to
    console.log("MongoDB Connected successfully to database:", mongoose.connection.name);
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
    // Log the URI being used for debugging, but be careful not to log passwords in production
    // console.error("Attempted URI (ensure password is correct and not shown here in prod logs):", process.env.MONGODB_URI.replace(/:([^:@\s]+)@/, ':PASSWORD_HIDDEN@'));
    process.exit(1);
  }
};

export default connectDB;