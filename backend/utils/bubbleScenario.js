/**
 * Reshape a Mongo scenario into the payload the external simulator expects from
 * GET /api/scenarios/json.
 *
 * That endpoint's contract is not our schema — it is the Bubble.io export shape
 * that backend/data/defaultScenarioJson.json still serves as a fallback. The
 * simulator reads `ScenarioId`, `Id`, `StreamSessionId` and a `Scenario json`
 * STRING; it does not know about `_id`, `scenarioPrompt` or `aiQuestions`.
 * Publishing a raw document made it read four missing keys and send empty
 * strings on to posta's /get-results, which then 404'd on an empty scenario_id.
 *
 * Keys are spelled exactly as the fallback spells them, spaces included.
 */
import { decodeEntities } from "./richText.js";

/*
 * Bubble ids for the two animation rigs. Carried over verbatim from the
 * fallback payload: their meaning lives in the simulator, not here, and a
 * scenario of ours has no equivalent field to derive them from.
 */
const SHOULDER_ID = "1752920237639x881632483753590800";
const SHOULDER_NECK_ID = "1753175510809x517007094324133900";

/** Rich text to the plain prose an LLM prompt wants. */
export const htmlToText = (value) => {
  if (typeof value !== "string" || !value) return "";

  return decodeEntities(
    value
      // Block ends become line breaks before the tags are dropped, or the whole
      // document collapses into one run-on line.
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * The feedback questions as an array of strings.
 *
 * Stored as a Quill ordered list, but the contract wants
 * `questions_for_feedback: [...]`. Falls back to line splitting for a scenario
 * whose questions were typed as plain paragraphs rather than a list.
 */
export const questionsToArray = (value) => {
  if (typeof value !== "string" || !value) return [];

  const items = [...value.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match) =>
    htmlToText(match[1]),
  );

  const source = items.length ? items : htmlToText(value).split("\n");

  return source.map((line) => line.trim()).filter(Boolean);
};

/**
 * @param scenario  a lean Scenario document
 * @param meta.userId     who opened the simulator — becomes `Id`, which posta
 *                        receives back as `user_id`
 * @param meta.sessionId  the run's id — becomes `StreamSessionId`
 */
export const toBubbleScenarioJson = (scenario, meta = {}) => {
  const scenarioId = String(scenario._id);

  // ScenarioId is deliberately the Mongo _id rather than a short code: posta's
  // _find_scenario tries ObjectId(scenario_id) first, so an _id resolves without
  // needing a code field we do not store.
  return {
    cursor: 0,
    count: 1,
    remaining: 0,
    results: [
      {
        _id: scenarioId,
        "Modified Date": scenario.updatedAt || null,
        "Created Date": scenario.createdAt || null,
        "Created By": scenario.educator?._id
          ? String(scenario.educator._id)
          : "",
        ScenarioId: scenarioId,
        StreamSessionId: meta.sessionId ? String(meta.sessionId) : "",
        Id: meta.userId ? String(meta.userId) : "",
        shoulder_neck: SHOULDER_NECK_ID,
        shoulder: SHOULDER_ID,
        "Scenario json": JSON.stringify({
          response: {
            scenario_name: scenario.scenarioName || "",
            scenario_prompt: htmlToText(scenario.scenarioPrompt),
            questions_for_feedback: questionsToArray(scenario.aiQuestions),
            difficulty_level: scenario.difficulty || "Medium",
          },
        }),
        // Additive, outside the Bubble contract: the movement limits the avatar
        // needs. A strict reader of the contract ignores it.
        animationTriggers: scenario.animationTriggers || {},
      },
    ],
  };
};
