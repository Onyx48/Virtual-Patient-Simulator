/**
 * Talks to Voxio, which runs every simulator conversation on this branch.
 *
 * Voxio has two services:
 *   - data (database.voxio.in): flows. One flow per scenario, holding its
 *     workflow (the conversation graph), voice and avatar settings. Its key is
 *     what Scenario.apiKey stores and what the game is handed.
 *   - chat (chat.voxio.in): the live conversation. start_session / process_input
 *     / session, the same calls the Unreal game makes.
 *
 * Our account lives on the original deployment (database.voxio.in with an
 * `api-key` header). The newer SDK (voxioagent/server) targets
 * gpu.data.voxio.in, where this account does not exist, so it is not used.
 */
import { isProd } from "./appEnv.js";

const DATA_URL = process.env.VOXIO_BASE_URL || "https://database.voxio.in";
const CHAT_URL = process.env.VOXIO_CHAT_BASE_URL || "https://chat.voxio.in";
const TIMEOUT_MS = Number(process.env.VOXIO_TIMEOUT_MS) || 90000;

export const isVoxioConfigured = () => Boolean(process.env.VOXIO_API_KEY);

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const assertConfigured = () => {
  if (!isVoxioConfigured()) throw httpError(503, "AI is not configured on the server: missing VOXIO_API_KEY in .env");
};

/** fetch() with a timeout and a readable error for network failures. */
const voxioFetch = async (label, url, init = {}) => {
  const startedAt = Date.now();
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs || TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    const cause = err.cause?.code || err.cause?.message || "-";
    console.error(`[VOXIO] ${label} failed after ${Date.now() - startedAt}ms: ${err.message} cause=${cause}`);
    throw httpError(timedOut ? 504 : 502, timedOut ? `Voxio did not answer within ${TIMEOUT_MS / 1000}s.` : `Could not reach Voxio (${cause}).`);
  }
};

const readJson = async (label, response) => {
  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    console.error(`[VOXIO] ${label} -> ${response.status}`, raw.slice(0, 400));
    throw httpError(
      response.status === 404 ? 404 : 502,
      isProd ? "The simulator service rejected the request." : `Voxio ${label} responded ${response.status}: ${raw.slice(0, 300)}`,
    );
  }
  return parsed ?? {};
};

// ---- flows (data service) --------------------------------------------------

/*
 * The flow body Voxio's data service takes. `agent.workflow` is the graph,
 * `agent["webhook-url"]` where it posts session events; stt / tts / faces /
 * transitions / process_type sit next to it.
 */
const flowBody = ({ name, workflow, webhookUrl, stt, tts, faces, transitions, processType }) => ({
  flow_name: name,
  agent: { workflow, ...(webhookUrl ? { "webhook-url": webhookUrl } : {}) },
  ...(stt ? { stt } : {}),
  ...(tts ? { tts } : {}),
  faces: faces || [],
  transitions: transitions || [],
  process_type: processType || "speech-native",
  xml: "",
});

/** Create a flow. Resolves to its key. */
export const createFlow = async (flow) => {
  assertConfigured();
  const res = await voxioFetch("create flow", `${DATA_URL}/flow`, {
    method: "POST",
    headers: { "Content-Type": "application/json", api_key: process.env.VOXIO_API_KEY },
    body: JSON.stringify(flowBody(flow)),
  });
  const data = await readJson("create flow", res);
  if (!data.api_key) throw httpError(502, "Voxio created a flow but returned no key.");
  return data.api_key;
};

/** Read a flow, or null when the key no longer resolves. */
export const getFlow = async (flowKey, keys) => {
  const query = keys?.length ? `?${keys.map((k) => `keys=${encodeURIComponent(k)}`).join("&")}` : "";
  const res = await voxioFetch("get flow", `${DATA_URL}/flow${query}`, { headers: { api_key: flowKey } });
  if (res.status === 404 || res.status === 500) return null;
  return readJson("get flow", res);
};

/** Replace an existing flow's settings. The key stays the same. */
export const updateFlow = async (flowKey, flow) => {
  assertConfigured();
  const res = await voxioFetch("update flow", `${DATA_URL}/flow`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      api_key: flowKey,
      user_api_key: process.env.VOXIO_API_KEY,
    },
    body: JSON.stringify(flowBody(flow)),
  });
  return readJson("update flow", res);
};

/** A key that looks like a Voxio flow key (not one of our old sim_ keys). */
export const isFlowKey = (key) => typeof key === "string" && key.length > 8 && !key.startsWith("sim_");

// ---- conversations (chat service) -----------------------------------------

/** One NDJSON line per emitting step: {"out": {...}}. Anything else is a status line. */
const parseLine = (line) => {
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed.out === "object" && parsed.out ? parsed.out : null;
  } catch {
    return null;
  }
};

/**
 * POST a chat call and read its streamed reply line by line.
 *
 * Resolves as soon as `until(out)` is true for a line (usually: a line with
 * `speak`), so the game hears the reply without waiting for silent steps that
 * run after it (grading, the reflection summary). The rest of the stream is
 * drained in the background, which is what lets those steps finish in Voxio.
 * `done` resolves with every output once the stream ends.
 */
const streamCall = async (label, path, body, { until } = {}) => {
  const res = await voxioFetch(label, `${CHAT_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    const err = httpError(res.status === 404 ? 404 : 502, `Voxio ${label} responded ${res.status}: ${raw.slice(0, 300)}`);
    err.voxioStatus = res.status;
    err.voxioBody = raw;
    throw err;
  }

  const outputs = [];
  let resolveFirst;
  const first = new Promise((resolve) => (resolveFirst = resolve));

  const done = (async () => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const take = (line) => {
      const out = parseLine(line.trim());
      if (!out) return;
      outputs.push(out);
      if (until?.(out)) resolveFirst(out);
    };
    try {
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          take(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      }
      if (buffer.trim()) take(buffer);
    } catch (err) {
      console.error(`[VOXIO] ${label} stream broke: ${err.message}`);
    }
    resolveFirst(null);
    return outputs;
  })();

  const firstOut = await first;
  return { first: firstOut, outputs, done };
};

const hasSpeak = (out) => typeof out.speak === "string" && out.speak.trim() !== "";

/** Start (or restart) a session on a flow. Resolves to the greeting line. */
export const startVoxioSession = async (flowKey, sessionId) => {
  const { first, done } = await streamCall("start_session", "/agents/start_session", { api_key: flowKey, session_id: sessionId }, { until: hasSpeak });
  if (first) return first.speak;
  const outputs = await done;
  return outputs.find(hasSpeak)?.speak ?? "";
};

/**
 * One turn. Resolves to { speak, out, outputs, done } as soon as something is
 * said; `done` resolves with every output of the turn.
 */
export const sendTurn = async (sessionId, text, { until = hasSpeak } = {}) => {
  const { first, outputs, done } = await streamCall(
    `process_input session=${sessionId}`,
    "/agents/process_input",
    { session_id: sessionId, user_input: { user_input: text } },
    { until },
  );
  const out = first || (await done).find(until) || null;
  return { speak: out?.speak ?? "", out, outputs, done };
};

/** Every workflow value of a session, or null when Voxio has no such session. */
export const getVoxioState = async (sessionId) => {
  const res = await voxioFetch(`state session=${sessionId}`, `${CHAT_URL}/agents/session?session_id=${encodeURIComponent(sessionId)}`, { timeoutMs: 20000 });
  if (res.status === 404) return null;
  const data = await readJson("session state", res);
  return data?.["session-data"]?.state ?? null;
};
