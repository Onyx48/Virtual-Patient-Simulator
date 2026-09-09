import express from "express";
import mongoose from "mongoose";
import { readFileSync } from "fs";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import { generateTextWithFallback } from "../utils/aiText.js";
import { htmlToText, questionsToArray } from "../utils/bubbleScenario.js";
import { findLegacyScenario } from "../data/legacyScenarios.js";
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

/**
 * Pull one logical field out of the request under any of its accepted names.
 *
 * The Python service this replaces used snake_case (`scenario_id`, `session_id`),
 * so callers written against it send those. Rejecting them would be a pointless
 * 400 over a naming style, and the two can never collide.
 */
const FIELD_ALIASES = {
  query: ["query", "question"],
  scenarioId: ["scenarioId", "scenario_id"],
  sessionId: ["sessionId", "session_id"],
  transcription: ["transcription", "transcript"],
};

const pick = (input, field) => {
  for (const name of FIELD_ALIASES[field]) {
    const value = input[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
};

/**
 * Read the payload out of the body, the query string, or a body that arrived
 * without a usable Content-Type.
 *
 * Express only parses JSON when the header says so. A caller sending the right
 * JSON as text/plain, or with no Content-Type at all, otherwise reaches the
 * handler with an empty body and gets told its fields are missing — which reads
 * as a bug in the endpoint rather than in the header.
 */
const readInput = (req) => {
  const body = req.body;

  if (typeof body === "string" && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") return { ...req.query, ...parsed };
    } catch {
      // Not JSON. Fall through to the query string rather than failing here.
    }
  }

  /*
   * A JSON body sent as form-urlencoded arrives as one key with an empty value,
   * because that is how the urlencoded parser reads it. Recover the JSON.
   */
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const keys = Object.keys(body);
    if (keys.length === 1 && body[keys[0]] === "" && keys[0].trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(keys[0]);
        if (parsed && typeof parsed === "object") return { ...req.query, ...parsed };
      } catch {
        // Leave it; the missing-field error below will report what arrived.
      }
    }
    return { ...req.query, ...body };
  }

  // A GET carries no body, so the query string is the payload.
  return { ...req.query };
};

/*
 * Every line for one call carries the same short id.
 *
 * The coach is called by an external simulator, concurrently, for different
 * students — so without a correlator the log is interleaved fragments and there
 * is no way to tell which "answered by groq" belongs to which rejected request.
 * Short and random rather than sequential: it only has to be unique among the
 * requests in flight.
 */
const newRequestId = () => Math.random().toString(36).slice(2, 8);

/*
 * Transcripts and coach answers are patient-consultation material, so contents
 * are off by default and only counts are logged. Set AI_DEBUG_LOG=true to get
 * excerpts when diagnosing a bad answer — a deliberate, temporary choice on a
 * specific box, not something to leave on in production.
 */
const logContent = () =>
  ["true", "1", "yes"].includes(String(process.env.AI_DEBUG_LOG).toLowerCase());

const excerpt = (value, limit = 400) => {
  const text = String(value ?? "");
  return text.length > limit ? `${text.slice(0, limit)}… (+${text.length - limit} chars)` : text;
};

