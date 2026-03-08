import express from "express";
import mongoose from "mongoose";
import { EncryptJWT } from "jose";
import { createSecretKey } from "crypto";
import Scenario from "../models/scenarioModel.js";
import Student from "../models/studentModel.js";
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

      const studentProfile = await Student.findOne({
        user: req.user._id,
      }).select("_id educatorId");
      if (!studentProfile) {
        return res.status(404).json({ message: "Student profile not found." });
      }

      if (!studentProfile.educatorId) {
        return res
          .status(400)
          .json({ message: "Assigned educator is missing for student." });
      }

      const companyId = "@STRAITS";
      const sessionId = new mongoose.Types.ObjectId().toString();

      const payload = {
        api_key: scenario.apiKey,
        session_id: sessionId,
        student_id: studentProfile._id.toString(),
        educator_id: studentProfile.educatorId.toString(),
        company_id: companyId,
      };

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

export default router;
