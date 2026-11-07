/**
 * Runs simulator sessions on Voxio. Same functions, same behaviour and same
 * replies as utils/simEngine.js (our own engine on the dev branch), so the
 * routes and the game do not change: only where the conversation runs does.
 *
 * Voxio holds the conversation (see utils/voxioFlow.js for the graph). This
 * file keeps a small mirror in SimConversation (scenario, phase, turns) so it
 * knows which phase a session is in, and copies Voxio's results onto the
 * Session row the dashboards read: transcript, feedback, score, per-question
 * results and the self-reflection.
 */
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import SimConversation from "../models/simConversationModel.js";
import {
  END_OF_REFLECTION,
  END_SESSION_INPUT,
  START_OF_REFLECTION,
  httpError,
  numberedTranscript,
  scenarioFor,
  resolveScenarioId,
} from "./simEngine.js";
import { getVoxioState, sendTurn, startVoxioSession } from "./voxioClient.js";
import { gradingOf, reasoningTurnsOf, reflectionOf, reflectionTurnsOf, transcriptOf } from "./voxioState.js";
import { ensureFlow } from "./voxioSync.js";

export { END_SESSION_INPUT, START_OF_REFLECTION, END_OF_REFLECTION, httpError };
export const GREETING = "Hi";
export const isValidSessionId = (id) => typeof id === "string" && id.length > 0 && id.length <= 64;

const GRADING_TIMEOUT_MS = Number(process.env.VOXIO_GRADING_TIMEOUT_MS) || 120000;
const POLL_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- one session at a time -------------------------------------------------

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

// ---- mirror and dashboard record ---------------------------------------------

export const getConversation = async (sessionId, { apiKey, create = true } = {}) => {
  const existing = await SimConversation.findOne({ session_id: sessionId });
  if (existing || !create) return existing;
  const scenarioId = await resolveScenarioId(sessionId, apiKey);
  if (!scenarioId) throw httpError(404, "No simulator session with that session_id.");
  try {
    return await SimConversation.create({ session_id: sessionId, scenario_id: scenarioId });
  } catch (err) {
    if (err.code === 11000) return SimConversation.findOne({ session_id: sessionId });
    throw err;
  }
};

/**
 * Copy everything Voxio has for a session onto SimConversation and the Session
 * row. Called after each turn (in the background) and by the webhook, so a
 * session run straight against Voxio (voice) lands on the dashboard too.
 * Resolves to what was found.
 */
export const syncFromVoxio = async (sessionId, givenState) => {
  const state = givenState || (await getVoxioState(sessionId));
  if (!state) return null;
  const conv = await SimConversation.findOne({ session_id: sessionId }).lean();
  const scenarioId = conv?.scenario_id || (await resolveScenarioId(sessionId));
  if (!scenarioId) return null;
  const { questionList } = await scenarioFor(scenarioId);

  const transcription = transcriptOf(state);
  const grading = gradingOf(state, questionList);
  const reflection = reflectionOf(state);

  const mirror = {
    diagnosis_history: transcription,
    reflection_history: reflectionTurnsOf(state),
    reasoning_history: reasoningTurnsOf(state),
    end_diagnosis: state.end_diagnosis === "yes" ? "yes" : "no",
    ...(grading && { feedback: grading.feedback, score: grading.score, question_results: grading.question_results }),
    ...(reflection && { reflection: { ...reflection, completed_at: conv?.reflection?.completed_at || new Date() } }),
  };
  await SimConversation.updateOne(
    { session_id: sessionId },
    { $set: mirror, $setOnInsert: { scenario_id: String(scenarioId) } },
    { upsert: true },
  );
  await Session.updateOne(
    { session_id: sessionId },
    {
      $set: {
        transcription,
        ...(grading && {
          feedback: grading.feedback,
          score: Number.isFinite(grading.score) ? grading.score : 0,
          question_results: grading.question_results,
        }),
        ...(mirror.reflection && { reflection: mirror.reflection }),
      },
    },
  ).catch((err) => console.error(`[VOXIO] could not update Session ${sessionId}: ${err.message}`));
  return { state, transcription, grading, reflection };
};

