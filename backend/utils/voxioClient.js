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
/*
 * The exact turn POST /api/sessions/feedback sends to end the consultation.
 * The patient prompt below keys end_diagnosis off this string, so the two must
 * stay identical.
 */
export const END_SESSION_INPUT = "Let's end the session";

/*
 * Appended to every scenario's patient prompt. The scenario text replaces the
 * template's system_prompt wholesale, which used to drop the only instruction
 * for end_diagnosis — so whether /feedback actually reached the feedback node
 * was left to the model's guess, and a "no" sent back a patient reply instead
 * of feedback.
 */
const PATIENT_OUTPUT_FIELDS = `

# OUTPUT FIELDS
- speak: exactly what you say out loud as the patient.
- movement: always an empty list [].
- end_diagnosis: "yes" only if the input is exactly "${END_SESSION_INPUT}" or the student clearly ends the visit (says goodbye, "that's all for today", "we're done"). Otherwise "no". Always lowercase, never anything else. When it is "yes", speak a brief, natural goodbye.`;

export const buildWorkflow = ({ scenarioPrompt, feedbackQuestions }) => {
  const workflow = structuredClone(workflowTemplate);

  workflow.variables.feedback_questions.value = Array.isArray(feedbackQuestions)
    ? feedbackQuestions
        .map((question, index) => `${index + 1}. ${question}`)
        .join(" ")
    : feedbackQuestions || "";

  // The template's patient prompt holds only the JSON-output protocol; the
  // scenario and the field rules go in front of it rather than replacing it.
  workflow.nodes.llm.parameters.system_prompt =
    (scenarioPrompt || "") +
    PATIENT_OUTPUT_FIELDS +
    workflowTemplate.nodes.llm.parameters.system_prompt;

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
/**
 * The flow's raw state for a session (every workflow variable), or null when
 * Voxio has no such session. Used to tell which phase a run is in — feedback
 * already produced or not — before sending it another turn.
 */
/*
 * How long one Voxio call may take, end to end (an LLM turn included). Without
 * a limit a stalled Voxio call hangs the request until the game gives up, and
 * the log shows nothing at all for that request.
 */
const VOXIO_TIMEOUT_MS = Number(process.env.VOXIO_TIMEOUT_MS) || 90000;

/**
 * fetch() to Voxio with a timeout, and a network failure turned into an error
 * that says what actually happened (timeout, refused, reset, DNS) instead of
 * Node's bare "fetch failed".
 */
const voxioFetch = async (label, url, init = {}) => {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(VOXIO_TIMEOUT_MS) });
    console.log(
      `[VOXIO] ${label} -> ${response.status} headers in ${Date.now() - startedAt}ms`,
    );
    return response;
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    const cause = err.cause?.code || err.cause?.message || "-";
    console.error(
      `[VOXIO] ${label} FAILED after ${elapsed}ms: ${err.name}: ${err.message} cause=${cause}` +
        (timedOut ? ` (timeout is ${VOXIO_TIMEOUT_MS}ms, VOXIO_TIMEOUT_MS)` : ""),
    );
    throw Object.assign(
      new Error(
        timedOut
          ? `Voxio did not answer within ${VOXIO_TIMEOUT_MS / 1000}s.`
          : `Could not reach Voxio (${cause}).`,
      ),
      { statusCode: timedOut ? 504 : 502 },
    );
  }
};

export const fetchRawSessionState = async (sessionId) => {
  const url = `${VOXIO_CHAT_BASE_URL}/agents/session?session_id=${encodeURIComponent(sessionId)}`;
  const response = await voxioFetch(`state session=${sessionId}`, url);
  const raw = await response.text();
  if (!response.ok) {
    console.error(
      `[SESSION] Voxio state read failed session=${sessionId} status=${response.status}`,
      raw.slice(0, 500),
    );
    throw Object.assign(new Error(`Voxio session lookup responded ${response.status}`), {
      statusCode: 502,
    });
  }
  try {
    return JSON.parse(raw)?.["session-data"]?.state ?? null;
  } catch {
    throw Object.assign(new Error("Voxio returned an unreadable session payload."), {
      statusCode: 502,
    });
  }
};

