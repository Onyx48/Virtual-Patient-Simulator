/**
 * Builds a scenario's Voxio flow: the workflow (conversation graph), the voice
 * and the avatar, all from what is saved on the scenario. Nothing is fixed per
 * scenario by hand; saving a scenario rebuilds its flow (utils/voxioSync.js).
 *
 * The workflow, step by step (Voxio step types in brackets):
 *
 *   greeting (say "Hi")
 *   input1 (listen) -> patient (AI thinks) -> response1 (say speak, movement, expression)
 *                                          -> judge (branch on end_diagnosis)
 *        no  -> input1
 *        yes -> feedback (AI thinks, silent: feedback, score, per-question results)
 *               phase_input (listen), side by side, so grading never delays the game
 *   phase_input -> phase_router (small fast model: "reflection" or "reasoning")
 *               -> phase_route (branch)
 *        reflection -> reflection guide loop
 *        reasoning  -> clinical reasoning tutor loop
 *   reflection (AI thinks: speak) -> reflection_say + reflection_input (listen)
 *        -> reflection_router (small fast model: "end" or "continue") -> branch
 *        continue -> reflection
 *        end      -> reflection_closing (say the closing line at once)
 *                    + reflection_result (AI thinks, silent: self_rating, summary,
 *                    status, distress_flag) -> phase_input
 *   reasoning (AI thinks) -> response2 (say) + reasoning_input -> reasoning
 *
 * What changes with the scenario:
 *   - the case brief, the feedback questions and the learning objectives;
 *   - the profession (PT or OT): who the student is and what they are called;
 *   - the language: every step speaks Japanese for a Japanese scenario, and the
 *     voice listens and speaks Japanese;
 *   - the patient's gender: picks the voice and the avatar faces;
 *   - the movements the 3D avatar may be asked to perform.
 */
import { readFileSync } from "fs";
import { REGION_MOVEMENTS } from "./bodyRegions.js";

/*
 * Video-avatar clips (docs/avatar/faces.json, uploaded by scripts/uploadFaces.mjs):
 * "<region>_<movement>[_left]_<version>" -> {uuid}. The scenario's animationTriggers
 * pick the version per movement (Full -> full, Ltd -> ltd, 90_Ltd -> 90, 120_Ltd -> 120);
 * the patient picks only the movement ("shoulder.flexion") as its `frame`.
 * Shoulder clips are of the LEFT shoulder.
 */
const CLIPS = (() => {
  try { return JSON.parse(readFileSync(new URL("../../docs/avatar/faces.json", import.meta.url), "utf8")); }
  catch { return {}; }
})();
const CLIP_VERSION = { full: "full", ltd: "ltd", "90_ltd": "90", "120_ltd": "120" };

/** {"shoulder.flexion": "90", ...} from the scenario's "Label_Value" triggers; unset = full. */
const limitsOf = (scenario) => {
  const out = {};
  for (const [region, moves] of Object.entries(REGION_MOVEMENTS)) {
    const triggers = (scenario?.animationTriggers?.[region] || []).map((t) => String(t).toLowerCase());
    for (const move of moves) {
      const hit = triggers.find((t) => t.startsWith(`${move}_`));
      out[`${region}.${move}`] = (hit && CLIP_VERSION[hit.slice(move.length + 1)]) || "full";
    }
  }
  return out;
};

/** [{label: "shoulder.flexion", uuid, version}] for every movement that has a clip in its chosen version. */
export const scenarioClips = (scenario) =>
  Object.entries(limitsOf(scenario)).flatMap(([label, version]) => {
    const [region, move] = label.split(".");
    const clip = CLIPS[`${region}_${move}${region === "shoulder" ? "_left" : ""}_${version}`];
    return clip ? [{ label, uuid: clip.uuid, version }] : [];
  });

const hasClips = () => Boolean(CLIPS.main?.uuid);
import { professionWords } from "./profession.js";
import { END_SESSION_INPUT, START_OF_REFLECTION, END_OF_REFLECTION, CLOSING, JAPANESE_OVERRIDE } from "./simEngine.js";

const readPrompt = (file) => readFileSync(new URL(`../ai/prompts/${file}`, import.meta.url), "utf8");

