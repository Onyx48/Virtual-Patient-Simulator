import express from "express";
import mongoose from "mongoose";
import { EncryptJWT } from "jose";
import { createSecretKey } from "crypto";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";

const router = express.Router();

const getJweKey = () => {
  const rawSecret = process.env.JWE_SECRET;
  if (!rawSecret)
    throw Object.assign(new Error("JWE_SECRET is not set."), {
      statusCode: 500,
    });

  const keyBytes = Buffer.from(rawSecret, "base64");

  if (keyBytes.length !== 32) {
    throw Object.assign(
      new Error(
        `JWE_SECRET must decode to exactly 32 bytes. Got ${keyBytes.length} bytes. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
      ),
      { statusCode: 500 },
    );
  }

  return createSecretKey(keyBytes);
};

const buildRedirectUrl = (token) => {
  const baseUrl = process.env.VASSIST_REDIRECT_BASE_URL;
  if (!baseUrl) {
    const error = new Error("VASSIST_REDIRECT_BASE_URL is not set.");
    error.statusCode = 500;
    throw error;
  }
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
};

router.post(
  "/start",
  protect,
  checkAccess("viewScenarios"),
  async (req, res) => {
    try {
      if (req.user?.role !== "student") {
        return res
          .status(403)
          .json({ message: "Only students can start sessions." });
      }

      const { scenario_id } = req.body;
      if (!scenario_id || !mongoose.Types.ObjectId.isValid(scenario_id)) {
        return res
          .status(400)
          .json({ message: "Valid scenario_id is required." });
      }

      const scenario =
        await Scenario.findById(scenario_id).select("apiKey assignedTo");
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found." });
      }

      const isAssigned = scenario.assignedTo?.some(
        (id) => id.toString() === req.user._id.toString(),
      );
      if (!isAssigned) {
        return res
          .status(403)
          .json({ message: "Scenario not assigned to this student." });
      }

      if (!scenario.apiKey) {
        return res
          .status(400)
          .json({ message: "Scenario API key is missing." });
      }

      const student_id = req.user._id.toString();
      const educator_id = req.user.supervisor?._id?.toString();

      if (!educator_id) {
        return res
          .status(400)
          .json({ message: "Assigned educator is missing for student." });
      }

      const companyId = "@STRAITS";
      const sessionId = new mongoose.Types.ObjectId().toString();

      const payload = {
        api_key: scenario.apiKey,
        session_id: sessionId,
        student_id: student_id,
        educator_id: educator_id,
        company_id: companyId,
        scenario_id: scenario_id,
      };

      console.log("JWE Payload:", JSON.stringify(payload, null, 2));

      const key = getJweKey();

      const jwe = await new EncryptJWT(payload)
        .setProtectedHeader({
          alg: "A256KW",
          enc: "A256CBC-HS512",
          typ: "JWE",
        })
        .setIssuedAt()
        .setExpirationTime("10m")
        .encrypt(key);

      const redirectUrl = buildRedirectUrl(jwe);

      res.json({ session_id: sessionId, redirect_url: redirectUrl });
    } catch (err) {
      console.error("Start Session Error:", err);
      res
        .status(err.statusCode || 500)
        .json({ message: err.message || "Server error starting session." });
    }
  },
);

router.get("/by-student/:studentId/:scenarioId", protect, async (req, res) => {
  try {
    const { studentId, scenarioId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    if (!studentId || !scenarioId) {
      return res
        .status(400)
        .json({ message: "Student ID and Scenario ID are required" });
    }

    const query = {
      student_id: studentId,
      scenario_id: scenarioId,
    };

    const [sessions, total] = await Promise.all([
      Session.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("transcription feedback score createdAt"),
      Session.countDocuments(query),
    ]);

    res.json({
      sessions,
      totalCount: total,
      hasMore: skip + sessions.length < total,
      currentPage: page,
    });
  } catch (err) {
    console.error("Get Sessions Error:", err);
    res.status(500).json({ message: "Server error fetching sessions." });
  }
});

router.get("/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json(session);
  } catch (err) {
    console.error("Get Session By ID Error:", err);
    res.status(500).json({ message: "Server error fetching session." });
  }
});

export default router;
