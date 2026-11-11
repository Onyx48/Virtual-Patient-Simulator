// The history-taking timeline scorer (docs/HT_TIMELINE_PLAN.md §3), added to the room's customs.
//
// A second llm node that never speaks, after ci/internal-shortlisting's llm_score. It runs AFTER
// the patient's reply has gone to TTS, so scoring happens underneath audio that is already
// playing:   patient → response1 → ht_score → ht_score_out → judge
// It has its own history key so it sees its previous scores (that is how they carry forward)
// and cannot read the patient's history or the patient its.
//
// Room only: the saved flow (and the student's 3D path) is untouched.
import { readFileSync } from "fs";
import { htKeys, htFields } from "../../src/lib/htRubric.js";
import { professionWords } from "./profession.js";

const PROMPT = readFileSync(new URL("../ai/prompts/ht-scorer.md", import.meta.url), "utf8").replace(/^<!--[\s\S]*?-->\s*/, "");

const VISION_INPUT = "- A <turn-visual-context> block inside `user_input`, when the camera is on: a factual report of what the camera saw this turn. It is the ONLY source for presence.";
const VISION_DIMENSION = `
presence: FROM THE VISUAL REPORT ONLY, and only these things: is the student facing the camera, clearly visible and lit, and not looking away or reading notes for most of the turn. Never eye contact as such (looking slightly down is polite in several cultures), never mood, confidence or nerves. If there is no visual report this turn, presence gets no kink and no movement, ever. Never infer how someone looked from what they said.`;

// What a complete history covers, per profession. An OT history is about occupations, not a
// pain interview: simulated OT runs scored a physio-style student as well covered without these.
const AREAS = {
  physiotherapy: [
    "the main complaint and its location", "onset and mechanism", "pain behaviour (nature, severity, irritability)",
    "aggravating and easing factors", "the 24-hour pattern including night pain and morning stiffness",
    "past episodes and previous treatment", "past medical history and medication",
    "red-flag screening (unexplained weight loss, night sweats, bladder or bowel change, neurological symptoms, trauma)",
    "social history, work and daily function", "the patient's own concerns, expectations and goals",
  ],
  occupational_therapy: [
    "the reason for referral and the patient's main concern", "the condition and medical history in brief",
    "the occupational profile: roles, routines and activities that mattered before",
    "personal self-care (washing, dressing, toileting, eating)",
    "household and community tasks (cooking, marketing, money, medication, transport)",
    "the home environment and access (flat, lift, bathroom, steps, rails)",
    "family, carer and social support, and the carer's own capacity",
    "work, leisure, social and community participation", "cognition, mood, fatigue and how they feel about the change",
    "safety (falls, getting help)", "the patient's own goals and priorities",
  ],
};
const areasFor = (profession) => (/occup/i.test(String(profession || "")) ? AREAS.occupational_therapy : AREAS.physiotherapy);

export const scorerPrompt = ({ profession, vision }) =>
  PROMPT.replace("{{STUDENT}}", professionWords(profession).profession)
    .replace("{{AREAS}}", areasFor(profession).map((a) => `- ${a}`).join(String.fromCharCode(10)))
    .replace("{{VISION_INPUT}}", vision ? VISION_INPUT : "")
    .replace("{{VISION_DIMENSION}}", vision ? VISION_DIMENSION : "");

/** Adds the scorer to a room workflow in place. Returns the dimension keys it scores. */
export const addHtScorer = (workflow, { profession, vision = false } = {}) => {
  const { nodes, variables } = workflow;
  if (!nodes.patient || !nodes.response1 || !nodes.judge) return [];
  const keys = htKeys(vision);

  const returnType = {};
  const outVars = ["ht_turn"];
  for (const k of keys) {
    const f = htFields(k);
    variables[f.type] = { type: "str", default: "" };
    variables[f.score] = { type: "float", default: 0 };
    variables[f.note] = { type: "str", default: "" };
    returnType[f.type] = { type: "str", description: `"demonstrated", "partial", "slipped", or "" when nothing happened on ${k} this turn.` };
    returnType[f.score] = { type: "float", description: `The ${k} score 0-10 after this turn. Identical to last turn's when the type is "".` };
    returnType[f.note] = { type: "str", description: `One short sentence naming the moment, or "" when the type is "".` };
    outVars.push(f.type, f.score, f.note);
  }
  // The scorer's own memory of which areas are done; read back from its history, never sent out.
  returnType.coverage_areas = { type: "str", description: "Running comma-separated list of history areas opened so far, carried forward." };
  variables.coverage_areas = { type: "str", default: "" };
  variables.ht_turn = { type: "str", default: "yes" };
  variables.ht_score_history = { type: "list", default: [] };

  nodes.ht_score = {
    type: "llm",
    parameters: {
      service: process.env.VOXIO_SCORER_SERVICE || process.env.VOXIO_LLM_SERVICE || "groq",
      model: process.env.VOXIO_SCORER_MODEL || process.env.VOXIO_LLM_MODEL || "openai/gpt-oss-120b",
      prompt_template: "base_llm",
      system_prompt: scorerPrompt({ profession, vision }),
      input_variables: {
        user_input: { type: "str", description: "What the student just said." },
        speak: { type: "str", description: "What the patient said back, verbatim. Already spoken." },
      },
      history_key: "ht_score_history",
      summariser: false,
      llm_return_type: returnType,
    },
    next: "ht_score_out",
  };
  // `ht_turn` marks the packet so the room can tell a scoring result from any other out.
  nodes.ht_score_out = { type: "out", parameters: { variables: outVars }, next: "judge" };

  // Sequential, like ci: the judge (and with it the next input) waits for the score, so the
  // score lands in this turn and not in the next one.
  nodes.patient.next = "response1";
  const after = nodes.response1.next ? [].concat(nodes.response1.next) : [];
  nodes.response1.next = [...after, "ht_score"];
  return keys;
};
