import express from "express";
import mongoose from "mongoose";
import { readFileSync } from "fs";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import { generateTextWithFallback } from "../utils/aiText.js";
import { htmlToText, questionsToArray } from "../utils/bubbleScenario.js";
import { findLegacyScenario } from "../data/legacyScenarios.js";
import { publicMessage } from "../utils/appEnv.js";
import { startTrace } from "../utils/routeTrace.js";

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

/*
 * The coach answers from a fixed script — no Gemini, no Groq, no model call at
 * all. Deliberate: while the AI providers are unreliable (a spent Gemini free
 * tier returns 429 and this route then 503s), a student mid-consultation is
 * better served by generic coaching than by an error, and this costs nothing and
 * cannot rate-limit.
 *
 * The live AI path below is left intact and is reached the moment this flag is
 * false, so restoring it is a one-line change rather than a rewrite. Set
 * ASK_REASON_USE_AI=true in the environment to turn it back on for one box
 * without editing code.
 *
 * Note what this gives up: the answer ignores `query`, the transcript and the
 * scenario entirely. A student asking "why did you rule out radiculopathy?"
 * gets the same paragraph as one asking "what should I do next?". It is a
 * holding pattern, not a working coach.
 */
const standardResponseEnabled = () =>
  !["true", "1", "yes"].includes(String(process.env.ASK_REASON_USE_AI).toLowerCase());

/*
 * Written to be true of any consultation and useful in most: it points at
 * method rather than at findings, since it cannot know the findings. Kept to the
 * shape a real coach answer takes so the simulator's rendering is unchanged.
 */
