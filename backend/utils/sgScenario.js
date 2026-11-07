/**
 * Singapore scenarios: a FIXED standard + a GENERATED case.
 *
 *   sg-patient-standard.md   how a Singaporean patient talks and behaves. Never generated,
 *                            never shown in the form; added in front of the case for the
 *                            patient only (withSgStandard, used by simEngine.scenarioFor).
 *   sg-scenario-generator.md turns the educator's few words into the case JSON.
 *
 * The case is rendered to text and stored as the scenario's scenarioPrompt, so the
 * form shows (and lets the educator edit) only the generated part. Feedback questions
 * and movements keep the platform's existing format: the same 24 core questions from
 * scenario-creation.md plus 5 case-specific ones, and the same movements object.
 */
import { readFileSync } from "fs";
import { REGION_MOVEMENTS } from "./bodyRegions.js";

const readPrompt = (file) => readFileSync(new URL(`../ai/prompts/${file}`, import.meta.url), "utf8");
const STANDARD = readPrompt("sg-patient-standard.md");
const GENERATOR = readPrompt("sg-scenario-generator.md");
const CREATION = readPrompt("scenario-creation.md");

// The movements rules and allowed values, taken verbatim from the main creation prompt (one source of truth).
const MOVEMENTS_SPEC = (() => {
  const a = CREATION.indexOf("You must fill every string field");
  const b = CREATION.indexOf("### 3. `scenario_prompt`");
  return a > -1 && b > a ? CREATION.slice(a, b).trim() : "";
})();

// The 24 mandatory core questions, in order, from the main creation prompt.
export const CORE_QUESTIONS = (() => {
  const a = CREATION.indexOf("**Mandatory Core Questions");
  const b = CREATION.indexOf("**Scenario-Specific Questions");
  return [...CREATION.slice(a, b).matchAll(/^\s*\d+\.\s+"(.+)"\s*$/gm)].map((m) => m[1]);
})();

export const isSgLocale = (locale) => String(locale || "").toLowerCase() === "sg";

/** System prompt for generating a Singapore case from the educator's short request. */
export const sgGeneratorPrompt = () =>
  GENERATOR.replace("{{MOVEMENTS_SPEC}}", MOVEMENTS_SPEC).replace(
    "{{MOVEMENTS_TEMPLATE}}",
    JSON.stringify(fullMovements()),
  );

/** The patient-facing brief: the fixed Singapore standard in front of the stored case. */
export const withSgStandard = (brief) => `${STANDARD}\n\n---\n\n${brief}`;

const val = (v) => (Array.isArray(v) ? v.filter(Boolean).join("; ") : v === 0 ? "0" : String(v ?? "").trim());
const block = (title, obj, labels) => {
  const rows = Object.entries(labels)
    .map(([k, label]) => [label, val(obj?.[k])])
    .filter(([, v]) => v)
    .map(([label, v]) => `- ${label}: ${v}`);
  return rows.length ? `${title}\n${rows.join("\n")}` : "";
};

// A red-flag answer the model left out defaults to an explicit negative, so the patient never improvises one.
const RED_FLAG_DEFAULTS = {
  trauma: "No fall or injury", weight_loss: "No", cancer_history: "No", fever_night_sweats: "No",
  night_or_constant_pain: "As described under 24-hour behaviour; not constant", bladder_bowel: "Normal", neurological: "No numbness, weakness or balance problems",
};
const pickFilled = (o = {}) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => val(v)));

/**
 * The generated case as readable text: what the educator sees in the form and what the
 * session gives the patient (after the standard) and the graders.
 * "Simulation Objectives for Student:" is kept as a heading because simEngine reads it.
 */
