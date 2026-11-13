/**
 * Multi-turn JSON chat calls for the simulator (patient, grader, reasoning
 * tutor). The whole conversation is sent as alternating turns, through
 * OpenRouter — the only AI provider (see openrouterClient.js).
 *
 *   OPENROUTER_SIM_MODEL   optional: a different primary model for the live
 *                          patient (a faster one keeps replies speakable);
 *                          defaults to OPENROUTER_MODEL.
 */
import { chat, isOpenRouterConfigured, parseJsonObject } from "./openrouterClient.js";

export const isSimLlmConfigured = () => isOpenRouterConfigured();

/**
 * @param system    system prompt
 * @param messages  [{role: "user"|"assistant", content}] — must end on "user"
 * @param schema    unused since the move off Gemini's native API; the prompts
 *                  spell out the JSON shape. Kept so callers need not change.
 * @param effort    "low" for the live patient, "medium" for grading
 * @returns {Promise<{data: object, usage: object, provider: string, ms: number}>}
 */
// eslint-disable-next-line no-unused-vars
export const chatJson = async ({ system, messages, schema, effort = "low", label = "sim" }) => {
  const { text, usage, ms, model } = await chat({
    messages: [{ role: "system", content: system }, ...messages],
    json: true,
    effort,
    maxTokens: 4096,
    ...(process.env.OPENROUTER_SIM_MODEL && { model: process.env.OPENROUTER_SIM_MODEL }),
    label,
  });
  let data;
  try {
    data = parseJsonObject(text);
  } catch {
    throw Object.assign(new Error("The AI reply was not JSON."), { statusCode: 502 });
  }
  console.log(`[SIM] ${label} answered by ${model} in ${ms}ms`);
  return { data, usage, provider: "openrouter", ms };
};
