/**
 * One prose-generating call with a provider fallback.
 *
 * Gemini is the primary and Groq is the standby. Gemini's free tier returns
 * "this model is currently experiencing high demand" often enough that its
 * retries alone are not sufficient — the whole provider can be unavailable for
 * minutes at a time, which would take the reasoning coach down with it.
 *
 * The prompt is provider-agnostic: it goes to Gemini as a system instruction and
 * to Groq as a system message, so no per-provider wording is needed.
 */
import { generateText, GEMINI_MODEL } from "./geminiClient.js";
import { generateGroqText, GROQ_MODEL, isGroqConfigured } from "./groqClient.js";

/**
 * @returns {Promise<{text: string, provider: string, model: string}>}
 *   The provider is reported so the caller can log which one answered — without
 *   it, a silent failover is invisible until someone wonders why replies changed
 *   in style.
 */
export const generateTextWithFallback = async ({ systemPrompt, userQuery }) => {
  try {
    const text = await generateText({ systemPrompt, userQuery });
    return { text, provider: "gemini", model: GEMINI_MODEL };
  } catch (geminiError) {
    if (!isGroqConfigured()) {
      // Nothing to fall back to, so surface Gemini's own error rather than a
      // misleading "Groq is not configured".
      console.error("[AI] Gemini failed and GROQ_API_KEY is not set");
      throw geminiError;
    }

    console.warn(
      `[AI] Gemini failed (${geminiError.status || "no status"}: ${geminiError.message}); falling back to Groq ${GROQ_MODEL}`,
    );

    try {
      const text = await generateGroqText({ systemPrompt, userQuery });
      return { text, provider: "groq", model: GROQ_MODEL };
    } catch (groqError) {
      /*
       * Both providers are down. The Gemini error is the more useful one to
       * surface — it is the primary, and it is what an operator should check
       * first — so Groq's is logged rather than thrown.
       */
      console.error("[AI] Groq fallback also failed:", groqError.message);
      throw geminiError;
    }
  }
};
