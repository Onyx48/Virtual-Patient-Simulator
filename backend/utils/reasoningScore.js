/*
 * Clinical Reasoning score, shared by the patient room (browser) and the server, so they never
 * disagree. Feedback engine doc 1.5 and 1.9: a criterion's final rating is the lower of its quality
 * rating and the cap set by its independence level (criterion 3: the lower of physical_observation
 * and whole_picture); the percentage is the sum of final rating / 4 x weight. Skipped or distress:
 * no score. Plain JS with no imports, so Vite can bundle it into the room.
 */
export const CR_WEIGHTS = { 1: 0.2, 2: 0.25, 3: 0.25, 4: 0.15, 5: 0.15 };
export const CR_NAMES = {
  1: "Information gathering and cue recognition",
  2: "Hypothesis generation and prioritisation",
  3: "Analysis and interpretation of findings",
  4: "Red flags and safety screening",
  5: "Justification and reflection",
};
const CR_ELEMENTS = { 1: ["cues"], 2: ["hypotheses"], 3: ["physical_observation", "whole_picture"], 4: ["red_flags"], 5: ["examination"] };
export const INDEPENDENCE = ["independent", "prompted", "step_by_step", "not_reached", "not_covered"]; // high to low
const CAP = { independent: 4, prompted: 3, step_by_step: 2, not_reached: 1, not_covered: 1 };
export const INDEPENDENCE_LABEL = { independent: "On your own", prompted: "With a prompt", step_by_step: "With step-by-step guidance", not_reached: "Not reached yet", not_covered: "Not covered this time" };
export const LEVEL = { 4: "Highly proficient", 3: "Proficient", 2: "Developing", 1: "Needs development" };

export function scoreReasoning(fb, status) {
  if (!fb || status === "skipped" || status === "ended_early_distress" || !Array.isArray(fb.criteria) || !fb.criteria.length) return { percent: null, rows: [] };
  const elements = fb.element_independence || {};
  const rows = [1, 2, 3, 4, 5].map((n) => {
    const c = fb.criteria.find((x) => Number(x.criterion) === n) || {};
    const levels = CR_ELEMENTS[n].map((k) => elements[k]).filter((v) => INDEPENDENCE.includes(v));
    const independence = levels.length
      ? levels.reduce((low, v) => (INDEPENDENCE.indexOf(v) > INDEPENDENCE.indexOf(low) ? v : low))
      : INDEPENDENCE.includes(c.independence) ? c.independence : "not_covered";
    const quality = Math.max(1, Math.min(4, Math.round(Number(c.quality_rating) || 1)));
    return { n, name: CR_NAMES[n], weight: CR_WEIGHTS[n], independence, final: Math.min(quality, CAP[independence]) };
  });
  return { percent: Math.round(rows.reduce((sum, r) => sum + (r.final / 4) * CR_WEIGHTS[r.n], 0) * 100), rows };
}

/** The record stored on a Session (clinical_reasoning), from the engine's JSON and status. */
export function reasoningRecord(fb, status) {
  if (!fb || typeof fb !== "object") return null;
  const { percent, rows } = scoreReasoning(fb, status);
  const list = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  return {
    status: status || fb.status || null,
    percent,
    criteria: rows,
    summary: fb.summary ? String(fb.summary) : null,
    went_well: list(fb.went_well),
    work_on: list(fb.work_on),
    focus_next_time: fb.focus_next_time ? String(fb.focus_next_time) : null,
    case_reveal: fb.case_reveal && typeof fb.case_reveal === "object" ? fb.case_reveal : null,
    // Educator only: stripped from every response a student can reach (forStudent below).
    missed_red_flag: fb.missed_red_flag === true || String(fb.missed_red_flag).toLowerCase() === "true",
    distress_flag: fb.distress_flag === true || String(fb.distress_flag).toLowerCase() === "true",
  };
}

/** A session as a student may see it: no distress markers, no missed-red-flag marker. */
export function forStudent(session) {
  const s = typeof session?.toObject === "function" ? session.toObject() : { ...session };
  if (s.reflection) { s.reflection = { ...s.reflection }; delete s.reflection.distress_flag; }
  if (s.clinical_reasoning) { s.clinical_reasoning = { ...s.clinical_reasoning }; delete s.clinical_reasoning.distress_flag; delete s.clinical_reasoning.missed_red_flag; }
  return s;
}