// Voxio's JSON-output protocol, with its {json.dumps(return_type)} placeholder
// that Voxio fills with each step's llm_return_type.
const KERNEL = `\n\n${readPrompt("voxio-kernel.md")}`;
const FEEDBACK_PROMPT = readPrompt("sim-feedback.md");
const REASONING_PROMPT = readPrompt("sim-reasoning.md");
const REFLECTION_PROMPT = readPrompt("sim-reflection.md").replace(/^<!--[\s\S]*?-->\s*/, "");
const dropHeader = (s) => s.replace(/^<!--[\s\S]*?-->\s*/, "");
// Clinical Reasoning, word for word from the Notion docs (guide v1.6, feedback engine v1.7, rubric v3.2).
const CR_GUIDE_PROMPT = dropHeader(readPrompt("cr-guide.md"));
const CR_ENGINE_PROMPT = dropHeader(readPrompt("cr-feedback-engine.md"));
const CR_RUBRIC = dropHeader(readPrompt("cr-rubric.md"));
export const START_OF_CLINICAL_REASONING = "[START_OF_CLINICAL_REASONING]";
export const END_OF_CLINICAL_REASONING = "[END_OF_CLINICAL_REASONING]";

const HT_TRANSCRIPT =
  'given to you as diagnosis_conversation_history ("user" = the learner, "assistant" = the patient; an entry with role "system" holds the case notes and was never said aloud)';

const crGuidePrompt = (ctx) =>
  CR_GUIDE_PROMPT.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    ({
      ht_transcript: HT_TRANSCRIPT,
      scenario_description: `\n${ctx.brief}\n`,
      learning_objectives: ctx.objectives,
      learner_name: "given to you as learner_name",
    })[key] ?? m);

/*
 * How the guide talks to the platform inside Voxio. The doc's hidden [NARROW] tag goes in its
 * own field, so it is never spoken but stays in the transcript the feedback engine reads.
 */
const CR_GUIDE_PROTOCOL = `

PLATFORM PROTOCOL
- Every reply is a JSON object with exactly three keys:
  - "speak": what you say out loud. Never put [NARROW] in it.
  - "narrow": "[NARROW]" when this turn is a narrowing question for a stuck learner (see IF THE LEARNER IS STUCK), otherwise "". This is the hidden tag; the platform keeps it in the transcript and never speaks it.
  - "cr_done": "yes" only in the turn where you speak your close (the normal close, after a skip, or an early close because the learner is upset), otherwise "no".
- The first message is ${START_OF_CLINICAL_REASONING}. It is not the learner speaking; reply with your OPENING followed by the Step 1 main question.
- You never produce the session record here; another step does that when the platform sends ${END_OF_CLINICAL_REASONING}.`;

const CR_RECORD_PROTOCOL = `

PLATFORM PROTOCOL
The platform has sent ${END_OF_CLINICAL_REASONING}. You are given the whole conversation as clinical_reasoning_history. Return only the SESSION RECORD, as JSON with the keys "cr_status", "cr_steps_completed" and "cr_distress_flag" (the status, steps_completed and distress_flag fields described above).`;

const crEnginePrompt = (ctx) =>
  CR_ENGINE_PROMPT.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    ({
      cr_transcript:
        'given to you as clinical_reasoning_history ("user" = the learner, "assistant" = the clinical-reasoning-AI-guide). The hidden tag of a guide turn is its "narrow" field: a turn whose "narrow" is "[NARROW]" starts with [NARROW] in the sense of these instructions',
      ht_transcript: HT_TRANSCRIPT,
      scenario_description: `\n${ctx.brief}\n`,
      rubric: `\n${CR_RUBRIC}\n`,
      learning_objectives: ctx.objectives,
      session_record: "given to you as cr_status, cr_steps_completed and cr_distress_flag",
      learner_name: "given to you as learner_name",
    })[key] ?? m);

const ROUTER = () => ({
  service: process.env.VOXIO_LLM_SERVICE || "groq",
  model: process.env.VOXIO_ROUTER_MODEL || "openai/gpt-oss-20b",
  prompt_template: "base_llm",
});

const LLM = () => ({
  service: process.env.VOXIO_LLM_SERVICE || "groq",
  model: process.env.VOXIO_LLM_MODEL || "openai/gpt-oss-120b",
  prompt_template: "base_llm",
});

