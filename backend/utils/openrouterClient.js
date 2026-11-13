/**
 * OpenRouter: the only AI provider this backend calls (since 2026-11-12).
 *
 * Every model call — scenario generation, the simulated patient, grading, the
 * reasoning tutor — goes through here, so learner text reaches exactly one AI
 * supplier. OpenRouter forwards to the model's own host; two settings bound that:
 *
 *   - provider.data_collection = "deny": only upstream hosts that neither store
 *     nor train on prompts are eligible (learner transcripts pass through here).
 *   - `models`: a primary model plus fallbacks. OpenRouter moves to the next one
 *     itself when a model is down or rate-limited, so the failover that used to
 *     be Gemini-then-Groq in our code is now one request.
 *
 *   OPENROUTER_API_KEY          required
 *   OPENROUTER_MODEL            primary, default google/gemini-2.5-flash
 *   OPENROUTER_FALLBACK_MODELS  comma-separated, default openai/gpt-oss-120b
 *   OPENROUTER_MAX_TOKENS       default 8192
 *   OPENROUTER_TIMEOUT_MS       default 60000
 *
 * OpenAI-compatible chat completions, so one fetch rather than an SDK.
 */
import { isProd } from "./appEnv.js";

const BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
const FALLBACK_MODELS = (process.env.OPENROUTER_FALLBACK_MODELS ?? "openai/gpt-oss-120b")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== OPENROUTER_MODEL);

const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS) || 8192;
const TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS) || 60000;

// Only upstream hosts that neither store nor train on our prompts.
const PROVIDER_PREFS = { data_collection: "deny" };

export const isOpenRouterConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const failure = (status, raw) =>
  Object.assign(
    new Error(
      isProd
        ? "The AI service is unavailable right now."
        : `OpenRouter responded ${status}: ${String(raw).slice(0, 400)}`,
    ),
    { status, statusCode: status === 402 || status >= 500 ? 503 : 502 },
  );

/**
 * One chat completion.
 *
 * @param messages   [{role: "system"|"user"|"assistant", content}]
 * @param json       ask for a JSON object (the caller still parses leniently)
 * @param effort     "low" for the live patient, "medium" for grading/authoring
 * @returns {Promise<{text: string, model: string, usage: object, ms: number}>}
 */
export const chat = async ({
  messages,
  json = false,
  effort,
  maxTokens = MAX_TOKENS,
  model = OPENROUTER_MODEL,
  label = "ai",
}) => {
  if (!isOpenRouterConfigured()) {
    throw Object.assign(
      new Error("AI is not configured on the server: set OPENROUTER_API_KEY in .env."),
      { statusCode: 503 },
    );
  }

  const body = {
    model,
    ...(FALLBACK_MODELS.length && {
      models: [model, ...FALLBACK_MODELS.filter((m) => m !== model)],
    }),
    messages,
    max_tokens: maxTokens,
    provider: PROVIDER_PREFS,
    ...(json && { response_format: { type: "json_object" } }),
    ...(effort && { reasoning: { effort } }),
  };

  // Retry only what a second try can fix: overload and transient 5xx. A 402
  // (no credits) or 429 after OpenRouter's own model fallback will not clear in
  // a second.
  for (let attempt = 1; ; attempt += 1) {
    const started = Date.now();
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const raw = await response.text();

    if (!response.ok) {
      const retryable = [500, 502, 503, 504].includes(response.status);
      if (retryable && attempt < 3) {
        console.warn(`[AI] ${label}: OpenRouter ${response.status}, retry ${attempt}/2`);
        await sleep(attempt * 750);
        continue;
      }
      console.error(`[AI] ${label}: OpenRouter error ${response.status}`, raw.slice(0, 500));
      throw failure(response.status, raw);
    }

    const parsed = JSON.parse(raw);
    const choice = parsed?.choices?.[0];
    if (choice?.finish_reason && !["stop", "end_turn"].includes(choice.finish_reason)) {
      console.warn(`[AI] ${label}: stopped early, finish_reason=${choice.finish_reason}`);
    }
    // Reasoning models may put the chain of thought in `reasoning`; the answer
    // is `content`. Fall back to reasoning only if content is empty.
    const text = choice?.message?.content?.trim() || choice?.message?.reasoning?.trim() || "";
    if (!text) throw Object.assign(new Error("The AI returned an empty response."), { statusCode: 502 });

    const u = parsed?.usage || {};
    const ms = Date.now() - started;
    return {
      text,
      model: parsed?.model || model,
      ms,
      usage: {
        prompt_tokens: u.prompt_tokens ?? 0,
        completion_tokens: u.completion_tokens ?? 0,
        queue_time: 0,
        prompt_time: 0,
        completion_time: 0,
        total_time: ms / 1000,
      },
    };
  }
};

/** Parse a JSON object out of a reply, tolerating a code fence or leading prose. */
export const parseJsonObject = (text) => {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object in the reply");
    return JSON.parse(raw.slice(start, end + 1));
  }
};