export const renderSgCase = (c = {}) => {
  const p = c.patient || {};
  return [
    `Physiotherapy Case: ${val(c.scenario_name)}`,
    block("Patient Profile:", p, {
      full_name: "Name", preferred_address: "Likes to be called", gender: "Sex", age: "Age",
      ethnicity: "Ethnicity", home_languages: "Languages", speech_register: "Speech register",
      dominant_hand: "Dominant hand", personality: "Personality",
    }),
    block("Life and Social History:", c.life, {
      occupation: "Work", home: "Home", family_and_roles: "Family and roles", daily_routine: "Daily routine",
      activity_and_hobbies: "Activity and hobbies", finances_and_work_pressure: "Money and work pressure",
    }),
    block("History of Present Illness:", c.problem, {
      opening_complaint: "When first asked why they came, the patient says roughly",
      onset_and_mechanism: "Onset and mechanism", progression: "Progression", area_and_spread: "Area and spread",
      quality_and_severity: "Quality and severity", behaviour_24h: "24-hour behaviour", aggravating: "Aggravating",
      easing: "Easing", associated_symptoms: "Associated symptoms", function: "Function", coping: "Coping",
    }),
    block("Medical History:", c.history, {
      past_medical: "Past medical", medications: "Medication", allergies: "Allergies", investigations: "Investigations",
      previous_treatment: "Previous treatment", family_history: "Family history", smoking_alcohol: "Smoking / alcohol",
    }),
    block("Red Flag Screen (true answers if asked):", { ...RED_FLAG_DEFAULTS, ...pickFilled(c.red_flag_screen) }, {
      trauma: "Trauma", weight_loss: "Weight loss", cancer_history: "Cancer history",
      fever_night_sweats: "Fever / night sweats", night_or_constant_pain: "Night or constant pain",
      bladder_bowel: "Bladder / bowel", neurological: "Numbness, weakness, balance", other: "Other",
    }),
    block("Beliefs, Concerns and Expectations:", c.psychosocial, {
      patient_understanding: "What the patient thinks is wrong", health_beliefs: "Health beliefs",
      concerns: "Worry (only voiced if asked)", expectations: "Expectations of physio", yellow_flags: "Yellow flags",
    }),
    (c.hidden_facts || []).length
      ? "Facts the Patient Does Not Volunteer:\n" +
        c.hidden_facts.map((h) => `- ${val(h.fact)} (revealed only when: ${val(h.revealed_when)})`).join("\n")
      : "",
    c.physical_findings ? `Simulated Physical Examination Findings:\n${val(c.physical_findings)}` : "",
    val(c.psychosocial?.goals) ? `Patient's aim and goals of treatment:\n${val(c.psychosocial.goals)}` : "",
    (c.learning_objectives || []).length
      ? `Simulation Objectives for Student:\n${c.learning_objectives.map((o) => `- ${val(o)}`).join("\n")}`
      : "",
    `Educator Notes (the patient never knows or says this):\n- Working diagnosis: ${val(c.working_diagnosis)}` +
      (val(c.differentials) ? `\n- Differentials: ${val(c.differentials)}` : "") +
      `\n- Difficulty: ${val(c.difficulty)}`,
  ].filter(Boolean).join("\n\n");
};

// Every region with every movement key, all "Full": the template the generator fills.
const fullMovements = () =>
  Object.fromEntries(Object.entries(REGION_MOVEMENTS).map(([r, keys]) => [r, Object.fromEntries(keys.map((k) => [k, "Full"]))]));

// Allowed values per movement key (mirrors scenario-creation.md): graded keys take 90/120, all others Full/Ltd.
const GRADED = { "shoulder.flexion": ["Full", "90_Ltd", "120_Ltd"], "hip.flexion": ["Full", "Ltd", "90_Ltd", "120_Ltd"], "knee.flexion": ["Full", "Ltd", "90_Ltd", "120_Ltd"] };

/** Coerces every movement to an allowed value so the avatar always maps it; unknown keys get Full. */
export const cleanMovements = (generated) => {
  const out = fullMovements();
  for (const [region, keys] of Object.entries(out)) {
    for (const key of Object.keys(keys)) {
      const allowed = GRADED[`${region}.${key}`] || ["Full", "Ltd"];
      let v = String(generated?.[region]?.[key] ?? "Full").trim();
      if (!allowed.includes(v)) {
        if (/^full$/i.test(v) || !v) v = "Full";
        else if (allowed.includes("Ltd")) v = "Ltd"; // e.g. "120_Ltd" on abduction
        else v = /90/.test(v) ? "90_Ltd" : "120_Ltd"; // plain "Ltd" on shoulder flexion
      }
      keys[key] = v;
    }
  }
  return out;
};

/** Converts the generator's case JSON into the fields the scenario form reads (same shape as the normal generator). */
export const sgCaseToGenerated = (c = {}) => {
  const p = c.patient || {};
  const specific = (c.case_specific_questions || []).map(String).filter(Boolean).slice(0, 5);
  return {
    scenario_name: val(c.scenario_name),
    patient_name: val(p.full_name),
    patient_gender: /^f/i.test(val(p.gender)) ? "Female" : "Male",
    language: "English",
    scenario_prompt: renderSgCase(c),
    movements: cleanMovements(c.movements),
    questions_for_feedback: [...CORE_QUESTIONS, ...specific],
    learning_objectives: (c.learning_objectives || []).map(String).filter(Boolean).slice(0, 4),
    difficulty_level: ["Easy", "Medium", "Hard"].includes(val(c.difficulty)) ? val(c.difficulty) : "Medium",
  };
};
