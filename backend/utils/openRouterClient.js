/**
 * OpenRouter access: one OpenAI-compatible endpoint in front of many models.
 * The primary AI provider when OPENROUTER_API_KEY is set, for both the
 * simulator (simLlm.js) and scenario generation (aiText.js).
 *
 *   OPENROUTER_API_KEY   required to use it
 *   OPENROUTER_MODEL     default openai/gpt-oss-120b, the model Voxio ran
 *   OPENROUTER_BASE_URL  default https://openrouter.ai/api/v1
 */
import { isProd } from "./appEnv.js";

const BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b";

export const isOpenRouterConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);

/*
 * Enough for a whole generated scenario after the model's reasoning tokens;
 * see the same note in groqClient.js.
 */
const MAX_TOKENS = Number(process.env.OPENROUTER_MAX_TOKENS) || 8192;
const TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS) || 90000;

/**
 * One chat completion.
 *
 * @param messages  [{role: "system"|"user"|"assistant", content}]
 * @param json      ask for a JSON object reply
 * @param effort    reasoning effort for reasoning models: low | medium | high
 * @returns {Promise<{text: string, usage: object}>}
 */
export const openRouterChat = async (args) => {
  /*
   * OpenRouter routes each call to one of several upstream hosts, and one of
   * them failing mid-answer (finish_reason "error", an empty reply, a 5xx or a
   * 429) says nothing about the next attempt, which usually lands elsewhere.
   * One retry before the caller falls over to another provider.
   */
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await openRouterOnce(args);
    } catch (err) {
      const transient = !err.status || err.status === 429 || err.status >= 500;
      if (!transient || attempt >= 2) throw err;
      console.warn(`[AI] OpenRouter attempt ${attempt} failed (${err.message.slice(0, 120)}); retrying`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
};

// Cost log for the superadmin (models/aiUsageModel.js). Imported lazily and never awaited, so a
// logging failure can never fail or slow the AI call itself.
const logUsage = (usage, kind) => {
  import("../models/aiUsageModel.js")
    .then(({ default: AiUsage }) => AiUsage.create({
      model: OPENROUTER_MODEL, kind,
      promptTokens: usage?.prompt_tokens || 0, completionTokens: usage?.completion_tokens || 0,
      costUsd: typeof usage?.cost === "number" ? usage.cost : null,
    }))
    .catch(() => {});
};

const openRouterOnce = async ({ messages, json = false, effort = "medium", maxTokens = MAX_TOKENS, kind = "other" }) => {
  if (!isOpenRouterConfigured()) {
    throw Object.assign(new Error("OpenRouter is not configured on the server: missing OPENROUTER_API_KEY in .env"), { status: 400 });
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      // Shown on OpenRouter's usage page, to tell this app's calls apart.
      "X-Title": "VPS Clinical",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: maxTokens,
      reasoning: { effort },
      // Ask OpenRouter to report the call's cost in `usage` (usage accounting).
      usage: { include: true },
      ...(json && { response_format: { type: "json_object" } }),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error(`[AI] OpenRouter error ${response.status} (model ${OPENROUTER_MODEL})`, raw.slice(0, 500));
    throw Object.assign(
      new Error(
        isProd
          ? "The AI service is unavailable right now."
          : `OpenRouter responded ${response.status}: ${raw.slice(0, 300)}`,
      ),
      { status: response.status },
    );
  }

  const body = JSON.parse(raw);
  // OpenRouter can answer 200 with an error object when the upstream failed.
  if (body.error) {
    throw Object.assign(new Error(`OpenRouter upstream error: ${JSON.stringify(body.error).slice(0, 300)}`), {
      status: body.error.code || 502,
    });
  }

  const choice = body.choices?.[0];
  if (choice?.finish_reason && choice.finish_reason !== "stop") {
    console.warn(
      `[AI] OpenRouter stopped early: finish_reason=${choice.finish_reason} ` +
        `(completion_tokens=${body.usage?.completion_tokens} of ${maxTokens})`,
    );
  }
  const text = choice?.message?.content?.trim() || "";
  if (!text) throw new Error("OpenRouter returned an empty response.");
  logUsage(body.usage, kind);
  return { text, usage: body.usage || {} };
};

/** Same signature as generateText / generateGroqText, for aiText.js. */
export const generateOpenRouterText = async ({ systemPrompt, userQuery, json = false }) =>
  (
    await openRouterChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
      ],
      json,
      kind: "scenario_ai",
    })
  ).text;
