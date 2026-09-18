/**
 * Voxio is the conversation engine that actually runs a scenario with a student.
 *
 * A scenario is published to Voxio as a "flow" — a node graph (greeting → input
 * → llm → feedback) built from backend/ai/voxioWorkflow.json with the generated
 * patient persona injected. Voxio returns an api_key which identifies that flow
 * from then on; it is stored on Scenario.apiKey and is what an edit targets.
 */
import { readFileSync } from "fs";
import { isProd } from "./appEnv.js";

const VOXIO_BASE_URL = process.env.VOXIO_BASE_URL || "https://database.voxio.in";

// Voxio splits authoring (database.*) from the live conversation runtime
// (chat.*). Session transcripts and scores come from the runtime.
const VOXIO_CHAT_BASE_URL =
  process.env.VOXIO_CHAT_BASE_URL || "https://chat.voxio.in";

export const assertVoxioConfigured = () => {
  if (!process.env.VOXIO_API_KEY) {
    throw new Error(
      "AI is not configured on the server: missing VOXIO_API_KEY in .env",
    );
  }
};

const workflowTemplate = JSON.parse(
  readFileSync(new URL("../ai/voxioWorkflow.json", import.meta.url), "utf8"),
);

/**
 * A fresh copy of the workflow with this scenario's persona and rubric in it.
 *
 * Parsed from the raw JSON each time rather than shared, so one request cannot
 * leak its system prompt into the next.
 */
export const buildWorkflow = ({ scenarioPrompt, feedbackQuestions }) => {
  const workflow = structuredClone(workflowTemplate);

  workflow.variables.feedback_questions.value = Array.isArray(feedbackQuestions)
    ? feedbackQuestions
        .map((question, index) => `${index + 1}. ${question}`)
        .join(" ")
    : feedbackQuestions || "";

  workflow.nodes.llm.parameters.system_prompt = scenarioPrompt || "";

  return workflow;
};

