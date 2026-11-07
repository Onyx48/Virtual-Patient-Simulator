/**
 * The body regions the product supports.
 *
 * This is the whole clinical scope: the authoring prompts refuse a case outside
 * this list, the scenario form offers no other region, and `animationTriggers` on
 * a scenario has exactly these keys. Keeping it in one place stops the list
 * drifting apart across the schema, the route defaults and the prompts — which is
 * what happened while only neck and shoulder existed, where every site simply
 * hardcoded the pair.
 *
 * Adding a region means editing this array AND the two prompts in
 * backend/ai/prompts/ AND the REGIONS table in
 * src/components/shared/ScenarioFormPage.jsx. Only the prompt knows which
 * movements a region has, and only the form knows how to label them.
 */
export const BODY_REGIONS = [
  "shoulder",
  "neck",
  "lower_back",
  "hip",
  "knee",
  "ankle",
  "foot",
];

/** Human-readable scope, for a message shown to a person. */
export const BODY_REGIONS_LABEL = "neck, shoulder, lower back, hip, knee, ankle and foot";

/** `{ shoulder: [], neck: [], ... }` — the default for a scenario with no limits recorded. */
export const emptyTriggers = () =>
  Object.fromEntries(BODY_REGIONS.map((region) => [region, []]));

/** `{ shoulder: {}, neck: {}, ... }` — the AI payload's shape, keyed movement maps. */
export const emptyMovements = () =>
  Object.fromEntries(BODY_REGIONS.map((region) => [region, {}]));

/*
 * The movements the simulator can animate in each region, as named in the
 * scenario prompts' `movements` object. The Voxio patient returns them as
 * "region.movement" when the student asks the patient to move.
 */
export const REGION_MOVEMENTS = {
  shoulder: ["flexion", "extension", "abduction", "external_rotation", "internal_rotation", "horizontal_adduction", "hand_behind_back", "hand_behind_neck"],
  neck: ["flexion", "extension", "left_rotation", "right_rotation", "protraction", "retraction", "right_lateral_flexion", "left_lateral_flexion"],
  lower_back: ["flexion", "extension", "left_lateral_flexion", "right_lateral_flexion", "left_rotation", "right_rotation"],
  hip: ["flexion", "extension", "abduction", "adduction", "internal_rotation", "external_rotation"],
  knee: ["flexion", "extension"],
  ankle: ["dorsiflexion", "plantarflexion", "inversion", "eversion"],
  foot: ["great_toe_extension", "great_toe_flexion", "forefoot_pronation", "forefoot_supination"],
};
