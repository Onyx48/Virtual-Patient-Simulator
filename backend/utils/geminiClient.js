/**
 * Gemini access for scenario generation.
 *
 * Uses the REST generateContent endpoint over global fetch rather than the
 * @google/genai SDK — the only thing needed here is one non-streaming call, and
 * this keeps the dependency list unchanged.
 */
import { isProd } from "./appEnv.js";

const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Throws with the names of the variables that are missing, so a
 * misconfiguration reads as "you forgot GEMINI_API_KEY" instead of a 500 from
 * deep inside a fetch. Mirrors assertMailConfigured in emailService.js.
 */
export const assertGeminiConfigured = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("AI is not configured on the server: missing GEMINI_API_KEY in .env");
  }
};

/**
 * Strip the markdown fence Gemini adds even when told not to.
 *
 * The Python service did `.replace('json','').replace('`','')`, which also
 * mangles the word "json" anywhere in the payload. This removes only a leading
 * ```json fence and the closing fence.
 */
const stripFence = (text) =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

/**
 * @param {boolean} json  Ask for the JSON mime type. Off for callers that want
 *   prose — requesting JSON and then handing the caller a quoted string would
 *   make every reply arrive wrapped in double quotes.
 */
const callGemini = async ({ systemPrompt, userQuery, model, json = true }) => {
  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userQuery }] }],
      // The prompts already demand a bare JSON object; asking for the JSON mime
      // type as well stops Gemini wrapping it in prose or a fence.
      generationConfig: json ? { responseMimeType: "application/json" } : {},
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    console.error("[AI] Gemini error", response.status, raw);
    const err = new Error(
      isProd
        ? "The AI service is unavailable right now."
        : `Gemini responded ${response.status}: ${raw.slice(0, 500)}`,
    );
    err.status = response.status;
    /*
     * Only a server-side overload is worth another attempt. A 429 is excluded on
     * purpose: on the free tier it is usually the *daily* request cap, which
     * reports a retryDelay of ~38s and will still be exhausted after any backoff
     * we are willing to wait. Retrying it just delays the fallback by seconds.
     * A 400/403/404 is our own mistake and will fail again identically.
     */
    err.retryable = [500, 502, 503, 504].includes(response.status);
    throw err;
  }

  const body = JSON.parse(raw);
  const text = body?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");

  if (!text) {
    console.error("[AI] Gemini returned no text", raw.slice(0, 500));
    throw new Error("The AI returned an empty response.");
  }

  return text;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a prompt and return the reply as prose.
 *
 * No JSON parse — there is nothing to validate, so a reply that arrives is
 * usable. Any leftover markdown fence is stripped in case the prompt pushes the
 * model toward a code block.
 *
 * Retries up to three times on a server-side overload, backing off 1s then 1.5s.
 * "gemini-2.5-flash is experiencing high demand" is common enough that a single
 * attempt turns a routine spike into a user-visible failure. A quota error or a
 * bad key/model is thrown on the first try instead, so the caller's fallback
 * takes over immediately.
 */
export const generateText = async ({
  systemPrompt,
  userQuery,
  model = GEMINI_MODEL,
  attempts = 3,
}) => {
  assertGeminiConfigured();

  for (let attempt = 1; ; attempt += 1) {
    try {
      const text = await callGemini({ systemPrompt, userQuery, model, json: false });
      return stripFence(text);
    } catch (err) {
      if (!err.retryable || attempt >= attempts) throw err;
      console.warn(
        `[AI] attempt ${attempt}/${attempts} failed with ${err.status}, retrying`,
      );
      await sleep(attempt * 500 + 500);
    }
  }
};

/**
 * Run a prompt and parse the reply as JSON, retrying once.
 *
 * The retry exists because a single bad generation is common and cheap to redo.
 * Unlike the Python original this throws on a second failure instead of
 * returning a fake success document — a caller that gets a 200 back can trust
 * the payload.
 */
export const generateScenarioJson = async ({
  systemPrompt,
  userQuery,
  model = GEMINI_MODEL,
}) => {
  assertGeminiConfigured();

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const text = await callGemini({ systemPrompt, userQuery, model });
    try {
      return JSON.parse(stripFence(text));
    } catch (err) {
      lastError = err;
      console.error(
        `[AI] Attempt ${attempt}: reply was not valid JSON —`,
        text.slice(0, 300),
      );
    }
  }

  throw new Error(
    isProd
      ? "The AI could not produce a usable scenario. Please try again."
      : `AI reply was not valid JSON after 2 attempts: ${lastError?.message}`,
  );
};
