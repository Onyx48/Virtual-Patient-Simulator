/**
 * The movements the avatar can act out, as the action ids the simulator gets
 * with each patient reply: `[side-]region-movement`, kebab-case, side first.
 *
 *   right-shoulder-flexion   left-knee-extension   lower-back-flexion
 *   left-neck-rotation       right-neck-lateral-flexion
 *
 * Limbs (shoulder, hip, knee, ankle, foot) always carry a side. The spine
 * (neck, lower back) has one, either way: only its sided movements carry one,
 * taken from the movement key ("left_rotation" -> "left-neck-rotation").
 *
 * The per-region movement keys match `movements` in
 * backend/ai/prompts/scenario-creation.md and REGIONS in
 * src/components/shared/ScenarioFormPage.jsx; see utils/bodyRegions.js.
 */
const REGION_MOVEMENTS = {
  shoulder: [
    "flexion", "extension", "abduction", "external_rotation", "internal_rotation",
    "horizontal_adduction", "hand_behind_back", "hand_behind_neck",
  ],
  neck: [
    "flexion", "extension", "left_rotation", "right_rotation", "protraction",
    "retraction", "right_lateral_flexion", "left_lateral_flexion",
  ],
  lower_back: [
    "flexion", "extension", "left_lateral_flexion", "right_lateral_flexion",
    "left_rotation", "right_rotation",
  ],
  hip: ["flexion", "extension", "abduction", "adduction", "internal_rotation", "external_rotation"],
  knee: ["flexion", "extension"],
  ankle: ["dorsiflexion", "plantarflexion", "inversion", "eversion"],
  foot: ["great_toe_extension", "great_toe_flexion", "forefoot_pronation", "forefoot_supination"],
};

const SPINE = new Set(["neck", "lower_back"]);
const kebab = (s) => s.replaceAll("_", "-");

export const MOVEMENT_IDS = Object.entries(REGION_MOVEMENTS).flatMap(([region, moves]) =>
  moves.flatMap((move) => {
    if (!SPINE.has(region)) {
      return ["left", "right"].map((side) => `${side}-${kebab(region)}-${kebab(move)}`);
    }
    const sided = move.match(/^(left|right)_(.+)$/);
    return sided
      ? [`${sided[1]}-${kebab(region)}-${kebab(sided[2])}`]
      : [`${kebab(region)}-${kebab(move)}`];
  }),
);

const VALID = new Set(MOVEMENT_IDS);

/**
 * The model's action, or null. Tolerates case, spaces and underscores, and an
 * empty list or list of one, since the field used to be `movement: []`. Never
 * more than one: the avatar plays one movement clip per turn.
 */
export const normalizeAction = (value) => {
  const first = Array.isArray(value) ? value[0] : value;
  const id = String(first ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return VALID.has(id) ? id : null;
};