/** Facial expressions the patient picks from each turn (3D avatar and Voxio faces). */
export const EXPRESSIONS = ["neutral", "pain", "worried", "frustrated", "relieved", "happy", "confused"];

const GREETING = { en: "Hi", ja: "こんにちは" };

const LANGUAGE_RULE = {
  ja: "\n\n# LANGUAGE\nThis scenario is in Japanese. Everything you say or write for the student is in natural, polite Japanese. Keep JSON keys and fixed values (yes/no, yes/partly/no, expression names, movement names) in English.",
  en: "",
};

/** "shoulder.flexion", ... for the regions this scenario's avatar can show. */
const allowedMovements = () =>
  Object.entries(REGION_MOVEMENTS).flatMap(([region, moves]) => moves.map((m) => `${region}.${m}`));

const frameRule = (frames) =>
  frames.length
    ? `
- frame: the movement your body shows this turn, exactly one of: "main", ${frames.map((f) => `"${f}"`).join(", ")}. Use the same movement as the first item of "movement" when it is one of these; otherwise "main".`
    : "";

const patientFields = (words, frames = []) => `

# OUTPUT FIELDS
- speak: exactly what you say out loud as the ${words.person}.
- movement: a list. Only when the student INSTRUCTS you to move or show a movement now ("lift your arm up in front", "turn your head to the left", "bend forward"), put the matching movement here, as "region.movement" from this list only: ${allowedMovements().join(", ")}. The list holds AT MOST ONE movement: the simulator can show only one movement at a time. If the student asks for two or more in one go ("bend forward and then lean back"), do only the first one now, and in "speak" say naturally that you will do the next one after (e.g. "Ok, this one first."); do the next one when they ask again. The simulator animates it with this case's limits; in "speak" say how it feels, true to the case. When nothing is asked, or the movement is not in the list (e.g. wrist or finger movements), use an empty list [] and describe it in words. A question ABOUT a movement ("does it hurt when you lift your arm?") is not an instruction: answer in words with [].${frameRule(frames)}
- expression: your facial expression while you say this, one of: ${EXPRESSIONS.join(", ")}. Match how you feel at that moment in the case.
- end_diagnosis: "yes" only if the input is exactly "${END_SESSION_INPUT}" or the student clearly ends the visit (says goodbye, "that's all for today", "we're done"). Otherwise "no". Always lowercase. When it is "yes", speak a brief, natural goodbye.`;

const withWords = (prompt, words) =>
  prompt
    .replaceAll("physiotherapy student", words.student)
    .replaceAll("physiotherapist", words.profession === "physiotherapy" ? "physiotherapist" : "occupational therapist");

const caseBrief = (brief) =>
  `\n\n# CASE BRIEF (hidden from the student; the full case the simulated person was given)\n${brief}`;

const reflectionPrompt = (ctx) =>
  REFLECTION_PROMPT.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (key === "transcript") return "given to you in the first message, after [START_OF_REFLECTION]";
    if (key === "learning_objectives") return ctx.objectives;
    if (key === "scenario_summary") return ctx.summary;
    if (key === "learner_name") return ""; // agreed with the client: never use the name
    return m;
  }) + (ctx.japanese ? JAPANESE_OVERRIDE : "");

/*
 * How the guide talks to the platform inside Voxio, replacing the PLATFORM
 * PROTOCOL of the client's prompt (which describes our own engine's replies).
 */
const REFLECTION_PROTOCOL = `

PLATFORM PROTOCOL (replaces the one above)

- Every reply is a JSON object with exactly one key, "speak": what you say out loud.
- The first message is ${START_OF_REFLECTION} followed by the session transcript. It is not the learner speaking; reply with your Step 1 opening.
- You never produce the dashboard JSON here; another step does that.`;

const RESULT_PROTOCOL = `

PLATFORM PROTOCOL (replaces the one above)

The reflection has ended (${END_OF_REFLECTION}). You are given the whole reflection conversation as reflection_conversation_history. Return only the dashboard fields described under DASHBOARD OUTPUT, plus "reflection_done": "yes". If the learner never answered, status is "skipped".`;

