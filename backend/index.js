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
import importRoutes from "./routes/importRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import askReasonRoutes from "./routes/askReasonRoutes.js";
import { APP_ENV, isDev, isProd, publicMessage } from "./utils/appEnv.js";

const app = express();

connectDB();

// Deployed frontends. Extra origins can be added via CORS_ORIGINS (comma-separated).
const PROD_ORIGINS = [
  "https://vps.metawingsxr.com",
  "https://vpsdashboard.metawingsxr.com",
];
const EXTRA_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Any port on loopback or a private LAN address, so the dev server still works
// when Vite picks a fallback port (5174 when 5173 is taken) or is opened via
// 127.0.0.1 / the machine's LAN IP. Hardcoding only localhost:5173 meant those
// responses arrived without an Access-Control-Allow-Origin header, so the
// browser discarded them: the API logged a normal 200 while the client saw a
// bare network error and login looked broken.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

const isAllowedOrigin = (origin) => {
  if (PROD_ORIGINS.includes(origin) || EXTRA_ORIGINS.includes(origin)) return true;
  return isDev && LOCAL_ORIGIN.test(origin);
};

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header: same-origin, curl, or a native client. Not a browser
      // cross-origin request, so there is nothing to gate.
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      // Log it. A silent omission of the CORS header is invisible server-side
      // and shows up in the browser as an unexplained network failure.
      console.warn(`[CORS] blocked origin: ${origin}`);
      return callback(null, false);
    },
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
app.use("/api/import", importRoutes);
app.use("/api/groups", groupRoutes);

/*
 * Mounted twice on purpose. `/ask-reason` is the path the external simulator was
 * given, and it holds no JWT so it does not go through the /api prefix the
 * frontend uses; `/api/ask-reason` is the same router, so our own pages can call
 * it through the Vite proxy without a second hostname.
 */
app.use("/ask-reason", askReasonRoutes);
app.use("/api/ask-reason", askReasonRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Backend server (Single User Model) is running!" });
});

// Dev only: this is unauthenticated and reports configuration, which has no
// business being reachable in production.
if (isDev) {
  app.get("/debug/env", (req, res) => {
    res.json({
      APP_ENV,
      AWS_REGION: process.env.AWS_REGION || null,
      EMAIL_FROM: process.env.EMAIL_FROM || null,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? "present" : "missing",
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
        ? "present"
        : "missing",
      mailConfigured: Boolean(
        process.env.AWS_REGION &&
          process.env.EMAIL_FROM &&
          process.env.AWS_ACCESS_KEY_ID &&
          process.env.AWS_SECRET_ACCESS_KEY,
      ),
    });
  });
}

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
  if (isDev) console.error(err.stack);

  const statusCode =
    err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode) || 500;
  // In production the internal reason stays in the log above; the client gets
  // generic wording so stack traces and config details are not disclosed.
  res.status(statusCode).json({
    message: publicMessage(err, "An unexpected server error occurred."),
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log("=================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `🛠️  Mode: ${APP_ENV}${isProd ? " (client errors are generic)" : " (client errors include details)"}`,
  );
  console.log(
    `🔗 MongoDB connection attempt initiated (Target DB: via .env)...`,
  );
  console.log(`📍 Local Backend: http://localhost:${PORT}`);
  console.log("=================================");
});
