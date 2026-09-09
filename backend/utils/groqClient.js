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

/*
 * A reasoning model spends output tokens on its chain of thought before it
 * writes a single character of the answer, so the default completion cap is not
 * enough for a whole generated scenario: the reply gets cut off mid-object and
 * arrives as unparseable JSON. That failure is intermittent by nature — it
 * depends on how long the model happens to think — which is exactly the
 * "works sometimes" symptom. Generous enough for the largest scenario prompt
 * and still far below the model's context window.
 */
const MAX_COMPLETION_TOKENS = Number(process.env.GROQ_MAX_TOKENS) || 8192;

/**
 * Run a prompt and return the reply as prose.
 *
 * The system prompt and user turn map onto the two messages, so a caller can
 * swap this in for the Gemini text call without reshaping anything, `json` flag
 * included: a JSON caller gets response_format asked for, and — since not every
 * Groq model accepts it — a retry without it if the model rejects it. Either way
 * the caller still parses leniently (see aiText.js), because a reasoning model
 * left to itself likes to introduce its answer in prose.
 */
export const generateGroqText = async ({
  systemPrompt,
  userQuery,
  json = false,
  model = GROQ_MODEL,
}) => {
  if (!isGroqConfigured()) {
    throw new Error("Groq is not configured on the server: missing GROQ_API_KEY in .env");
  }

  const call = (withResponseFormat) =>
    fetch(`${GROQ_BASE_URL}/chat/completions`, {
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
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        ...(withResponseFormat ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  let response = await call(json);
  let raw = await response.text();

  /*
   * A model that does not support JSON mode says so with a 400, not by ignoring
   * the field. Retrying without it is better than failing over to nothing: the
   * lenient parser can still recover an object from a prose-wrapped reply.
   */
  if (json && response.status === 400 && raw.includes("response_format")) {
    console.warn(`[AI] Groq ${model} rejected response_format; retrying without JSON mode`);
    response = await call(false);
    raw = await response.text();
  }

  if (!response.ok) {
    console.error(`[AI] Groq error ${response.status} (model ${model})`, raw);
    const err = new Error(
      isProd
        ? "The AI service is unavailable right now."
        : `Groq responded ${response.status}: ${raw.slice(0, 500)}`,
    );
    err.status = response.status;
    throw err;
  }

  const body = JSON.parse(raw);
  const choice = body?.choices?.[0];
  const message = choice?.message;

  /*
   * finish_reason is the one field that distinguishes "the model answered badly"
   * from "the model was cut off", and without it a truncated reply is
   * indistinguishable in the logs from a malformed one.
   */
  if (choice?.finish_reason && choice.finish_reason !== "stop") {
    console.warn(
      `[AI] Groq stopped early: finish_reason=${choice.finish_reason}`,
      `(completion_tokens=${body?.usage?.completion_tokens} of ${MAX_COMPLETION_TOKENS})`,
    );
  }

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