/** Sync once the turn's remaining Voxio steps (grading, summaries) have finished. */
const syncWhenDone = (sessionId, done) =>
  Promise.resolve(done)
    .then(() => syncFromVoxio(sessionId))
    .catch((err) => console.error(`[VOXIO] sync after turn failed session=${sessionId}: ${err.message}`));

const setPhase = (sessionId, phase) => SimConversation.updateOne({ session_id: sessionId }, { $set: { phase } });

// ---- start -------------------------------------------------------------------

/**
 * POST /agents/start_session: start the scenario behind api_key on Voxio under
 * this session_id. Resolves to { conv, speak }, or null for an unknown key.
 */
export const startSession = async (sessionId, apiKey) => {
  let scenario = await Scenario.findOne({ apiKey }).select("_id apiKey voxioSync").lean();
  if (!scenario) return null;
  const flowKey = await ensureFlow(scenario);
  const speak = await startVoxioSession(flowKey, sessionId);
  const conv = await SimConversation.findOneAndUpdate(
    { session_id: sessionId },
    {
      $set: {
        scenario_id: String(scenario._id),
        phase: "consultation",
        diagnosis_history: [],
        reasoning_history: [],
        reflection_history: [],
        feedback: "",
        score: null,
        question_results: [],
        end_diagnosis: "no",
      },
      $unset: { reflection: "" },
    },
    { upsert: true, new: true },
  );
  return { conv, speak: speak || GREETING };
};

// ---- consultation --------------------------------------------------------------

const noSession = (err) => {
  if (err.statusCode === 404 || err.voxioStatus === 404) throw httpError(404, "Session not found or expired");
  throw err;
};

/** One consultation turn. Resolves to { speak, end_diagnosis, movement, expression }. */
export const patientTurn = (sessionId, userInput) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, { create: false });
    if (!conv) throw httpError(404, "Session not found or expired");
    if (conv.phase !== "consultation") throw httpError(409, "This consultation has already ended.");
    const text = String(userInput || "").trim();
    if (!text) throw httpError(400, "user_input is empty.");

    const turn = await sendTurn(sessionId, text).catch(noSession);
    const out = turn.out || {};
    const endDiagnosis = String(out.end_diagnosis).toLowerCase() === "yes" ? "yes" : "no";
    if (endDiagnosis === "yes") await setPhase(sessionId, "reasoning");
    syncWhenDone(sessionId, turn.done);
    return {
      speak: turn.speak,
      end_diagnosis: endDiagnosis,
      movement: Array.isArray(out.movement) ? out.movement : [],
      expression: out.expression || "neutral",
    };
  });

/** Make sure the consultation is over in Voxio (the patient said goodbye). */
const endConsultation = async (sessionId, conv) => {
  if (conv.phase !== "consultation") return;
  for (let attempt = 0; attempt < 2; attempt++) {
    const turn = await sendTurn(sessionId, END_SESSION_INPUT).catch(noSession);
    syncWhenDone(sessionId, turn.done);
    if (String(turn.out?.end_diagnosis).toLowerCase() === "yes") break;
    console.warn(`[VOXIO] patient did not end the session on attempt ${attempt + 1} session=${sessionId}`);
  }
  await setPhase(sessionId, "reasoning");
  conv.phase = "reasoning";
};

/** Wait for Voxio's grading step to write feedback, then record it. */
const waitForGrading = async (sessionId) => {
  const until = Date.now() + GRADING_TIMEOUT_MS;
  for (;;) {
    const found = await syncFromVoxio(sessionId);
    if (!found) throw httpError(404, "Session not found or expired");
    if (found.grading) return found.grading;
    if (Date.now() > until) throw httpError(504, "The feedback is taking too long. Try again in a moment.");
    await sleep(POLL_MS);
  }
};