const askReason = async (req, res) => {
  const reqId = newRequestId();
  const startedAt = Date.now();
  const input = readInput(req);

  /*
   * Logged before validation, because the failures worth diagnosing here are
   * malformed requests — a caller sending the wrong Content-Type reached the
   * handler with an empty body, and the access log showed only a 400 with no
   * hint that the header was the cause.
   */
  console.log(
    `[ask-reason ${reqId}] ${req.method} from ${req.ip} ` +
      `content-type=${req.get("content-type") || "(none)"} ` +
      `bodyType=${typeof req.body} keys=${Object.keys(input).sort().join(",") || "(none)"}`,
  );

  const query = String(pick(input, "query") ?? "").trim();
  const scenarioId = String(pick(input, "scenarioId") ?? "").trim();
  const sessionId = String(pick(input, "sessionId") ?? "").trim();

  const missing = Object.entries({ query, scenarioId, sessionId })
    .filter(([, value]) => !value)
    .map(([field]) => field);

  if (missing.length) {
    // The access log shows only a bare 400, so record what the caller did send.
    console.warn(
      `[ask-reason ${reqId}] rejected: missing ${missing.join(", ")}`,
    );
    return res.status(400).json({
      message:
        `Missing ${missing.map((f) => `'${f}' (or '${FIELD_ALIASES[f][1]}')`).join(", ")} ` +
        `in request body or query string. Received: ${Object.keys(input).sort().join(", ") || "nothing"}. ` +
        `If the body was JSON, check the request sent Content-Type: application/json.`,
    });
  }

  /*
   * A short Bubble code such as "9C2F7X" resolves from the compatibility table
   * instead of Mongo. Checked before the ObjectId validation, because that check
   * is exactly what used to reject these callers.
   */
  const legacyScenario = findLegacyScenario(scenarioId);

  if (!legacyScenario && !mongoose.Types.ObjectId.isValid(scenarioId)) {
    return res
      .status(400)
      .json({ message: `'scenarioId' is not a valid id: ${scenarioId}` });
  }

  try {
    const scenario = legacyScenario || (await Scenario.findById(scenarioId).lean());

    if (!scenario) {
      console.warn(`[ask-reason ${reqId}] no scenario with _id ${scenarioId}`);
      return res
        .status(404)
        .json({ message: `No scenario found with scenarioId: ${scenarioId}` });
    }

    if (legacyScenario) {
      console.log(`[ask-reason ${reqId}] scenarioId ${scenarioId} resolved from the legacy table`);
    }

    /*
     * Looked up only for its stored transcript, which is the fallback when the
     * caller sends none. It is not a gate: see below.
     *
     * Note this leaves the endpoint unauthenticated with nothing throttling it —
     * the caller is the external simulator, which holds no JWT. A shared secret
     * header is the fix if AI spend from unknown callers becomes a problem.
     */
    const session = await Session.findOne({ session_id: sessionId })
      .select("transcription")
      .lean();

    /*
     * The caller's transcript wins. The simulator owns the conversation and is
     * the authoritative source for it; our stored copy only arrives when the
     * session ends, so during or right after a run it is empty or stale. The
     * stored copy is the fallback for a caller that sends no transcript.
     */
    const transcriptionText =
      transcriptionToText(pick(input, "transcription")) ||
      transcriptionToText(session?.transcription);

    if (!session) {
      /*
       * An unknown session id is not fatal. Old clients send a Bubble
       * StreamSessionId for a run we never recorded, so the lookup can only
       * fail — and the session was never the point: the transcript is what the
       * coach reasons about, and the caller supplies it. A 404 here would leave
       * those clients with no coach at all.
       *
       * If the request carries no transcript either, the model is asked about an
       * empty consultation, which the prompt handles by telling the student to
       * begin rather than inventing one. Logged, because a sudden run of these
       * means sessions have stopped being recorded.
       */
      console.warn(
        `[ask-reason ${reqId}] no session stored for session_id ${sessionId}; ` +
          `continuing with the transcript from the request ` +
          `(${transcriptionText.length} chars)`,
      );
    }

    console.log(
      `[ask-reason ${reqId}] resolved scenario=${scenarioId}` +
        `${legacyScenario ? " (legacy)" : ""} session=${sessionId} ` +
        `transcriptChars=${transcriptionText.length} ` +
        `transcriptFrom=${
          pick(input, "transcription") ? "request" : session ? "stored" : "none"
        } queryChars=${query.length}`,
    );

    if (logContent()) {
      console.log(`[ask-reason ${reqId}] query: ${excerpt(query)}`);
      console.log(
        `[ask-reason ${reqId}] transcript: ${excerpt(transcriptionText, 1500)}`,
      );
    }

    /*
     * A legacy record already holds plain prose and a real array; a Mongo
     * document holds rich text and a Quill list, so only that one needs
     * converting. Both end up as the same payload shape.
     */
    const scenarioFields = legacyScenario || {
      scenario_name: scenario.scenarioName || "",
      scenario_prompt: htmlToText(scenario.scenarioPrompt),
      questions_for_feedback: questionsToArray(scenario.aiQuestions),
      difficulty: scenario.difficulty || "Medium",
      movements: scenario.animationTriggers || {},
    };

    const userQuery = JSON.stringify({
      scenario_name: scenarioFields.scenario_name,
      scenario_prompt: scenarioFields.scenario_prompt,
      questions_for_feedback: scenarioFields.questions_for_feedback,
      difficulty: scenarioFields.difficulty,
      movements: scenarioFields.movements,
      transcription: transcriptionText,
      query,
    });

    // Prompt size is logged because it is the usual cause of a slow or truncated
    // answer, and it grows with the transcript rather than with anything visible
    // in the request.
    console.log(
      `[ask-reason ${reqId}] calling AI: systemPromptChars=${ASK_REASON_PROMPT.length} ` +
        `userQueryChars=${userQuery.length}`,
    );

    const aiStartedAt = Date.now();
    const { text, provider, model } = await generateTextWithFallback({
      systemPrompt: ASK_REASON_PROMPT,
      userQuery,
    });
    const aiMs = Date.now() - aiStartedAt;

    console.log(
      `[ask-reason ${reqId}] answered by ${provider} (${model}) ` +
        `${text.length} chars in ${aiMs}ms (total ${Date.now() - startedAt}ms)`,
    );

    // An empty answer still returns 200, so it would otherwise look like success
    // while the student sees a blank coach.
    if (!text.trim()) {
      console.warn(
        `[ask-reason ${reqId}] ${provider} returned an empty answer — the student will see nothing`,
      );
    }

    if (logContent()) {
      console.log(`[ask-reason ${reqId}] answer: ${excerpt(text, 1500)}`);
    }

    res.json({ response: text });
  } catch (err) {
    // Status and provider detail matter here: this is where a Gemini 429 with no
    // Groq key configured surfaces, and the bare stack does not say which
    // provider gave up or how long was spent before it did.
    console.error(
      `[ask-reason ${reqId}] failed after ${Date.now() - startedAt}ms ` +
        `status=${err.status || err.statusCode || "none"}: ${err.message}`,
    );
    console.error(err);
    res.status(503).json({
      message: publicMessage(err, "The reasoning coach is unavailable right now."),
    });
  }
};

/*
 * Catches a body the global express.json() declined because the Content-Type was
 * text/plain, absent, or something else. It only sees a request the JSON parser
 * already skipped, so it cannot interfere with a correct caller — readInput then
 * tries to JSON.parse the string.
 */
router.use(express.text({ type: "*/*", limit: "2mb" }));

router.post("/", askReason);
router.get("/", askReason);

export default router;