/** The workflow for one scenario. `ctx` is simEngine's scenarioFor() result. */
export const buildWorkflow = (ctx) => {
  const lang = ctx.japanese ? "ja" : "en";
  const words = professionWords(ctx.profession);
  const rule = LANGUAGE_RULE[lang];
  const str = (description) => ({ type: "str", description });
  const frames = hasClips() ? scenarioClips(ctx.scenario).map((c) => c.label) : [];

  return {
    variables: {
      user_input: { type: "str" },
      speak: { type: "str" },
      movement: { type: "list", default: [] },
      expression: { type: "str", default: "neutral" },
      frame: { type: "str", default: "main" },
      end_diagnosis: { type: "str", default: "no" },
      diagnosis_conversation_history: { type: "list", default: [] },
      feedback_conversation_history: { type: "list", default: [] },
      reflection_conversation_history: { type: "list", default: [] },
      phase_router_history: { type: "list", default: [] },
      phase: { type: "str" },
      reflection_step: { type: "str" },
      reflection_router_history: { type: "list", default: [] },
      reflection_result_history: { type: "list", default: [] },
      reflection_done: { type: "str", default: "no" },
      reasoning_conversation_history: { type: "list", default: [] },
      feedback_questions: { type: "str", value: ctx.questions },
      feedback: { type: "str" },
      score: { type: "float" },
      questions: { type: "list", default: [] },
      self_rating: { type: "int" },
      summary: { type: "str" },
      status: { type: "str" },
      distress_flag: { type: "bool", default: false },
      // Clinical Reasoning (guide v1.6 + feedback engine v1.7)
      learner_name: { type: "str", default: "" },
      narrow: { type: "str", default: "" },
      cr_done: { type: "str", default: "no" },
      cr_step: { type: "str" },
      clinical_reasoning_history: { type: "list", default: [] },
      cr_router_history: { type: "list", default: [] },
      cr_record_history: { type: "list", default: [] },
      cr_feedback_history: { type: "list", default: [] },
      cr_status: { type: "str" },
      cr_steps_completed: { type: "int", default: 0 },
      cr_distress_flag: { type: "bool", default: false },
      cr_feedback: { type: "str", default: "" },
    },
    start_node: "greeting",
    nodes: {
      greeting: { type: "out", parameters: { out_dict: { speak: GREETING[lang], expression: "neutral", movement: [] } }, next: "input1" },
      input1: { type: "input", parameters: { input_variables: { user_input: "str" } }, next: ["patient", "transcription1"] },
      transcription1: { type: "out", parameters: { variables: ["user_input"] } },
      patient: {
        type: "llm",
        parameters: {
          ...LLM(),
          system_prompt: (ctx.patientBrief || ctx.brief) + patientFields(words, frames) + rule + KERNEL,
          input_variables: { user_input: str(`What the ${words.student} said.`) },
          history_key: "diagnosis_conversation_history",
          summariser: false,
          llm_return_type: {
            speak: str(`What the ${words.person} says out loud.`),
            movement: { type: "list", description: 'At most ONE movement to animate, as ["region.movement"], or [] when none.' },
            expression: str(`Facial expression: one of ${EXPRESSIONS.join(", ")}.`),
            end_diagnosis: str('"yes" when the consultation is over, otherwise "no".'),
            ...(frames.length ? { frame: str(`The movement clip to play: "main" or one of ${frames.join(", ")}.`) } : {}),
          },
        },
        next: ["response1", "judge"],
      },
      response1: {
        type: "out",
        parameters: { variables: ["speak", "movement", "expression", "end_diagnosis", ...(frames.length ? ["frame"] : [])] },
        ...(frames.length ? { next: "reset_frame" } : {}),
      },
      // after each reply the avatar settles back to the idle clip
      ...(frames.length ? { reset_frame: { type: "out", parameters: { out_dict: { frame: "main" } } } } : {}),
      judge: {
        type: "conditional",
        parameters: { input_variables: { end_diagnosis: "str" }, mappings: { yes: ["feedback", "phase_input"], no: "input1" } },
      },
      feedback: {
        type: "llm",
        parameters: {
          ...LLM(),
          system_prompt: (lang === "ja" ? "WRITE THE FEEDBACK AND EVERY EVIDENCE NOTE IN JAPANESE.\n\n" : "") +
            withWords(FEEDBACK_PROMPT, words) + caseBrief(ctx.brief) + rule + KERNEL,
          input_variables: {
            diagnosis_conversation_history: { type: "list", description: `The ${words.consultation}: "user" = student, "assistant" = ${words.person}.` },
            feedback_questions: str("The numbered grading questions."),
          },
          history_key: "feedback_conversation_history",
          summariser: false,
          llm_return_type: {
            feedback: str(`3 or 4 paragraphs separated by a blank line (\n\n)${lang === "ja" ? ", written in Japanese" : ""}.`),
            score: { type: "float", description: "Share of grading questions met, strictly between 0 and 1." },
            questions: {
              type: "list",
              description: 'One object per grading question, in order: {"number": int, "observed": "yes" | "partly" | "no", "evidence": "max 25 words"}.',
            },
          },
        },
      },
      phase_input: { type: "input", parameters: { input_variables: { user_input: "str" } }, next: "phase_router" },
      /*
       * Voxio's branch step only matches fixed values (this deployment has no
       * working "anything else" path), so a small fast model turns the free
       * text into one: the reflection marker, or a reasoning question.
       */
      phase_router: {
        type: "llm",
        parameters: {
          ...ROUTER(),
          system_prompt: `Set "phase" to "reflection" if user_input starts with ${START_OF_REFLECTION}, to "clinical_reasoning" if it starts with ${START_OF_CLINICAL_REASONING}, otherwise "reasoning". Nothing else.` + KERNEL,
          input_variables: { user_input: str("The input.") },
          history_key: "phase_router_history",
          summariser: false,
          llm_return_type: { phase: str('"reflection", "clinical_reasoning" or "reasoning".') },
        },
        next: "phase_route",
      },
      phase_route: {
        type: "conditional",
        parameters: { input_variables: { phase: "str" }, mappings: { reflection: "reflection", clinical_reasoning: "cr_guide", reasoning: "reasoning" } },
      },
      /*
       * The self-reflection guide. On [END_OF_REFLECTION] it says the closing
       * line and fills in the dashboard result in the same reply, and sets
       * reflection_done to "yes".
       */
      /*
       * The self-reflection guide. Its first input is "[START_OF_REFLECTION]"
       * followed by the consultation transcript, sent by our server
       * (voxioEngine.startReflection).
       */
      reflection: {
        type: "llm",
        parameters: {
          ...LLM(),
          system_prompt: reflectionPrompt(ctx) + REFLECTION_PROTOCOL + rule + KERNEL,
          input_variables: { user_input: str("What the learner said, or the opening marker with the transcript.") },
          history_key: "reflection_conversation_history",
          summariser: false,
          llm_return_type: { speak: str("What you say out loud to the learner.") },
        },
        next: ["reflection_say", "reflection_input"],
      },
      reflection_say: { type: "out", parameters: { variables: ["speak"] } },
      reflection_input: { type: "input", parameters: { input_variables: { user_input: "str" } }, next: "reflection_router" },
      reflection_router: {
        type: "llm",
        parameters: {
          ...ROUTER(),
          system_prompt: `Set "reflection_step" to "end" if user_input is exactly ${END_OF_REFLECTION}, otherwise "continue". Nothing else.` + KERNEL,
          input_variables: { user_input: str("The input.") },
          history_key: "reflection_router_history",
          summariser: false,
          llm_return_type: { reflection_step: str('"end" or "continue".') },
        },
        next: "reflection_route",
      },
      reflection_route: {
        type: "conditional",
        parameters: {
          input_variables: { reflection_step: "str" },
          mappings: { end: ["reflection_closing", "reflection_result"], continue: "reflection" },
        },
      },
      // The closing line goes out at once; the result is written beside it.
      reflection_closing: { type: "out", parameters: { out_dict: { speak: CLOSING[lang] } } },
      reflection_result: {
        type: "llm",
        parameters: {
          ...LLM(),
          system_prompt: reflectionPrompt(ctx) + RESULT_PROTOCOL + KERNEL,
          input_variables: {
            reflection_conversation_history: { type: "list", description: "The whole reflection conversation." },
          },
          history_key: "reflection_result_history",
          summariser: false,
          llm_return_type: {
            self_rating: { type: "int", description: "The learner's 1-10 rating, or null." },
            summary: str("One sentence, max 20 words, to the learner; null if skipped."),
            status: str('"completed", "partial", "skipped" or "ended_early_distress".'),
            distress_flag: { type: "bool", description: "True if the learner showed clear distress." },
            reflection_done: str('Always "yes".'),
          },
        },
        next: "phase_input",
      },
      reasoning: {
        type: "llm",
        parameters: {
          ...LLM(),
          system_prompt:
            withWords(REASONING_PROMPT, words).replace(
              /# OUTPUT FIELD[\s\S]*$/,
              '# OUTPUT FIELD\n- speak: your reply to the student. Your JSON has exactly one key, "speak".',
            ) + caseBrief(ctx.brief) + rule + KERNEL,
          input_variables: {
            user_input: str("The student's question or reasoning."),
            diagnosis_conversation_history: { type: "list", description: "The consultation the student just had." },
            feedback: str("The feedback the student received."),
            feedback_questions: str("The grading questions for this case."),
          },
          history_key: "reasoning_conversation_history",
          summariser: false,
          llm_return_type: { speak: str("The tutor's reply, spoken aloud.") },
        },
        next: ["response2", "reasoning_input"],
      },
      /*
       * Clinical Reasoning, as in the Notion docs: the clinical-reasoning-AI-guide (v1.6) asks,
       * one question per turn, until the platform sends [END_OF_CLINICAL_REASONING]; the guide
       * then returns its session record, and the clinical-reasoning-feedback-engine (v1.7)
       * scores it against the rubric (v3.2). Started by [START_OF_CLINICAL_REASONING]; the
       * older free-question "reasoning" tutor below stays for the 3D game's /api/sessions/reasoning.
       * The guide is not given the history-taking feedback or score (doc 1.6).
       */
      cr_guide: {
        type: "llm",
        parameters: {
          ...LLM(),
          system_prompt: crGuidePrompt(ctx) + CR_GUIDE_PROTOCOL + rule + KERNEL,
          input_variables: {
            user_input: str("What the learner said, or the start marker."),
            diagnosis_conversation_history: { type: "list", description: "The history-taking session, including the movements the learner requested." },
            learner_name: str("The learner's first name; may be empty."),
          },
          history_key: "clinical_reasoning_history",
          summariser: false,
          llm_return_type: {
            speak: str("What you say out loud to the learner."),
            narrow: str('"[NARROW]" for a narrowing turn, otherwise "".'),
            cr_done: str('"yes" in the turn where you speak your close, otherwise "no".'),
          },
        },
        next: ["cr_say", "cr_input"],
      },
      cr_say: { type: "out", parameters: { variables: ["speak", "cr_done"] } },
      cr_input: { type: "input", parameters: { input_variables: { user_input: "str" } }, next: "cr_router" },
      cr_router: {
        type: "llm",
        parameters: {
          ...ROUTER(),
          system_prompt: `Set "cr_step" to "end" if user_input is exactly ${END_OF_CLINICAL_REASONING}, otherwise "continue". Nothing else.` + KERNEL,
          input_variables: { user_input: str("The input.") },
          history_key: "cr_router_history",
          summariser: false,
          llm_return_type: { cr_step: str('"end" or "continue".') },
        },
        next: "cr_route",
      },
      cr_route: {
        type: "conditional",
        parameters: { input_variables: { cr_step: "str" }, mappings: { end: "cr_record", continue: "cr_guide" } },
      },
      cr_record: {
        type: "llm",
        parameters: {
          ...LLM(),
          system_prompt: crGuidePrompt(ctx) + CR_RECORD_PROTOCOL + KERNEL,
          input_variables: { clinical_reasoning_history: { type: "list", description: "The whole Clinical Reasoning conversation." } },
          history_key: "cr_record_history",
          summariser: false,
          llm_return_type: {
            cr_status: str('"completed", "partial", "skipped" or "ended_early_distress".'),
            cr_steps_completed: { type: "int", description: "Steps (0 to 6) in which the main question was asked." },
            cr_distress_flag: { type: "bool", description: "True if the learner showed clear distress." },
          },
        },
        next: "cr_feedback",
      },
      cr_feedback: {
        type: "llm",
        parameters: {
          ...LLM(),
          system_prompt: crEnginePrompt(ctx) + rule + KERNEL,
          input_variables: {
            clinical_reasoning_history: { type: "list", description: "The Clinical Reasoning conversation, with each guide turn's narrow tag." },
            diagnosis_conversation_history: { type: "list", description: "The history-taking session, including the movements the learner requested." },
            cr_status: str("Session record: status."),
            cr_steps_completed: { type: "int", description: "Session record: steps completed." },
            cr_distress_flag: { type: "bool", description: "Session record: distress flag." },
            learner_name: str("The learner's first name; may be empty."),
          },
          history_key: "cr_feedback_history",
          summariser: false,
          llm_return_type: {
            cr_feedback: { type: "str", description: "The whole OUTPUT JSON object described above, written as one JSON string (criteria, element_independence, summary, went_well, work_on, focus_next_time, case_reveal, dashboard_summary, missed_red_flag, distress_flag)." },
          },
        },
        next: "cr_feedback_out",
      },
      cr_feedback_out: { type: "out", parameters: { variables: ["cr_feedback", "cr_status"] }, next: "phase_input" },
      response2: { type: "out", parameters: { variables: ["speak"] } },
      reasoning_input: { type: "input", parameters: { input_variables: { user_input: "str" } }, next: "reasoning" },
    },
  };
};

