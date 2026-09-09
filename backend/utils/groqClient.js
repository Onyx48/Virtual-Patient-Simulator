/**
 * Groq access, used as the fallback when Gemini is unavailable.
 *
 * Groq exposes an OpenAI-compatible chat completions API, so this is one fetch
 * against that endpoint rather than a new SDK — same reasoning as geminiClient.js.
 */
import { isProd } from "./appEnv.js";

const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";

export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export const isGroqConfigured = () => Boolean(process.env.GROQ_API_KEY);

/**
 * Run a prompt and return the reply as prose.
 *
 * The system prompt and user turn map onto the two messages, so a caller can
 * swap this in for the Gemini text call without reshaping anything. That
 * includes the Gemini call's `json` flag, which is accepted and ignored — there
 * is no response_format that every Groq model supports, so a JSON caller parses
 * the reply leniently instead (see aiText.js).
 */
export const generateGroqText = async ({
  systemPrompt,
  userQuery,
  model = GROQ_MODEL,
}) => {
  if (!isGroqConfigured()) {
    throw new Error("Groq is not configured on the server: missing GROQ_API_KEY in .env");
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
      ],
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    console.error("[AI] Groq error", response.status, raw);
    const err = new Error(
      isProd
        ? "The AI service is unavailable right now."
        : `Groq responded ${response.status}: ${raw.slice(0, 500)}`,
    );
    err.status = response.status;
    throw err;
  }

  const body = JSON.parse(raw);
  const message = body?.choices?.[0]?.message;

  /*
   * gpt-oss is a reasoning model: on Groq it returns its chain of thought in a
   * separate `reasoning` field and the answer in `content`. Only `content` is
   * wanted — but if a model variant ever puts everything in `reasoning` and
   * leaves content empty, fall back to it rather than returning nothing.
   */
  const text = message?.content?.trim() || message?.reasoning?.trim();

  if (!text) {
    console.error("[AI] Groq returned no text", raw.slice(0, 500));
    throw new Error("The AI returned an empty response.");
  }

  return text;
};
