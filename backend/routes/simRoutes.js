/**
 * The conversation API the Unreal simulator talks to during a consultation: a
 * drop-in copy of Voxio's chat.voxio.in, which this backend replaced.
 *
 * Mounted at /agents (Voxio's own paths, so the game changes only its base
 * URL) and at /api/chat (the same two calls under the API prefix).
 *
 * Requests and error bodies match what chat.voxio.in returned when probed
 * directly (October 2026). Successful replies are trimmed to what is spoken:
 *
 *   POST start_session  {api_key, session_id?}
 *     200 {"speak": "Hi"}
 *     400 {"detail": "either api_key or workflow required , received : dict_keys([...])"}
 *     500 text "Internal Server Error" for an unknown api_key
 *   POST process_input  {session_id, user_input: {user_input: "..."}}
 *     200 {"speak": "..."}: the patient, or the tutor once feedback exists
 *     404 {"detail": "Session not found or expired"}
 *     422 FastAPI validation body when session_id or user_input is missing
 *
 * Unauthenticated, as Voxio's was: the game has no dashboard login. A session
 * only exists after start_session with a valid scenario api_key.
 */
import express from "express";
import { randomUUID } from "crypto";
import {
  GREETING,
  getConversation,
  patientTurn,
  reasoningTurn,
  startSession,
  voxioStyleState,
} from "../utils/simEngine.js";

const router = express.Router();

/** FastAPI's 422 for a missing body field. */
const missingField = (res, field, input) =>
  res.status(422).json({
    detail: [{ type: "missing", loc: ["body", field], msg: "Field required", input }],
  });

/** Uncaught failures came back from Voxio's server as a bare text 500. */
const internalError = (res, err) => {
  if (err) console.error("[SIM]", err.message);
  if (!res.headersSent) res.status(500).type("text/plain").send("Internal Server Error");
};

router.get("/health", (req, res) => res.json({ status: "ok" }));

router.post("/start_session", async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : null;
  if (!body) return internalError(res);

  const apiKey = body.api_key;
  if (!apiKey) {
    const keys = Object.keys(body).map((k) => `'${k}'`).join(", ");
    return res.status(400).json({ detail: `either api_key or workflow required , received : dict_keys([${keys}])` });
  }

  const sessionId = body.session_id ? String(body.session_id) : randomUUID();
  try {
    const conv = await startSession(sessionId, String(apiKey));
    if (!conv) return internalError(res, new Error(`start_session: no scenario has api_key ${String(apiKey).slice(0, 8)}…`));
    console.log(`[SIM] session ${sessionId} started for scenario ${conv.scenario_id}`);
    res.json({ speak: GREETING });
  } catch (err) {
    internalError(res, err);
  }
});

router.post("/process_input", async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.session_id === undefined) return missingField(res, "session_id", body);
  if (body.user_input === undefined) return missingField(res, "user_input", body);

  const sessionId = String(body.session_id);
  try {
    const conv = await getConversation(sessionId, { create: false });
    if (!conv) return res.status(404).json({ detail: "Session not found or expired" });

    // Voxio's input node reads user_input.user_input; anything else is no input.
    const input = body.user_input?.user_input;
    if (typeof input !== "string" || !input.trim()) {
      return res.status(422).json({ detail: "user_input.user_input must be a non-empty string" });
    }

    // Only what is said back: the patient's line, or the tutor's after feedback.
    // Feedback and score are produced as before but read via /api/sessions/feedback.
    if (conv.phase === "reasoning") {
      const { response } = await reasoningTurn(sessionId, input);
      return res.json({ speak: response });
    }
    const reply = await patientTurn(sessionId, input);
    res.json({ speak: reply.speak });
  } catch (err) {
    // A turn refused by the engine (e.g. 409) is reported, not hidden as a 500.
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({ detail: err.message });
    }
    internalError(res, err);
  }
});

router.get("/session", async (req, res) => {
  const sessionId = String(req.query?.session_id ?? "");
  try {
    const conv = sessionId && (await getConversation(sessionId, { create: false }));
    res.json({ "session-data": { state: conv ? voxioStyleState(conv) : null } });
  } catch (err) {
    internalError(res, err);
  }
});

// The game's "session over" call. Nothing to tear down: state stays readable.
router.delete("/session/pl", (req, res) => res.json({ status: "success" }));
router.post("/rollback_session", (req, res) => res.json({ status: "success" }));

export default router;
