/**
 * One AI call with a provider fallback, in a prose and a JSON flavour.
 *
 * Gemini is the primary and Groq is the standby. Gemini's free tier returns
 * "this model is currently experiencing high demand" often enough that its
 * retries alone are not sufficient — the whole provider can be unavailable for
 * minutes at a time, which would take the reasoning coach and scenario
 * generation down with it. The free tier also caps daily requests, and that
 * failure lasts until midnight Pacific, so a standby is the only way through it.
 *
 * The prompt is provider-agnostic: it goes to Gemini as a system instruction and
 * to Groq as a system message, so no per-provider wording is needed.
 */
import { generateText, GEMINI_MODEL } from "./geminiClient.js";
import { generateGroqText, GROQ_MODEL, isGroqConfigured } from "./groqClient.js";
import { isProd } from "./appEnv.js";

/**
 * Gemini failed and there is no standby.
 *
 * Gemini's own error is what gets thrown — it is the actual reason the request
 * failed, and a "Groq is not configured" would send an operator to the wrong
 * place. But the message says the fallback was skipped too, because a bare 429
 * makes it look as though no fallback exists at all.
 */
const noFallbackConfigured = (geminiError) => {
  console.error(
    "[AI] Gemini failed and GROQ_API_KEY is not set — no fallback was attempted",
  );
  /*
   * Said in production too, not only outside it. This message is only ever seen
   * by an educator or an admin generating a scenario — never by a student — and
   * the alternative was a bare Gemini 429 that reads as "the fallback is broken"
   * when the truth is that no fallback was configured to run. Diagnosing that
   * cost a round trip through the logs every time.
   */
  geminiError.message +=
    " — no Groq fallback was attempted because GROQ_API_KEY is not set on the server.";
  return geminiError;
};

/**
 * Both providers failed.
 *
 * Gemini's error is still the one thrown — it is the primary, and it is what an
 * operator should check first — but Groq's reason is carried along in the message.
 * Without it the caller sees a Gemini 429 and cannot tell whether the standby was
 * skipped, rate-limited, or misconfigured.
 */
const bothFailed = (geminiError, groqError) => {
  geminiError.message += ` — the Groq fallback also failed: ${groqError.message}`;
  return geminiError;
};

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
    if (!isGroqConfigured()) throw noFallbackConfigured(geminiError);

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
      throw bothFailed(geminiError, groqError);
    }
  }
};

/**
 * Pull a JSON object out of a model reply.
 *
 * Gemini is asked for the JSON mime type and so returns a bare object, but Groq
 * has no equivalent for every model and a reasoning model in particular likes to
 * introduce its answer. Slicing between the outermost braces recovers the object
 * from either, and costs nothing when the reply was already clean.
 */
const parseJsonReply = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object in the reply");
    return JSON.parse(text.slice(start, end + 1));
  }
};

/**
 * Ask one provider for JSON, allowing it two goes at producing valid syntax.
 *
 * A single malformed generation is common and cheap to redo, and it says nothing
 * about whether the provider is healthy — so it is retried here rather than
 * failing straight over to the standby.
 */
const generateJsonFrom = async (generate, { systemPrompt, userQuery }, provider) => {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    // A transport failure is not retried here: `generate` already handles the
    // retryable ones, and anything it throws should reach the failover now.
    const text = await generate({ systemPrompt, userQuery, json: true });
    try {
      return parseJsonReply(text);
    } catch (err) {
      lastError = err;
      console.error(
        `[AI] ${provider} attempt ${attempt}: reply was not valid JSON —`,
        text.slice(0, 300),
      );
    }
  }

  throw new Error(
    isProd
      ? "The AI could not produce a usable scenario. Please try again."
      : `${provider} reply was not valid JSON after 2 attempts: ${lastError?.message}`,
  );
};

/**
 * One JSON-generating call with the same Gemini-then-Groq failover as above.
 *
 * Failing over on a parse failure as well as a transport failure is deliberate:
 * if one model cannot hold the scenario schema for two attempts, the other is
 * more likely to succeed than a third attempt at the same one.
 *
 * @returns {Promise<{json: object, provider: string, model: string}>}
 */
export const generateJsonWithFallback = async ({ systemPrompt, userQuery }) => {
  try {
    const json = await generateJsonFrom(generateText, { systemPrompt, userQuery }, "gemini");
    return { json, provider: "gemini", model: GEMINI_MODEL };
  } catch (geminiError) {
    if (!isGroqConfigured()) throw noFallbackConfigured(geminiError);

    console.warn(
      `[AI] Gemini failed (${geminiError.status || "no status"}: ${geminiError.message}); falling back to Groq ${GROQ_MODEL}`,
    );

    try {
      const json = await generateJsonFrom(generateGroqText, { systemPrompt, userQuery }, "groq");
      return { json, provider: "groq", model: GROQ_MODEL };
    } catch (groqError) {
      console.error("[AI] Groq fallback also failed:", groqError.message);
      throw bothFailed(geminiError, groqError);
    }
  }
};
