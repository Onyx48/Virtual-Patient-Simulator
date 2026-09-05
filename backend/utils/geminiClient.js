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

const callGemini = async ({ systemPrompt, userQuery, model }) => {
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
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    console.error("[AI] Gemini error", response.status, raw);
    throw new Error(
      isProd
        ? "The AI service is unavailable right now."
        : `Gemini responded ${response.status}: ${raw.slice(0, 500)}`,
    );
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
