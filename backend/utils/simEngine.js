/**
 * The simulator's conversation engine: plays the patient, grades the
 * consultation and runs the clinical-reasoning tutor. Replaces the Voxio flow
 * (greeting -> patient -> judge -> feedback -> reasoning) with direct LLM calls,
 * using the same prompts.
 *
 * State lives in SimConversation, keyed by the session_id that
 * POST /api/sessions/start or POST /api/scenarios/json mints. Results are also
 * written onto the matching Session row, which is what the dashboards read.
 */
import { readFileSync } from "fs";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import SimConversation from "../models/simConversationModel.js";
import { getLiveScenario, getLiveMeta } from "../state/liveScenario.js";
import { htmlToText, questionsToArray } from "./bubbleScenario.js";
import { decodeEntities } from "./richText.js";
import { chatJson } from "./simLlm.js";

/*
 * The exact turn that ends the consultation. The game sends it through the
 * patient channel, and POST /api/sessions/feedback treats it as "end now".
 */
export const END_SESSION_INPUT = "Let's end the session";

export const GREETING = "Hi";

const readPrompt = (file) =>
  readFileSync(new URL(`../ai/prompts/${file}`, import.meta.url), "utf8");

const PATIENT_FIELDS = readPrompt("sim-patient.md").replaceAll("{{END_SESSION_INPUT}}", END_SESSION_INPUT);
const FEEDBACK_PROMPT = readPrompt("sim-feedback.md");
const REASONING_PROMPT = readPrompt("sim-reasoning.md");

const SCHEMAS = {
  patient: {
    type: "OBJECT",
    properties: {
      speak: { type: "STRING" },
      movement: { type: "ARRAY", items: { type: "STRING" } },
      end_diagnosis: { type: "STRING", enum: ["yes", "no"] },
    },
    required: ["speak", "end_diagnosis"],
  },
  feedback: {
    type: "OBJECT",
    properties: { feedback: { type: "STRING" }, score: { type: "NUMBER" } },
    required: ["feedback", "score"],
  },
  reasoning: {
    type: "OBJECT",
    properties: { response: { type: "STRING" } },
    required: ["response"],
  },
};

export const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// ---- scenario --------------------------------------------------------------

const scenarioCache = new Map(); // id -> { at, brief, questions }
const SCENARIO_TTL_MS = 60_000;

/** The patient brief and grading questions, as plain text. */
const scenarioFor = async (scenarioId) => {
  const hit = scenarioCache.get(scenarioId);
  if (hit && Date.now() - hit.at < SCENARIO_TTL_MS) return hit;

  const scenario = await Scenario.findById(scenarioId).select("scenarioPrompt aiQuestions").lean();
  if (!scenario) throw httpError(404, "The scenario for this session no longer exists.");

  const brief = htmlToText(decodeEntities(scenario.scenarioPrompt || ""));
  const questions = questionsToArray(decodeEntities(scenario.aiQuestions || ""))
    .map((q, i) => `${i + 1}. ${q.replace(/^\d+[.)]\s*/, "")}`)
    .join(" ");
  const entry = { at: Date.now(), brief, questions };
  scenarioCache.set(scenarioId, entry);
  return entry;
};

/**
 * Which scenario a session belongs to: the student's Session row, else the
 * live slot (an educator's Test run), else a scenario looked up by the api_key
 * the game was handed.
 */
const resolveScenarioId = async (sessionId, apiKey) => {
  const row = await Session.findOne({ session_id: sessionId }).select("scenario_id").lean();
  if (row?.scenario_id) return row.scenario_id;

  const live = getLiveScenario();
  if (live && String(getLiveMeta().sessionId) === sessionId) return String(live._id);

  if (apiKey) {
    const byKey = await Scenario.findOne({ apiKey }).select("_id").lean();
    if (byKey) return String(byKey._id);
  }
  return null;
};

/** The conversation for a session, created on first use. */
export const getConversation = async (sessionId, { apiKey, create = true } = {}) => {
  const existing = await SimConversation.findOne({ session_id: sessionId });
  if (existing || !create) return existing;

  const scenarioId = await resolveScenarioId(sessionId, apiKey);
  if (!scenarioId) throw httpError(404, "No simulator session with that session_id.");
  try {
    return await SimConversation.create({ session_id: sessionId, scenario_id: scenarioId });
  } catch (err) {
    // Two first turns racing: the loser reads the winner's row.
    if (err.code === 11000) return SimConversation.findOne({ session_id: sessionId });
    throw err;
  }
};

/**
 * POST /agents/start_session: bind a session to the scenario behind api_key and
 * start it from the beginning. Starting an existing session_id again resets
 * it, as Voxio did. Resolves to null when no scenario has that key.
 */
export const startSession = async (sessionId, apiKey) => {
  const scenario = await Scenario.findOne({ apiKey }).select("_id").lean();
  if (!scenario) return null;
  return SimConversation.findOneAndUpdate(
    { session_id: sessionId },
    {
      $set: {
        scenario_id: String(scenario._id),
        phase: "consultation",
        diagnosis_history: [],
        reasoning_history: [],
        feedback: "",
        score: null,
        end_diagnosis: "no",
      },
    },
    { upsert: true, new: true },
  );
};

// ---- one session at a time -------------------------------------------------

/*
 * Turns for the same session run one after another. The game can retry a turn
 * it thinks timed out, and two turns appending to the history at once would
 * lose one. Per process: fine for the single pm2 backend instance.
 */
const queues = new Map();
const serial = (sessionId, work) => {
  const previous = queues.get(sessionId) || Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  queues.set(sessionId, next);
  next.finally(() => {
    if (queues.get(sessionId) === next) queues.delete(sessionId);
  }).catch(() => {});
  return next;
};