/**
 * End the consultation (if the patient has not already) and return the
 * feedback. Idempotent: a repeat call returns the same feedback.
 */
export const endAndGrade = async (sessionId) => {
  const conv = await getConversation(sessionId, { create: false });
  if (!conv) throw httpError(404, "No simulator session with that session_id.");
  const repeated = Boolean(conv.feedback);
  await serial(sessionId, () => endConsultation(sessionId, conv));
  const { feedback, score } = await waitForGrading(sessionId);
  return { feedback, score, repeated };
};

// ---- self-reflection -------------------------------------------------------------

/**
 * The learner pressed End Session: end the consultation in Voxio (grading
 * starts there, in the background) and open the reflection guide. Calling it
 * again while the reflection runs repeats the guide's last line.
 */
export const startReflection = (sessionId) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, { create: false });
    if (!conv) throw httpError(404, "Session not found or expired");
    if (conv.reflection?.status || (conv.phase === "reasoning" && conv.reflection_history.length)) {
      throw httpError(409, "The reflection for this session is already finished.");
    }
    if (conv.phase === "reflection" && conv.reflection_history.length) {
      return [...conv.reflection_history].reverse().find((t) => t.role === "assistant")?.content || "";
    }
    await endConsultation(sessionId, conv);
    // The guide gets a clean, numbered transcript with the opening marker,
    // rather than Voxio's raw history (which holds the hidden case brief).
    const state = await getVoxioState(sessionId);
    const said = transcriptOf(state).filter((t) => t.content !== END_SESSION_INPUT);
    const opening = `${START_OF_REFLECTION}

Session transcript:
${numberedTranscript(said) || "(The learner did not speak.)"}`;
    const turn = await sendTurn(sessionId, opening).catch(noSession);
    await SimConversation.updateOne(
      { session_id: sessionId },
      { $set: { phase: "reflection", reflection_history: [{ role: "assistant", content: turn.speak }] } },
    );
    return turn.speak;
  });

/**
 * One reflection turn. [END_OF_REFLECTION] gets the closing line straight
 * back; Voxio writes the summary afterwards and syncWhenDone records it.
 */
export const reflectionTurn = (sessionId, input) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, { create: false });
    if (!conv) throw httpError(404, "Session not found or expired");
    if (conv.phase !== "reflection") throw httpError(409, "No reflection is running for this session.");
    const text = String(input);
    const turn = await sendTurn(sessionId, text).catch(noSession);
    if (text.trim() === END_OF_REFLECTION) {
      await setPhase(sessionId, "reasoning");
      syncWhenDone(sessionId, turn.done);
    } else {
      await SimConversation.updateOne(
        { session_id: sessionId },
        { $push: { reflection_history: { $each: [{ role: "user", content: text }, { role: "assistant", content: turn.speak }] } } },
      );
    }
    return turn.speak;
  });

// ---- clinical reasoning ------------------------------------------------------------

/** One clinical-reasoning turn, after feedback. Resolves to { response }. */
export const reasoningTurn = (sessionId, input) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, { create: false });
    if (!conv) throw httpError(404, "No simulator session with that session_id.");
    if (conv.phase === "consultation") {
      throw httpError(409, "Call /api/sessions/feedback for this session before clinical reasoning.");
    }
    if (conv.phase === "reflection") throw httpError(409, "Finish the reflection before clinical reasoning.");
    // The tutor reads the feedback, so it must exist in Voxio first.
    if (!conv.feedback) await waitForGrading(sessionId);
    const turn = await sendTurn(sessionId, String(input)).catch(noSession);
    syncWhenDone(sessionId, turn.done);
    return { response: turn.speak };
  });

/** GET /agents/session: Voxio's own state for the session. */
export const sessionState = (sessionId) => getVoxioState(sessionId);
