/**
 * One-shot AI calls (scenario generation, the reasoning coach), in a prose and
 * a JSON flavour. Both go to OpenRouter — see openrouterClient.js, which also
 * does the model failover that this file used to do across Gemini and Groq.
 *
 * The export names keep "WithFallback" so callers did not have to change: the
 * fallback is now OpenRouter's `models` list instead of a second provider.
 */
import { chat, parseJsonObject } from "./openrouterClient.js";
import { isProd } from "./appEnv.js";

const toMessages = (systemPrompt, userQuery) => [
  { role: "system", content: systemPrompt },
  { role: "user", content: userQuery },
];

/** @returns {Promise<{text: string, provider: string, model: string}>} */
export const generateTextWithFallback = async ({ systemPrompt, userQuery }) => {
  const { text, model } = await chat({
    messages: toMessages(systemPrompt, userQuery),
    label: "text",
  });
  return { text, provider: "openrouter", model };
};

/**
 * JSON generation. A malformed reply is retried once: one bad generation is
 * common, cheap to redo, and says nothing about whether the model is healthy.
 *
 * @returns {Promise<{json: object, provider: string, model: string}>}
 */
export const generateJsonWithFallback = async ({ systemPrompt, userQuery }) => {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { text, model } = await chat({
      messages: toMessages(systemPrompt, userQuery),
      json: true,
      label: "json",
    });
    try {
      return { json: parseJsonObject(text), provider: "openrouter", model };
    } catch (err) {
      lastError = err;
      console.error(`[AI] attempt ${attempt}: reply was not valid JSON —`, text.slice(0, 300));
    }
  }
  throw new Error(
    isProd
      ? "The AI could not produce a usable scenario. Please try again."
      : `Reply was not valid JSON after 2 attempts: ${lastError?.message}`,
  );
};