// ---- voice and avatar --------------------------------------------------------

const envJson = (name) => {
  try {
    return process.env[name] ? JSON.parse(process.env[name]) : null;
  } catch {
    console.error(`[VOXIO] ${name} is not valid JSON; ignored.`);
    return null;
  }
};

/**
 * Listening: Soniox (what the game already uses), in the scenario's language.
 * Speaking: the voice set in .env for this language and gender, if any;
 * otherwise Voxio's default voice is left alone.
 */
export const buildVoice = (ctx) => {
  const lang = ctx.japanese ? "ja" : "en";
  const gender = /^f/i.test(ctx.scenario?.patientGender || "") ? "FEMALE" : "MALE";
  const stt = envJson(`VOXIO_STT_${lang.toUpperCase()}`) || {
    service: "soniox",
    model: "stt-rt-v4",
    language: lang === "ja" ? ["ja", "en"] : ["en"],
    "max-speakers": 1,
  };
  const voiceId = process.env[`VOXIO_TTS_VOICE_${lang.toUpperCase()}_${gender}`];
  const tts = envJson(`VOXIO_TTS_${lang.toUpperCase()}_${gender}`) ||
    (voiceId
      ? { service: process.env.VOXIO_TTS_SERVICE || "elevenlabs", model: process.env.VOXIO_TTS_MODEL || "eleven_flash_v2_5", voice: voiceId }
      : null);
  return { stt, tts };
};