const request = async (path, { method, headers = {}, body }) => {
  const response = await fetch(`${VOXIO_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    console.error(`[AI] Voxio ${method} ${path} failed`, response.status, raw);
    throw new Error(
      isProd
        ? "The simulator service rejected this scenario."
        : `Voxio ${method} ${path} responded ${response.status}: ${raw.slice(0, 300)}`,
    );
  }

  return parsed ?? {};
};

/** Publish a new flow. Resolves to the api_key that identifies it. */
export const createFlow = async ({ flowName, workflow }) => {
  assertVoxioConfigured();

  const data = await request("/flow", {
    method: "POST",
    headers: { api_key: process.env.VOXIO_API_KEY },
    body: {
      agent: { workflow },
      flow_name: flowName,
      process_type: "speech-native",
      xml: "",
    },
  });

  const apiKey = data.api_key || "";
  if (!apiKey) {
    console.error("[AI] Voxio created a flow but returned no api_key", data);
    throw new Error("The simulator did not return a key for this scenario.");
  }

  return apiKey;
};

/**
 * What the simulator recorded for one finished session.
 *
 * Reads the flow's end state: the conversation history, the coach's written
 * feedback and the score. No api_key is required — the session id is the
 * credential, exactly as the Python service called it.
 */
export const fetchSessionState = async (sessionId) => {
  const url = `${VOXIO_CHAT_BASE_URL}/agents/session?session_id=${encodeURIComponent(sessionId)}`;

  /*
   * This call is the whole reason a finished session shows up on a dashboard, and
   * it is made from a callback nobody is watching — so when it fails or returns a
   * half-populated state, there is no user to report it. The logging below is
   * deliberately on the success path too: "feedback arrived but was empty" and
   * "the call never happened" look identical on a dashboard, and only the log
   * distinguishes them.
   */
  console.log(`[SESSION] fetching Voxio state for session=${sessionId}`);
  const startedAt = Date.now();

  const response = await fetch(url);
  const raw = await response.text();
  const elapsed = Date.now() - startedAt;

  if (!response.ok) {
    console.error(
      `[SESSION] Voxio session lookup failed session=${sessionId} status=${response.status} after ${elapsed}ms`,
      raw.slice(0, 500),
    );
    throw Object.assign(
      new Error(
        isProd
          ? "Session results are not available yet."
          : `Voxio session lookup responded ${response.status}: ${raw.slice(0, 300)}`,
      ),
      { statusCode: 502 },
    );
  }

  let body = null;
  try {
    body = JSON.parse(raw);
  } catch {
    console.error(
      `[SESSION] Voxio returned unparseable JSON session=${sessionId} bytes=${raw.length}`,
      raw.slice(0, 500),
    );
    throw Object.assign(new Error("Voxio returned an unreadable session payload."), {
      statusCode: 502,
    });
  }

  const state = body?.["session-data"]?.state;
  if (!state) {
    console.error(
      `[SESSION] Voxio payload had no session-data.state session=${sessionId} topLevelKeys=${Object.keys(body || {}).join(",")}`,
      raw.slice(0, 500),
    );
    throw Object.assign(new Error("Not able to find session logs."), {
      statusCode: 404,
    });
  }

  const result = {
    transcription: state.diagnosis_conversation_history,
    feedback: state.feedback,
    score: state.score,
  };

  /*
   * Lengths and presence, not contents: a transcript is patient-consultation
   * material and the feedback quotes it, so neither belongs in a log file that
   * gets shipped around. `turns=0` or `feedbackChars=0` is enough to tell a
   * missing coach result from a working one.
   */
  const turns = Array.isArray(result.transcription)
    ? result.transcription.length
    : 0;
  console.log(
    `[SESSION] Voxio state received session=${sessionId} in ${elapsed}ms ` +
      `turns=${turns} feedbackChars=${(result.feedback || "").length} ` +
      `score=${result.score ?? "absent"} stateKeys=${Object.keys(state).length}`,
  );
  if (!turns || !result.feedback) {
    console.warn(
      `[SESSION] incomplete result session=${sessionId} — ` +
        `${!turns ? "no conversation turns" : ""}${!turns && !result.feedback ? " and " : ""}` +
        `${!result.feedback ? "no coach feedback" : ""}. ` +
        "It will be stored as-is and the dashboard will show a session with nothing in it.",
    );
  }

  return result;
};

/** Replace the flow behind an existing api_key. */
export const updateFlow = async ({ apiKey, flowName, workflow }) => {
  assertVoxioConfigured();

  // Confirm the key resolves to a flow before overwriting it, so a stale or
  // wrong key fails with a clear error instead of a partial edit.
  await request("/flow", { method: "GET", headers: { api_key: apiKey } });

  return request("/edit-flow", {
    method: "PUT",
    headers: { api_key: apiKey, user_api_key: process.env.VOXIO_API_KEY },
    body: {
      agent: { workflow },
      flow_name: flowName,
      process_type: "speech-native",
      xml: "",
    },
  });
};

/**
 * One turn of /agents/process_input, left as a raw unconsumed fetch Response
 * so the caller can pipe response.body straight through to its own client
 * rather than buffering a payload that is deliberately streamed.
 *
 * Shared by streamEndSession (fixed user_input, ends the diagnosis phase) and
 * streamReasoningTurn (free-text user_input, drives the reasoning phase) —
 * both are just a turn on the same running flow, identified by session_id.
 */
const streamProcessInput = async (sessionId, userInput) => {
  const response = await fetch(`${VOXIO_CHAT_BASE_URL}/agents/process_input`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_input: { user_input: userInput },
      session_id: sessionId,
    }),
  });

  if (!response.ok || !response.body) {
    const raw = await response.text().catch(() => "");
    console.error(
      `[SESSION] Voxio process_input failed session=${sessionId}`,
      response.status,
      raw.slice(0, 500),
    );
    throw Object.assign(
      new Error(
        isProd
          ? "The simulator could not process this input."
          : `Voxio process_input responded ${response.status}: ${raw.slice(0, 300)}`,
      ),
      { statusCode: 502 },
    );
  }

  return response;
};

/**
 * Push the running flow straight to its feedback/reasoning phase and stream
 * back whatever Voxio says as it says it.
 *
 * "Let's end the session" is sent as the turn's `user_input` — the same
 * channel a spoken turn would use — because there is no other lever exposed by
 * /agents/process_input to skip ahead; the flow's own
 * judge_if_diagnosis_is_ended node is what actually reacts to it.
 */
export const streamEndSession = (sessionId) =>
  streamProcessInput(sessionId, "Let's end the session");

/**
 * One turn of the clinical-reasoning conversation: the student's free-text
 * input, streamed straight to Voxio's `reasoning` node and its reply streamed
 * straight back — no separate askReasonRoutes-style LLM call of our own.
 */
export const streamReasoningTurn = (sessionId, input) =>
  streamProcessInput(sessionId, input);
