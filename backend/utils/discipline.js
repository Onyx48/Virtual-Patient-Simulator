/**
 * The clinical discipline a scenario trains: physiotherapy (PT) or occupational
 * therapy (OT). The educator picks it on the scenario form; it is locked once
 * the scenario has been published (see scenarioModel's disciplineLocked).
 *
 * It decides which prompt overlay generates the scenario
 * (ai/prompts/discipline-ot.md for OT, nothing extra for PT) and how the grader
 * and the reasoning tutor address the student. The conversation engine itself
 * is the same for both: the patient brief carries everything case-specific.
 */
export const DISCIPLINES = ["PT", "OT"];
export const DEFAULT_DISCIPLINE = "PT";

const LABELS = {
  PT: { name: "Physiotherapy", student: "a physiotherapy student" },
  OT: { name: "Occupational Therapy", student: "an occupational therapy student" },
};

/** "PT" or "OT" from anything a client might send; unknown values become PT. */
export const normalizeDiscipline = (value) => {
  const v = String(value ?? "").trim().toUpperCase();
  return DISCIPLINES.includes(v) ? v : DEFAULT_DISCIPLINE;
};

export const isDiscipline = (value) => DISCIPLINES.includes(String(value ?? "").trim().toUpperCase());

export const disciplineName = (d) => LABELS[normalizeDiscipline(d)].name;

/** Fills {{DISCIPLINE_STUDENT}} in the grader and tutor prompts. */
export const withDisciplineStudent = (prompt, d) =>
  prompt.replaceAll("{{DISCIPLINE_STUDENT}}", LABELS[normalizeDiscipline(d)].student);
