import express from "express";
import cors from "cors";
import connectDB from "./db.js";
import "dotenv/config";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/users.js";
import studentRoutes from "./routes/studentRoutes.js";
import schoolRoutes from "./routes/schoolRoutes.js";
import scenarioRoutes from "./routes/scenarioRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";

const app = express();

connectDB();

app.use(
  cors({
    origin: [
      "https://vpsdashboard.metawingsxr.com",
      "http://localhost:5173", // Keep local for testing
      // ADD YOUR PRODUCTION FRONTEND
      ,
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static("uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/scenarios", scenarioRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Backend server (Single User Model) is running!" });
});

app.get("/debug/env", (req, res) => {
  res.json({
    AWS_REGION: process.env.AWS_REGION,
    EMAIL_FROM: process.env.EMAIL_FROM,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? "present" : "missing",
  });
});

app.use("*", (req, res) => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
  });
});

app.use((err, req, res, next) => {
  console.error("--- Global Error Handler ---");
  console.error("Timestamp:", new Date().toISOString());
  console.error("Path:", req.path);
  console.error("Error Message:", err.message);

  const statusCode =
    err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode) || 500;
  res.status(statusCode).json({
    message: err.message || "An unexpected server error occurred.",
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log("=================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `🔗 MongoDB connection attempt initiated (Target DB: via .env)...`,
  );
  console.log(`📍 Local Backend: http://localhost:${PORT}`);
  console.log("=================================");
});