/**
 * A process_input stream body (NDJSON, one `{"out": {...}}` per emitting node)
 * -> the list of `out` objects in order. Lines that are not JSON or carry no
 * `out` are skipped.
 */
export const parseStreamOutputs = (text) => parseStreamLines(text).outputs;

/**
 * Same as parseStreamOutputs, but also returns every line that was not a node
 * output: Voxio's status lines (waiting_for_input, token usage), error objects,
 * and anything that was not JSON. Those are what explain a turn that produced
 * no output, so they have to reach the log rather than be dropped.
 */
export const parseStreamLines = (text) => {
  const outputs = [];
  const other = [];
  const unparseable = [];
  for (const line of String(text || "").split("\n").map((l) => l.trim()).filter(Boolean)) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.out === "object" && parsed.out) outputs.push(parsed.out);
      else other.push(parsed);
    } catch {
      unparseable.push(line);
    }
  }
  return { outputs, other, unparseable };
};

/**
 * Which phase a Voxio session is in, for the log: position in the flow, and
 * the presence/size of what each phase writes. Lengths rather than contents,
 * apart from the short control values.
 */
export const summariseState = (state) => {
  if (!state) return { exists: false };
  const len = (v) => (Array.isArray(v) ? v.length : v == null ? null : typeof v);
  return {
    exists: true,
    current_node: state.__current_node__ ?? null,
    step: state.step ?? null,
    node_type: state.node_type ?? null,
    end_diagnosis: state.end_diagnosis ?? null,
    feedback:
      typeof state.feedback === "string"
        ? `${state.feedback.length} chars`
        : state.feedback === undefined
          ? "absent"
          : `${typeof state.feedback}: ${JSON.stringify(state.feedback).slice(0, 80)}`,
    score: state.score ?? null,
    diagnosis_turns: len(state.diagnosis_conversation_history),
    reasoning_turns: len(state.reasoning_conversation_history),
    updated_vars: state.__updated_vars__ ?? null,
  };
};

/** A score as a number in [0, 1], or null when it is missing or not numeric. */
export const normaliseScore = (value) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n)
    ? null
    : n;
};

/** True once the feedback node has written its result into the state. */
export const hasFeedback = (state) =>
  typeof state?.feedback === "string" && state.feedback.trim() !== "";

/**
 * The latest coach reply from the reasoning phase: the last assistant entry in
 * its history, else the `response` the reasoning node last wrote. Never the
 * state's `speak`: that is the patient's line (their goodbye, after feedback).
 */
export const latestReasoningReply = (state) => {
  const history = Array.isArray(state?.reasoning_conversation_history)
    ? state.reasoning_conversation_history
    : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry?.role === "assistant" && entry.content) {
      // The node's raw output is the JSON it was told to return.
      try {
        const parsed = JSON.parse(entry.content);
        // `speak` for flows published before the rename to `response`.
        const text = parsed?.response ?? parsed?.speak;
        if (text) return String(text);
      } catch {
        // Plain text, use as-is.
      }
      return String(entry.content);
    }
  }
  return typeof state?.response === "string" ? state.response : "";
};

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
  const response = await voxioFetch(
    `process_input session=${sessionId} input=${JSON.stringify(String(userInput).slice(0, 60))}`,
    `${VOXIO_CHAT_BASE_URL}/agents/process_input`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_input: { user_input: userInput },
        session_id: sessionId,
      }),
    },
  );

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
  streamProcessInput(sessionId, END_SESSION_INPUT);

/**
 * One turn of the clinical-reasoning conversation: the student's free-text
 * input, streamed straight to Voxio's `reasoning` node and its reply streamed
 * straight back — no separate askReasonRoutes-style LLM call of our own.
 */
export const streamReasoningTurn = (sessionId, input) =>
  streamProcessInput(sessionId, input);