// ---- dashboard record ------------------------------------------------------

const saveToSession = async (conv) => {
  await Session.updateOne(
    { session_id: conv.session_id },
    {
      $set: {
        transcription: conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
        feedback: conv.feedback || "",
        score: Number.isFinite(conv.score) ? conv.score : 0,
      },
    },
  ).catch((err) => console.error(`[SIM] could not update Session ${conv.session_id}: ${err.message}`));
};

// ---- the three phases ------------------------------------------------------

/** Clamp the grader's score into [0, 1]; null when it gave none. */
const toScore = (value) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n)
    ? null
    : Math.min(Math.max(n, 0), 1);
};

/*
 * Models sometimes return the paragraphs joined by spaces despite the prompt.
 * Three or more spaces between sentences is where a blank line was meant.
 */
const fixParagraphs = (text) => String(text || "").replace(/([.!?"'”])\s{3,}/g, "$1\n\n").trim();

const grade = async (conv) => {
  const { brief, questions } = await scenarioFor(conv.scenario_id);
  const history = [
    { role: "system", content: brief },
    ...conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
  ];
  const { data, usage } = await chatJson({
    label: `feedback session=${conv.session_id}`,
    system: FEEDBACK_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({ diagnosis_conversation_history: history, feedback_questions: questions }),
      },
    ],
    schema: SCHEMAS.feedback,
    effort: "medium",
  });
  if (!String(data.feedback || "").trim()) throw httpError(502, "The grader returned no feedback.");

  conv.feedback = fixParagraphs(data.feedback);
  conv.score = toScore(data.score);
  conv.phase = "reasoning";
  await conv.save();
  await saveToSession(conv);
  return { feedback: conv.feedback, score: conv.score, usage };
};

/**
 * One consultation turn: the student's words in, the patient's reply out.
 * When the patient ends the visit, the consultation is graded in the same turn
 * (as the Voxio flow did) and `result` carries the feedback.
 */
export const patientTurn = (sessionId, userInput, opts = {}) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, opts);
    if (conv.phase !== "consultation") {
      throw httpError(409, "This consultation has already ended.");
    }

    const text = String(userInput || "").trim();
    if (!text) throw httpError(400, "user_input is empty.");

    const { brief } = await scenarioFor(conv.scenario_id);
    const messages = [
      ...conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
      { role: "user", content: text },
    ];
    const { data, usage } = await chatJson({
      label: `patient session=${sessionId}`,
      system: brief + PATIENT_FIELDS,
      messages,
      schema: SCHEMAS.patient,
      effort: "low",
    });

    const speak = String(data.speak ?? "").trim();
    if (!speak) throw httpError(502, "The patient returned no reply.");
    const endDiagnosis = String(data.end_diagnosis).toLowerCase() === "yes" ? "yes" : "no";

    conv.diagnosis_history.push({ role: "user", content: text }, { role: "assistant", content: speak });
    conv.end_diagnosis = endDiagnosis;
    await conv.save();
    await saveToSession(conv);

    const reply = { speak, end_diagnosis: endDiagnosis, movement: [], usage };
    if (endDiagnosis === "yes") reply.result = await grade(conv);
    return reply;
  });

/**
 * End the consultation and grade it. Idempotent: a repeat call returns the
 * feedback already produced instead of grading again.
 */
export const endAndGrade = (sessionId, opts = {}) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, opts);
    if (conv.feedback) return { feedback: conv.feedback, score: conv.score, repeated: true };
    return grade(conv);
  });

/** One clinical-reasoning turn, after feedback. Resolves to { response, usage }. */
export const reasoningTurn = (sessionId, input) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, { create: false });
    if (!conv) throw httpError(404, "No simulator session with that session_id.");
    if (!conv.feedback) {
      throw httpError(409, "Call /api/sessions/feedback for this session before clinical reasoning.");
    }

    const { brief, questions } = await scenarioFor(conv.scenario_id);
    const context = {
      diagnosis_conversation_history: [
        { role: "system", content: brief },
        ...conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
      ],
      feedback: conv.feedback,
      feedback_questions: questions,
    };
    const messages = [
      { role: "user", content: `Context for this tutoring conversation:\n${JSON.stringify(context)}` },
      { role: "assistant", content: JSON.stringify({ response: "Understood. Ask me anything about your consultation." }) },
      ...conv.reasoning_history.map(({ role, content }) => ({ role, content })),
      { role: "user", content: JSON.stringify({ user_input: String(input) }) },
    ];
    const { data, usage } = await chatJson({
      label: `reasoning session=${sessionId}`,
      system: REASONING_PROMPT,
      messages,
      schema: SCHEMAS.reasoning,
      effort: "low",
    });

    const response = String(data.response ?? data.speak ?? "").trim();
    if (!response) throw httpError(502, "The reasoning tutor returned no reply.");
    conv.reasoning_history.push(
      { role: "user", content: String(input) },
      { role: "assistant", content: response },
    );
    await conv.save();
    return { response, usage };
  });

/**
 * Everything about a session in the shape Voxio's GET /agents/session used to
 * return, so anything still reading that shape keeps working.
 */
export const voxioStyleState = (conv) =>
  conv && {
    diagnosis_conversation_history: conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
    reasoning_conversation_history: conv.reasoning_history.map(({ role, content }) => ({ role, content })),
    feedback: conv.feedback || undefined,
    score: conv.score,
    end_diagnosis: conv.end_diagnosis,
    speak: [...conv.diagnosis_history].reverse().find((t) => t.role === "assistant")?.content ?? GREETING,
    response: [...conv.reasoning_history].reverse().find((t) => t.role === "assistant")?.content,
    node_type: conv.phase,
  };

export const isValidSessionId = (id) => typeof id === "string" && id.length > 0 && id.length <= 64;
