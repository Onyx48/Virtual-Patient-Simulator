/**
 * Multi-turn JSON chat calls for the simulator (patient, grader, reasoning
 * tutor). Replaces the LLM nodes that used to run inside Voxio.
 *
 * aiText.js covers one-shot calls (scenario generation); a consultation needs
 * the whole conversation sent as alternating turns, and a reply fast enough to
 * be spoken, so this calls the providers directly:
 *
 *   SIM_LLM_PROVIDER   groq | gemini. Default: groq when GROQ_API_KEY is set
 *                      (the same gpt-oss-120b Voxio ran), else gemini.
 *   GROQ_SIM_MODEL     default GROQ_MODEL, else openai/gpt-oss-120b
 *   GEMINI_SIM_MODEL   default gemini-2.5-flash
 *
 * The other provider is tried when the first fails, if it has a key.
 */
import { isProd } from "./appEnv.js";

const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const GROQ_SIM_MODEL = process.env.GROQ_SIM_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GEMINI_SIM_MODEL = process.env.GEMINI_SIM_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = Number(process.env.SIM_LLM_TIMEOUT_MS) || 60000;

const providers = () => {
  const available = [
    process.env.GROQ_API_KEY && "groq",
    process.env.GEMINI_API_KEY && "gemini",
  ].filter(Boolean);
  const preferred = (process.env.SIM_LLM_PROVIDER || "").toLowerCase();
  if (available.includes(preferred)) {
    return [preferred, ...available.filter((p) => p !== preferred)];
  }
  return available;
};

export const isSimLlmConfigured = () => providers().length > 0;

const fail = (provider, status, raw) =>
  Object.assign(
    new Error(
      isProd
        ? "The AI service is unavailable right now."
        : `${provider} responded ${status}: ${String(raw).slice(0, 300)}`,
    ),
    { status, statusCode: 502 },
  );

/** Parse a JSON object out of a reply, tolerating a fence or leading prose. */
const parseObject = (text) => {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("The AI reply was not JSON.");
  }
};

/*
 * gpt-oss reasons before answering. Low effort keeps a patient reply speakable
 * (under ~2s); the grader gets more room since nobody is waiting mid-sentence.
 */
const callGroq = async ({ system, messages, effort }) => {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_SIM_MODEL,
      messages: [{ role: "system", content: system }, ...messages],
      response_format: { type: "json_object" },
      reasoning_effort: effort,
      max_completion_tokens: 4096,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await response.text();
  if (!response.ok) throw fail("Groq", response.status, raw);
  const body = JSON.parse(raw);
  const u = body?.usage || {};
  return {
    data: parseObject(body?.choices?.[0]?.message?.content),
    // Groq reports exactly the fields Voxio passed through.
    usage: {
      prompt_tokens: u.prompt_tokens ?? 0,
      completion_tokens: u.completion_tokens ?? 0,
      queue_time: u.queue_time ?? 0,
      prompt_time: u.prompt_time ?? 0,
      completion_time: u.completion_time ?? 0,
      total_time: u.total_time ?? 0,
    },
  };
};

const callGemini = async ({ system, messages, schema, effort }) => {
  const response = await fetch(`${GEMINI_BASE_URL}/models/${GEMINI_SIM_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        // 2.5 models take a token budget, 3.x a level; low = answer at once.
        ...(GEMINI_SIM_MODEL.startsWith("gemini-2.5") && {
          thinkingConfig: { thinkingBudget: effort === "low" ? 0 : 1024 },
        }),
        ...(GEMINI_SIM_MODEL.startsWith("gemini-3") && {
          thinkingConfig: { thinkingLevel: effort === "low" ? "low" : "high" },
        }),
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await response.text();
  if (!response.ok) throw fail("Gemini", response.status, raw);
  const body = JSON.parse(raw);
  const parts = body?.candidates?.[0]?.content?.parts || [];
  const u = body?.usageMetadata || {};
  return {
    data: parseObject(parts.map((p) => p.text).join("")),
    // Gemini reports no timings; total_time is filled in by the caller.
    usage: {
      prompt_tokens: u.promptTokenCount ?? 0,
      completion_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      queue_time: 0,
      prompt_time: 0,
      completion_time: 0,
      total_time: 0,
    },
  };
};

/**
 * @param system    system prompt
 * @param messages  [{role: "user"|"assistant", content}] — must end on "user"
 * @param schema    Gemini responseSchema for the reply object
 * @param effort    "low" for the live patient, "medium" for grading
 * @returns {Promise<{data: object, usage: object, provider: string, ms: number}>}
 */
export const chatJson = async ({ system, messages, schema, effort = "low", label = "sim" }) => {
  const order = providers();
  if (!order.length) {
    throw Object.assign(new Error("AI is not configured: set GROQ_API_KEY or GEMINI_API_KEY."), {
      statusCode: 503,
    });
  }

  let lastError;
  for (const provider of order) {
    const started = Date.now();
    try {
      const { data, usage } = await (provider === "groq" ? callGroq : callGemini)({ system, messages, schema, effort });
      const ms = Date.now() - started;
      if (!usage.total_time) usage.total_time = ms / 1000;
      console.log(`[SIM] ${label} answered by ${provider} in ${ms}ms`);
      return { data, usage, provider, ms };
    } catch (err) {
      lastError = err;
      console.warn(`[SIM] ${label} failed on ${provider} after ${Date.now() - started}ms: ${err.message}`);
    }
  }
  throw Object.assign(lastError, { statusCode: lastError.statusCode || 502 });
};
