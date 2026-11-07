/**
 * Which profession a scenario trains: physiotherapy (PT) or occupational
 * therapy (OT). It decides the wording of every simulator prompt (student,
 * patient or client), the standard feedback questions the AI writes into a new
 * scenario, and which History Taking criterion each standard question counts
 * towards.
 *
 * Set per scenario (Scenario.profession). A school's default
 * (School.defaultProfession) pre-selects it on the scenario form.
 */
import { readFileSync } from "fs";

export const PROFESSIONS = ["physiotherapy", "occupational_therapy"];
export const DEFAULT_PROFESSION = "physiotherapy";

export const normaliseProfession = (value) => {
  const v = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (v === "ot" || v === "occupational_therapy" || v === "occupational") return "occupational_therapy";
  return DEFAULT_PROFESSION;
};

const OT_PROMPT = readFileSync(new URL("../ai/prompts/profession-ot.md", import.meta.url), "utf8");

/** The scenario-writing prompt with the profession's section appended (PT needs none). */
export const withProfession = (systemPrompt, profession) =>
  normaliseProfession(profession) === "occupational_therapy" ? systemPrompt + OT_PROMPT : systemPrompt;

/** The words the simulator prompts use for this profession. */
export const professionWords = (profession) =>
  normaliseProfession(profession) === "occupational_therapy"
    ? {
        profession: "occupational therapy",
        student: "occupational therapy student",
        person: "client",
        consultation: "initial interview",
      }
    : {
        profession: "physiotherapy",
        student: "physiotherapy student",
        person: "patient",
        consultation: "consultation",
      };

/*
 * Criterion for each standard OT question (OT TWC Feedback question History
 * Taking, 25 questions), in order. DRAFT: the client has not mapped these yet;
 * this follows the same reasoning as the PT mapping in the report template and
 * needs their sign-off.
 */
export const OT_STANDARD_QUESTION_CRITERIA = [
  "Questioning Technique & Communication", // 1 introduction, purpose, identity, consent
  "Questioning Technique & Communication", // 2 open-ended opening question
  "Presenting Concern Exploration", // 3 onset, duration, progression
  "Presenting Concern Exploration", // 4 what they were doing when it began
  "Presenting Concern Exploration", // 5 nature and quality of pain
  "Presenting Concern Exploration", // 6 location and spread
  "Presenting Concern Exploration", // 7 aggravating and relieving factors
  "Presenting Concern Exploration", // 8 24-hour pattern
  "Red Flags & Safety Screening", // 9 associated symptoms (numbness, weakness, swelling)
  "Relevant History Gathering", // 10 investigations
  "Relevant History Gathering", // 11 previous treatments, splints
  "Relevant History Gathering", // 12 effectiveness of previous treatment
  "Relevant History Gathering", // 13 past medical history
  "Psychosocial & Contextual Exploration", // 14 impact on daily activities
  "Psychosocial & Contextual Exploration", // 15 activities stopped or changed
  "Psychosocial & Contextual Exploration", // 16 work environment
  "Psychosocial & Contextual Exploration", // 17 home environment and routine
  "Psychosocial & Contextual Exploration", // 18 sports and leisure
  "Psychosocial & Contextual Exploration", // 19 lifestyle factors
  "Psychosocial & Contextual Exploration", // 20 goals and expectations
  "Questioning Technique & Communication", // 21 clear language
  "Relevance & Prioritisation", // 22 questioning strategy, no irrelevant questions
  "Follow-Up & Probing", // 23 active listening and follow-up
  "Questioning Technique & Communication", // 24 empathy
  "Organisation & Adaptability", // 25 logical structure
];

/** OT lists are 25 standard + 5 case-specific. */
export const otStandardCriterion = (index, total) =>
  total >= OT_STANDARD_QUESTION_CRITERIA.length ? OT_STANDARD_QUESTION_CRITERIA[index] ?? null : null;