/**
 * Talking-avatar faces for Voxio's own avatar widget, by patient gender, from
 * VOXIO_FACES_MALE / VOXIO_FACES_FEMALE (JSON arrays of {uuid, label, usage},
 * labels from EXPRESSIONS). The Unreal 3D avatar does not need these: it reads
 * `expression` and `movement` from every patient reply.
 */
export const buildFaces = (ctx) => {
  const gender = /^f/i.test(ctx.scenario?.patientGender || "") ? "FEMALE" : "MALE";
  const fromEnv = envJson(`VOXIO_FACES_${gender}`);
  // our uploaded clips: idle "main" + one face per movement, in this scenario's version
  if (!fromEnv && hasClips()) {
    return {
      faces: [
        { uuid: CLIPS.main.uuid, label: "main", usage: "idle, at rest" },
        ...scenarioClips(ctx.scenario).map((c) => ({ uuid: c.uuid, label: c.label, usage: `${c.label.replace(".", " ").replace(/_/g, " ")} (${c.version})` })),
      ],
      transitions: [],
    };
  }
  return {
    faces: fromEnv || [],
    transitions: envJson(`VOXIO_TRANSITIONS_${gender}`) || [],
  };
};

/** Where Voxio posts session events, when this server has a public address. */
export const webhookUrl = () => {
  const base = (process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
  if (!base || !process.env.VOXIO_WEBHOOK_SECRET) return null;
  return `${base}/api/voxio/webhook?token=${encodeURIComponent(process.env.VOXIO_WEBHOOK_SECRET)}`;
};

/** Everything Voxio needs to create or update the scenario's flow. */
export const buildFlow = (ctx, name) => ({
  name: String(name || ctx.scenario?.scenarioName || "Scenario").slice(0, 120),
  workflow: buildWorkflow(ctx),
  webhookUrl: webhookUrl(),
  ...buildVoice(ctx),
  ...buildFaces(ctx),
  processType: process.env.VOXIO_PROCESS_TYPE || "speech-native",
});
