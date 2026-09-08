/**
 * Scenarios reachable only by their old short Bubble code.
 *
 * Some deployed clients send /ask-reason a `scenarioId` like "9C2F7X" instead of
 * a Mongo _id, and cannot be changed. Without this they get
 * "'scenarioId' is not a valid id" and the coach never runs for them.
 *
 * The prose lives in legacyScenarios.json exactly as Bubble served it, so these
 * sessions are graded against the same case text the student actually spoke to.
 * This is a compatibility shim, not a second scenario store: nothing writes here,
 * and a scenario that exists in Mongo should never be added.
 */
import { readFileSync } from "fs";

const raw = JSON.parse(
  readFileSync(new URL("./legacyScenarios.json", import.meta.url), "utf8"),
);

/**
 * Codes are matched case-insensitively — they are hand-copied into client config,
 * and "9c2f7x" is the same scenario as "9C2F7X".
 */
const byCode = new Map();

for (const record of raw.results || []) {
  const code = String(record?.ScenarioId || "").trim();
  if (!code) continue;

  let parsed;
  try {
    parsed = JSON.parse(record["Scenario json"] || "{}")?.response;
  } catch (err) {
    // Loud, but not fatal: one malformed record should not stop the server.
    console.error(`[legacy-scenario] ${code} has unparsable "Scenario json":`, err.message);
    continue;
  }

  if (!parsed?.scenario_prompt) {
    console.error(`[legacy-scenario] ${code} has no scenario_prompt; skipped`);
    continue;
  }

  byCode.set(code.toUpperCase(), {
    /*
     * Already in the shape the prompt wants — plain prose and a real array — so
     * unlike a Mongo document this needs no htmlToText/questionsToArray pass.
     * `movements` is empty because Bubble never stored the avatar's range-of-
     * motion limits; the coach simply has no objective findings for these.
     */
    code,
    scenario_name: parsed.scenario_name || "",
    scenario_prompt: parsed.scenario_prompt,
    questions_for_feedback: Array.isArray(parsed.questions_for_feedback)
      ? parsed.questions_for_feedback
      : [],
    difficulty: parsed.difficulty_level || "Medium",
    movements: {},
  });
}

/** @returns the scenario's prompt fields, or null if the code is not a legacy one. */
export const findLegacyScenario = (scenarioId) =>
  byCode.get(String(scenarioId || "").trim().toUpperCase()) || null;

export const legacyScenarioCodes = () => [...byCode.keys()];