const STANDARD_RESPONSE = [
  "Work from what the patient has actually told you rather than from the diagnosis you expect.",
  "",
  "Start by laying out the history you have: where the pain is, how long it has been there, what brings it on and what settles it, and how it is affecting sleep, work and daily activities. Then ask what is still missing — most reasoning gaps at this stage are missing information, not faulty logic.",
  "",
  "Screen for red flags explicitly before you commit to a mechanical explanation: unexplained weight loss, night pain, trauma, neurological symptoms such as numbness, weakness or pins and needles, and any history of cancer or inflammatory disease. Say out loud which ones you have cleared.",
  "",
  "Then hold two or three explanations side by side rather than one. For each, name the finding that would support it and the finding that would argue against it, and decide which question or movement test would best tell them apart. That is the step that turns a guess into reasoning.",
  "",
  "Before you offer a diagnosis or a plan, summarise what you have heard back to the patient and check you have it right. It catches your own errors, and it tells the patient you were listening.",
].join("\n");

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
  /*
   * startTrace logs the request line and the raw body. The failures worth
   * diagnosing on this route are malformed requests — a caller sending the wrong
   * Content-Type reached the handler with an empty body, and the access log showed
   * only a 400 with no hint that the header was the cause. It also carries the
   * correlator: the simulator calls this route concurrently for different
   * students, so without one the log is interleaved fragments.
   */
  const trace = startTrace("ask-reason", req);

  const input = readInput(req);

  /*
   * The payload *after* readInput has recovered it from a text/plain body or a
   * form-urlencoded key, which is often not what the raw body looked like. Both
   * are logged, because the difference between them is the bug.
   */
  trace.log("payload after parsing", input);

  const query = String(pick(input, "query") ?? "").trim();
  const scenarioId = String(pick(input, "scenarioId") ?? "").trim();
  const sessionId = String(pick(input, "sessionId") ?? "").trim();

  // Aliases mean a field can arrive under two names; this says which one won.
  trace.log("fields resolved from the payload", {
    query,
    scenarioId,
    sessionId,
    transcriptionType: Array.isArray(pick(input, "transcription"))
      ? `array[${pick(input, "transcription").length}]`
      : typeof pick(input, "transcription"),
  });

  /*
   * Answered before validation and before any lookup, so a bare POST with no body
   * at all still gets coaching. The fixed script does not read query, scenarioId
   * or sessionId, so requiring them would only manufacture a 400 for a request
   * this route can in fact answer — which is exactly what was happening: the
   * simulator sends no sessionId, and every call was being rejected.
   *
   * Nothing is validated, looked up or awaited here, so the coach cannot 400 on a
   * thin request, 404 on an unknown scenario, 503 on a spent quota, or hang on a
   * slow Mongo.
   *
   * What arrived is still logged, because a caller that has stopped sending
   * sessionId is worth knowing about even while it is being tolerated — and it
   * has to be fixed before the AI path below is switched back on, which needs it.
   */
  if (standardResponseEnabled()) {
    const absent = Object.entries({ query, scenarioId, sessionId })
      .filter(([, value]) => !value)
      .map(([field]) => field);

    trace.log("ASK_REASON_USE_AI is off — answering from the fixed script, no AI call", {
      toleratedMissing: absent,
      responseChars: STANDARD_RESPONSE.length,
    });
    return trace.send(res, 200, { response: STANDARD_RESPONSE });
  }

  const missing = Object.entries({ query, scenarioId, sessionId })
    .filter(([, value]) => !value)
    .map(([field]) => field);

  if (missing.length) {
    // The access log shows only a bare 400, so record what the caller did send.
    trace.warn("rejected: the AI path needs these fields", { missing });
    return trace.send(res, 400, {
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
    trace.warn("scenarioId is neither a legacy code nor an ObjectId", { scenarioId });
    return trace.send(res, 400, {
      message: `'scenarioId' is not a valid id: ${scenarioId}`,
    });
  }

  try {
    const scenario = legacyScenario || (await Scenario.findById(scenarioId).lean());

    if (!scenario) {
      trace.warn("no scenario with that id", { scenarioId });
      return trace.send(res, 404, {
        message: `No scenario found with scenarioId: ${scenarioId}`,
      });
    }

    trace.log(
      `resolved the scenario from ${legacyScenario ? "the legacy table" : "Mongo"}`,
      scenario,
    );

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
      trace.warn("no session stored for that session_id, using the request transcript", {
        sessionId,
        transcriptChars: transcriptionText.length,
      });
    }

    trace.log("assembled the coach input", {
      transcriptFrom: pick(input, "transcription")
        ? "request"
        : session
          ? "stored"
          : "none",
      transcriptChars: transcriptionText.length,
      queryChars: query.length,
    });

    /*
     * The transcript and the student's question are patient-consultation
     * material, so the text itself stays behind AI_DEBUG_LOG while the counts
     * above are always logged. Turn it on to diagnose a bad answer, on one box,
     * temporarily.
     */
    if (logContent()) {
      trace.log("query text", excerpt(query));
      trace.log("transcript text", excerpt(transcriptionText, 1500));
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
    // Prompt size is the usual cause of a slow or truncated answer, and it grows
    // with the transcript rather than with anything visible in the request.
    trace.log("calling the AI provider", {
      systemPromptChars: ASK_REASON_PROMPT.length,
      userQueryChars: userQuery.length,
    });

    const aiStartedAt = Date.now();
    const { text, provider, model } = await generateTextWithFallback({
      systemPrompt: ASK_REASON_PROMPT,
      userQuery,
    });
    const aiMs = Date.now() - aiStartedAt;

    // Which provider answered matters: it is how you tell a working Gemini from a
    // silent permanent failover to Groq.
    trace.log(`answered by ${provider} (${model})`, {
      chars: text.length,
      aiMs,
    });

    // An empty answer still returns 200, so it would otherwise look like success
    // while the student sees a blank coach.
    if (!text.trim()) {
      trace.warn(`${provider} returned an empty answer — the student will see nothing`);
    }

    if (logContent()) trace.log("answer text", excerpt(text, 1500));

    return trace.send(res, 200, { response: text });
  } catch (err) {
    // trace.fail carries the status and provider detail the bare stack does not:
    // this is where a Gemini 429 with no Groq key configured surfaces, and it does
    // not otherwise say which provider gave up or how long was spent first.
    trace.fail(err);
    return trace.send(res, 503, {
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
