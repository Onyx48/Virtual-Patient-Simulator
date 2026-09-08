import express from "express";
import mongoose from "mongoose";
import { readFileSync } from "fs";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import { generateText } from "../utils/geminiClient.js";
import { htmlToText, questionsToArray } from "../utils/bubbleScenario.js";
import { publicMessage } from "../utils/appEnv.js";

const router = express.Router();

/*
 * POST | GET /ask-reason — the clinical reasoning coach.
 *
 * Contract (fixed by the caller, so the keys stay camelCase here even though the
 * rest of the session pipeline is snake_case):
 *
 *   request  { query, scenarioId, transcription, sessionId }
 *   response { response: "..." }
 *
 * Both verbs run the same handler. GET reads the query string instead of a body,
 * mirroring posta's /get-results, so a caller that guesses the wrong method gets
 * an answer rather than a 404.
 *
 * `transcription` from the request is what the coach reasons about; the stored
 * transcript is only a fallback for a caller that sends none. The simulator owns
 * the conversation, and our copy does not exist until the session ends.
 */

// Read once at boot; a static asset, not per-request data. Matches scenarioRoutes.
const ASK_REASON_PROMPT = readFileSync(
  new URL("../ai/prompts/ask-reason.md", import.meta.url),
  "utf8",
);

/**
 * Flatten a transcript into one readable block for the prompt.
 *
 * Handles both shapes: the stored array of {role, content, speaker} and the raw
 * "Speaker: line" string the simulator sends. `speaker` is preferred over `role`
 * so the model sees the persona's name, which is what the student will refer to.
 */
const transcriptionToText = (transcription) => {
  if (!transcription) return "";

  if (typeof transcription === "string") return transcription.trim();

  if (!Array.isArray(transcription)) return String(transcription).trim();

  return transcription
    .map((turn) => {
      if (!turn || typeof turn !== "object") return String(turn ?? "").trim();
      const label = String(turn.speaker || turn.role || "unknown").trim();
      const content = String(turn.content ?? turn.text ?? "").trim();
      return content ? `${label}: ${content}` : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};

const askReason = async (req, res) => {
  // A GET carries no body, so fall back to the query string for both.
  const input = { ...(req.query || {}), ...(req.body || {}) };

  const query = String(input.query ?? "").trim();
  const scenarioId = String(input.scenarioId ?? "").trim();
  const sessionId = String(input.sessionId ?? "").trim();

  const missing = ["query", "scenarioId", "sessionId"].filter(
    (field) => !String(input[field] ?? "").trim(),
  );

  if (missing.length) {
    // The access log shows only a bare 400, so record what the caller did send.
    console.warn(
      `[ask-reason] rejected: missing ${missing.join(", ")}; got keys ${Object.keys(input).sort().join(", ") || "(none)"}`,
    );
    return res.status(400).json({
      message: `Missing ${missing.map((f) => `'${f}'`).join(", ")} in request body or query string.`,
    });
  }

  if (!mongoose.Types.ObjectId.isValid(scenarioId)) {
    return res
      .status(400)
      .json({ message: `'scenarioId' is not a valid id: ${scenarioId}` });
  }

  try {
    const scenario = await Scenario.findById(scenarioId).lean();

    if (!scenario) {
      console.warn(`[ask-reason] no scenario with _id ${scenarioId}`);
      return res
        .status(404)
        .json({ message: `No scenario found with scenarioId: ${scenarioId}` });
    }

    /*
     * The session gates the endpoint. It is unauthenticated because the caller
     * is the external simulator, which holds no JWT — requiring a real session
     * id is what stops an anonymous caller spending Gemini quota at will.
     */
    const session = await Session.findOne({ session_id: sessionId })
      .select("transcription")
      .lean();

    if (!session) {
      console.warn(`[ask-reason] no session with session_id ${sessionId}`);
      return res
        .status(404)
        .json({ message: `No session found with sessionId: ${sessionId}` });
    }

    /*
     * The caller's transcript wins. The simulator owns the conversation and is
     * the authoritative source for it; our stored copy only arrives when the
     * session ends, so during or right after a run it is empty or stale. The
     * stored copy is the fallback for a caller that sends no transcript.
     */
    const transcriptionText =
      transcriptionToText(input.transcription) ||
      transcriptionToText(session.transcription);

    console.log(
      `[ask-reason] scenarioId = ${scenarioId}, sessionId = ${sessionId}, ` +
        `transcript chars = ${transcriptionText.length}, query chars = ${query.length}`,
    );

    const userQuery = JSON.stringify({
      scenario_name: scenario.scenarioName || "",
      scenario_prompt: htmlToText(scenario.scenarioPrompt),
      questions_for_feedback: questionsToArray(scenario.aiQuestions),
      difficulty: scenario.difficulty || "Medium",
      movements: scenario.animationTriggers || {},
      transcription: transcriptionText,
      query,
    });

    const response = await generateText({
      systemPrompt: ASK_REASON_PROMPT,
      userQuery,
    });

    res.json({ response });
  } catch (err) {
    console.error("[ask-reason] failed:", err);
    res.status(503).json({
      message: publicMessage(err, "The reasoning coach is unavailable right now."),
    });
  }
};

router.post("/", askReason);
router.get("/", askReason);

export default router;
