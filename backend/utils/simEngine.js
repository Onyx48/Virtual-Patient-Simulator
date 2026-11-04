/**
 * The simulator's conversation engine: plays the patient, runs the
 * self-reflection-AI-guide, grades the consultation and runs the
 * clinical-reasoning tutor, with direct LLM calls.
 *
 * Phases of one session:
 *   consultation -> reflection (optional) -> reasoning
 * Grading runs in the background from the moment the consultation ends, so the
 * feedback is ready when the reflection is over; the reflection never sees it.
 *
 * State lives in SimConversation, keyed by the session_id that
 * POST /api/sessions/start or POST /api/scenarios/json mints. Results are also
 * written onto the matching Session row, which is what the dashboards read.
 */
import { readFileSync } from "fs";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import SimConversation from "../models/simConversationModel.js";
import { getLiveScenario, getLiveMeta } from "../state/liveScenario.js";
import { htmlToText, questionsToArray } from "./bubbleScenario.js";
import { decodeEntities } from "./richText.js";
import { chatJson } from "./simLlm.js";

/*
 * The exact turn that ends the consultation. The game sends it through the
 * patient channel, and POST /api/sessions/feedback treats it as "end now".
 */
export const END_SESSION_INPUT = "Let's end the session";

export const GREETING = "Hi";

const readPrompt = (file) =>
  readFileSync(new URL(`../ai/prompts/${file}`, import.meta.url), "utf8");

const PATIENT_FIELDS = readPrompt("sim-patient.md").replaceAll("{{END_SESSION_INPUT}}", END_SESSION_INPUT);
const FEEDBACK_PROMPT = readPrompt("sim-feedback.md");
const REASONING_PROMPT = readPrompt("sim-reasoning.md");
const REFLECTION_PROMPT = readPrompt("sim-reflection.md").replace(/^<!--[\s\S]*?-->\s*/, "");

// Control messages from the game during the reflection (see simRoutes.js).
export const START_OF_REFLECTION = "[START_OF_REFLECTION]";
export const END_OF_REFLECTION = "[END_OF_REFLECTION]";

const SCHEMAS = {
  patient: {
    type: "OBJECT",
    properties: {
      speak: { type: "STRING" },
      movement: { type: "ARRAY", items: { type: "STRING" } },
      end_diagnosis: { type: "STRING", enum: ["yes", "no"] },
    },
    required: ["speak", "end_diagnosis"],
  },
  feedback: {
    type: "OBJECT",
    properties: {
      feedback: { type: "STRING" },
      score: { type: "NUMBER" },
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            number: { type: "INTEGER" },
            observed: { type: "STRING", enum: ["yes", "partly", "no"] },
            evidence: { type: "STRING" },
          },
          required: ["number", "observed", "evidence"],
        },
      },
    },
    required: ["feedback", "score", "questions"],
  },
  reflectionTurn: {
    type: "OBJECT",
    properties: { speak: { type: "STRING" } },
    required: ["speak"],
  },
  reflectionResult: {
    type: "OBJECT",
    properties: {
      self_rating: { type: "INTEGER", nullable: true },
      summary: { type: "STRING", nullable: true },
      status: { type: "STRING", enum: ["completed", "partial", "skipped", "ended_early_distress"] },
      distress_flag: { type: "BOOLEAN" },
    },
    required: ["self_rating", "summary", "status", "distress_flag"],
  },
  reasoning: {
    type: "OBJECT",
    properties: { response: { type: "STRING" } },
    required: ["response"],
  },
};

export const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// ---- grading questions -----------------------------------------------------

/*
 * The client's eight History Taking criteria, named as in the VPS History
 * Taking Feedback Report Template.
 */
export const HT_CRITERIA = [
  "Relevant History Gathering",
  "Follow-Up & Probing",
  "Psychosocial & Contextual Exploration",
  "Relevance & Prioritisation",
  "Red Flags & Safety Screening",
  "Questioning Technique & Communication",
  "Organisation & Adaptability",
  "Presenting Concern Exploration",
];

/*
 * Criterion for each of the 24 mandatory questions, in their fixed order
 * (Q1..Q24), as the report template assigns them. Translated (Japanese)
 * scenarios keep the same order, so this holds for them too.
 *
 * Scenarios made before Q19-Q24 were added have 18 mandatory questions and
 * then their 5 case-specific ones (23 in all), so Q19+ only take a fixed
 * criterion in a list long enough to hold all 24 (see parseQuestion).
 */
const STANDARD_QUESTION_CRITERIA = [
  "Presenting Concern Exploration", // 1 onset and duration
  "Presenting Concern Exploration", // 2 aggravating and relieving factors
  "Psychosocial & Contextual Exploration", // 3 impact on daily activities
  "Relevant History Gathering", // 4 previous treatments or medications
  "Red Flags & Safety Screening", // 5 red flag symptoms
  "Presenting Concern Exploration", // 6 nature and quality of the pain
  "Presenting Concern Exploration", // 7 associated symptoms
  "Relevant History Gathering", // 8 medical history
  "Psychosocial & Contextual Exploration", // 9 lifestyle factors
  "Follow-Up & Probing", // 10 active listening and follow-up
  "Questioning Technique & Communication", // 11 clear, empathetic communication
  "Relevant History Gathering", // 12 radiological investigation
  "Presenting Concern Exploration", // 13 24-hour behaviour
  "Psychosocial & Contextual Exploration", // 14 goals for treatment
  "Relevant History Gathering", // 15 effectiveness of previous treatment
  "Follow-Up & Probing", // 16 relationship between symptom areas
  "Questioning Technique & Communication", // 17 empathy statement
  "Presenting Concern Exploration", // 18 other painful areas
  "Questioning Technique & Communication", // 19 polite and respectful
  "Questioning Technique & Communication", // 20 clear, concise questions
  "Questioning Technique & Communication", // 21 sensitive questions tactfully
  "Psychosocial & Contextual Exploration", // 22 beliefs, concerns, expectations
  "Organisation & Adaptability", // 23 structure and summary
  "Questioning Technique & Communication", // 24 explains the symptoms
];
const OLD_MANDATORY_COUNT = 18;

/*
 * The fixed criterion for a question by position, only for a list laid out
 * the standard way: 18 + 5 (older scenarios) or 24 + 5. A hand-written list of
 * a few questions follows no such order, so its questions get only a tag.
 */
const standardCriterion = (index, total) => {
  if (total < OLD_MANDATORY_COUNT + 5) return null;
  if (index < OLD_MANDATORY_COUNT) return STANDARD_QUESTION_CRITERIA[index];
  return total > STANDARD_QUESTION_CRITERIA.length ? STANDARD_QUESTION_CRITERIA[index] ?? null : null;
};

/*
 * A case-specific question carries its criterion as a leading tag, e.g.
 * "[Red Flags & Safety Screening] Did the student ask about night pain?".
 * The tag stays in English in every language, so it can be read here.
 */
const CRITERION_TAG = /^\s*\[([^\]]+)\]\s*/;

const parseQuestion = (raw, index, all) => {
  const text = String(raw).replace(/^\d+[.)]\s*/, "");
  const tag = text.match(CRITERION_TAG);
  const tagged = tag && HT_CRITERIA.find((c) => c.toLowerCase() === tag[1].trim().toLowerCase());
  return {
    number: index + 1,
    question: tag ? text.slice(tag[0].length) : text,
    criterion: tagged || standardCriterion(index, all.length),
  };
};

// ---- scenario --------------------------------------------------------------

const scenarioCache = new Map(); // id -> { at, brief, questions }
const SCENARIO_TTL_MS = 60_000;

/*
 * The objectives a scenario was written with: the learningObjectives field
 * when the educator or the AI filled it in, else the "Simulation Objectives
 * for Student" section every AI-written scenario prompt has (older scenarios),
 * else the eight History Taking criteria as general objectives.
 */
const OBJECTIVES_HEADING = /^(Simulation Objectives for Student|学生のシミュレーション目標)\s*[:：]\s*/m;
const learningObjectivesOf = (scenario, brief) => {
  const own = htmlToText(decodeEntities(scenario.learningObjectives || "")).trim();
  if (own) return own;
  const at = brief.search(OBJECTIVES_HEADING);
  if (at !== -1) {
    const rest = brief.slice(at).replace(OBJECTIVES_HEADING, "");
    // The section runs until the next "Heading:" line or the instructions block.
    const end = rest.search(/\n\s*(---|[^\n]{1,60}[:：]\s*(\n|$))/);
    const section = (end === -1 ? rest : rest.slice(0, end)).trim();
    if (section) return section;
  }
  return `Take a focused, well-sequenced history: ${HT_CRITERIA.join("; ")}.`;
};

/** A short description of the case: its title and the patient profile line. */
const scenarioSummaryOf = (scenario, brief) => {
  const lines = brief.split("\n").map((l) => l.trim()).filter(Boolean);
  const head = lines.filter((l) => !l.startsWith("---")).slice(0, 2).join(" ");
  return (head || scenario.scenarioName || "").slice(0, 400);
};

const JAPANESE_TEXT = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
const isJapanese = (scenario, brief) =>
  /japanese|日本語/i.test(scenario.language || "") || JAPANESE_TEXT.test(brief.slice(0, 500));

/** The patient brief and grading questions, as plain text. */
const scenarioFor = async (scenarioId) => {
  const hit = scenarioCache.get(scenarioId);
  if (hit && Date.now() - hit.at < SCENARIO_TTL_MS) return hit;

  const scenario = await Scenario.findById(scenarioId)
    .select("scenarioName scenarioPrompt aiQuestions learningObjectives language")
    .lean();
  if (!scenario) throw httpError(404, "The scenario for this session no longer exists.");

  const brief = htmlToText(decodeEntities(scenario.scenarioPrompt || ""));
  const questionList = questionsToArray(decodeEntities(scenario.aiQuestions || "")).map(parseQuestion);
  const questions = questionList.map((q) => `${q.number}. ${q.question}`).join(" ");
  const entry = {
    at: Date.now(),
    brief,
    questions,
    questionList,
    objectives: learningObjectivesOf(scenario, brief),
    summary: scenarioSummaryOf(scenario, brief),
    japanese: isJapanese(scenario, brief),
  };
  scenarioCache.set(scenarioId, entry);
  return entry;
};

/**
 * Which scenario a session belongs to: the student's Session row, else the
 * live slot (an educator's Test run), else a scenario looked up by the api_key
 * the game was handed.
 */
const resolveScenarioId = async (sessionId, apiKey) => {
  const row = await Session.findOne({ session_id: sessionId }).select("scenario_id").lean();
  if (row?.scenario_id) return row.scenario_id;

  const live = getLiveScenario();
  if (live && String(getLiveMeta().sessionId) === sessionId) return String(live._id);

  if (apiKey) {
    const byKey = await Scenario.findOne({ apiKey }).select("_id").lean();
    if (byKey) return String(byKey._id);
  }
  return null;
};

/** The conversation for a session, created on first use. */
export const getConversation = async (sessionId, { apiKey, create = true } = {}) => {
  const existing = await SimConversation.findOne({ session_id: sessionId });
  if (existing || !create) return existing;

  const scenarioId = await resolveScenarioId(sessionId, apiKey);
  if (!scenarioId) throw httpError(404, "No simulator session with that session_id.");
  try {
    return await SimConversation.create({ session_id: sessionId, scenario_id: scenarioId });
  } catch (err) {
    // Two first turns racing: the loser reads the winner's row.
    if (err.code === 11000) return SimConversation.findOne({ session_id: sessionId });
    throw err;
  }
};

/**
 * POST /agents/start_session: bind a session to the scenario behind api_key and
 * start it from the beginning. Starting an existing session_id again resets
 * it, as Voxio did. Resolves to null when no scenario has that key.
 */
export const startSession = async (sessionId, apiKey) => {
  const scenario = await Scenario.findOne({ apiKey }).select("_id").lean();
  if (!scenario) return null;
  return SimConversation.findOneAndUpdate(
    { session_id: sessionId },
    {
      $set: {
        scenario_id: String(scenario._id),
        phase: "consultation",
        diagnosis_history: [],
        reasoning_history: [],
        reflection_history: [],
        feedback: "",
        score: null,
        question_results: [],
        end_diagnosis: "no",
      },
      $unset: { reflection: "" },
    },
    { upsert: true, new: true },
  );
};

// ---- one session at a time -------------------------------------------------

/*
 * Turns for the same session run one after another. The game can retry a turn
 * it thinks timed out, and two turns appending to the history at once would
 * lose one. Per process: fine for the single pm2 backend instance.
 */
const queues = new Map();
const serial = (sessionId, work) => {
  const previous = queues.get(sessionId) || Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  queues.set(sessionId, next);
  next.finally(() => {
    if (queues.get(sessionId) === next) queues.delete(sessionId);
  }).catch(() => {});
  return next;
};

// ---- dashboard record ------------------------------------------------------

const saveToSession = async (conv) => {
  await Session.updateOne(
    { session_id: conv.session_id },
    {
      $set: {
        transcription: conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
        feedback: conv.feedback || "",
        score: Number.isFinite(conv.score) ? conv.score : 0,
        question_results: conv.question_results || [],
        ...(conv.reflection?.status && { reflection: conv.reflection }),
      },
    },
  ).catch((err) => console.error(`[SIM] could not update Session ${conv.session_id}: ${err.message}`));
};

// ---- the three phases ------------------------------------------------------

/** Clamp the grader's score into [0, 1]; null when it gave none. */
const toScore = (value) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n)
    ? null
    : Math.min(Math.max(n, 0), 1);
};

/*
 * Models sometimes return the paragraphs joined by spaces despite the prompt.
 * Three or more spaces between sentences is where a blank line was meant.
 */
const fixParagraphs = (text) => String(text || "").replace(/([.!?"'”])\s{3,}/g, "$1\n\n").trim();

/**
 * The grader's per-question verdicts, joined to the scenario's own question
 * list: one entry per question, in order, whatever the model left out or
 * repeated. A question the model did not return is recorded as "no" with no
 * evidence rather than dropped, so the table always has every row.
 */
const questionResults = (questionList, returned) => {
  const byNumber = new Map();
  for (const r of Array.isArray(returned) ? returned : []) {
    const n = Number(r?.number);
    if (Number.isInteger(n) && !byNumber.has(n)) byNumber.set(n, r);
  }
  return questionList.map((q) => {
    const r = byNumber.get(q.number);
    const observed = ["yes", "partly", "no"].includes(String(r?.observed).toLowerCase())
      ? String(r.observed).toLowerCase()
      : "no";
    return { ...q, observed, evidence: String(r?.evidence ?? "").trim() };
  });
};

const grade = async (conv) => {
  const { brief, questions, questionList } = await scenarioFor(conv.scenario_id);
  const history = [
    { role: "system", content: brief },
    ...conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
  ];
  const { data, usage } = await chatJson({
    label: `feedback session=${conv.session_id}`,
    system: FEEDBACK_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({ diagnosis_conversation_history: history, feedback_questions: questions }),
      },
    ],
    schema: SCHEMAS.feedback,
    effort: "medium",
  });
  if (!String(data.feedback || "").trim()) throw httpError(502, "The grader returned no feedback.");

  conv.feedback = fixParagraphs(data.feedback);
  conv.score = toScore(data.score);
  conv.question_results = questionResults(questionList, data.questions);
  /*
   * Written field by field rather than with conv.save(): grading runs in the
   * background while the reflection is saving its own turns on the same
   * document, and neither may overwrite the other. The phase is not touched;
   * that belongs to the reflection and the feedback call.
   */
  await SimConversation.updateOne(
    { session_id: conv.session_id },
    { $set: { feedback: conv.feedback, score: conv.score, question_results: conv.question_results } },
  );
  await saveToSession(conv);
  return { feedback: conv.feedback, score: conv.score, usage };
};

/*
 * session_id -> the grading running for it. Kept outside the per-session turn
 * queue on purpose: grading takes several seconds and must not hold up the
 * reflection turns that run at the same time.
 */
const grading = new Map();

/** Grade the consultation once; a second caller waits for the same result. */
const startGrading = (sessionId) => {
  if (grading.has(sessionId)) return grading.get(sessionId);
  const run = (async () => {
    const conv = await SimConversation.findOne({ session_id: sessionId });
    if (!conv) throw httpError(404, "No simulator session with that session_id.");
    if (conv.feedback) return { feedback: conv.feedback, score: conv.score, repeated: true };
    return grade(conv);
  })().finally(() => grading.delete(sessionId));
  grading.set(sessionId, run);
  return run;
};

const gradeInBackground = (sessionId) =>
  startGrading(sessionId).catch((err) =>
    // Not lost: /api/sessions/feedback grades again when it finds no feedback.
    console.error(`[SIM] background grading failed session=${sessionId}: ${err.message}`),
  );

/**
 * One consultation turn: the student's words in, the patient's reply out.
 * When the patient ends the visit, grading starts in the background; the
 * goodbye goes back at once.
 */
export const patientTurn = (sessionId, userInput, opts = {}) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, opts);
    if (conv.phase !== "consultation") {
      throw httpError(409, "This consultation has already ended.");
    }

    const text = String(userInput || "").trim();
    if (!text) throw httpError(400, "user_input is empty.");

    const { brief } = await scenarioFor(conv.scenario_id);
    const messages = [
      ...conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
      { role: "user", content: text },
    ];
    const { data, usage } = await chatJson({
      label: `patient session=${sessionId}`,
      system: brief + PATIENT_FIELDS,
      messages,
      schema: SCHEMAS.patient,
      effort: "low",
    });

    const speak = String(data.speak ?? "").trim();
    if (!speak) throw httpError(502, "The patient returned no reply.");
    const endDiagnosis = String(data.end_diagnosis).toLowerCase() === "yes" ? "yes" : "no";

    conv.diagnosis_history.push({ role: "user", content: text }, { role: "assistant", content: speak });
    conv.end_diagnosis = endDiagnosis;
    await conv.save();
    await saveToSession(conv);

    if (endDiagnosis === "yes") gradeInBackground(sessionId);
    return { speak, end_diagnosis: endDiagnosis, movement: [], usage };
  });

/**
 * End the consultation and grade it. Idempotent: a repeat call returns the
 * feedback already produced instead of grading again.
 */
export const endAndGrade = async (sessionId, opts = {}) => {
  const conv = await getConversation(sessionId, opts);
  // Without a reflection, asking for feedback ends the consultation.
  if (conv.phase === "consultation") {
    await SimConversation.updateOne(
      { session_id: sessionId, phase: "consultation" },
      { $set: { phase: "reasoning" } },
    );
  }
  return startGrading(sessionId);
};

// ---- self-reflection -------------------------------------------------------

const CLOSING = {
  en: "Thanks. Your feedback is ready for you now.",
  ja: "ありがとうございました。フィードバックの準備ができました。",
};

const JAPANESE_OVERRIDE = `

LANGUAGE (overrides the spelling rule above)

This scenario is in Japanese. Hold the whole reflection in natural, polite spoken Japanese, and write the "summary" field in Japanese. Keep the JSON keys and the status values in English.`;

/** The consultation as numbered turns, so the guide can point to a moment. */
const numberedTranscript = (history) => {
  let turn = 0;
  return history
    .map(({ role, content }) => {
      if (role === "user") turn += 1;
      return `Turn ${turn} ${role === "user" ? "Learner" : "Patient"}: ${content}`;
    })
    .join("\n");
};

const reflectionSystem = async (conv) => {
  const sc = await scenarioFor(conv.scenario_id);
  const fill = {
    transcript: numberedTranscript(conv.diagnosis_history) || "(The learner did not speak.)",
    learning_objectives: sc.objectives,
    scenario_summary: sc.summary,
    // Agreed with the client: the guide never uses the learner's name.
    learner_name: "",
  };
  const prompt = REFLECTION_PROMPT.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in fill ? fill[key] : m));
  return { system: prompt + (sc.japanese ? JAPANESE_OVERRIDE : ""), japanese: sc.japanese };
};

const reflectionMessages = (conv, extra) => [
  ...conv.reflection_history.map(({ role, content }) => ({ role, content })),
  ...(extra ? [{ role: "user", content: extra }] : []),
];

const guideSays = async (conv, input) => {
  const { system } = await reflectionSystem(conv);
  const { data } = await chatJson({
    label: `reflection session=${conv.session_id}`,
    system,
    messages: reflectionMessages(conv, input),
    schema: SCHEMAS.reflectionTurn,
    effort: "low",
  });
  const speak = String(data.speak ?? "").trim();
  if (!speak) throw httpError(502, "The self-reflection guide returned no reply.");
  return speak;
};

const lastGuideLine = (conv) =>
  [...conv.reflection_history].reverse().find((t) => t.role === "assistant")?.content || "";

/**
 * The learner pressed End Session: the consultation is over, grading starts in
 * the background, and the guide opens the reflection. Calling it again while
 * the reflection is running repeats the guide's last line instead of starting
 * over.
 */
export const startReflection = (sessionId) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, { create: false });
    if (!conv) throw httpError(404, "Session not found or expired");
    // Finished, or ended with its summary still being written.
    if (conv.reflection?.status || (conv.phase === "reasoning" && conv.reflection_history.length)) {
      throw httpError(409, "The reflection for this session is already finished.");
    }
    if (conv.phase === "reflection" && conv.reflection_history.length) return lastGuideLine(conv);

    gradeInBackground(sessionId);
    conv.phase = "reflection";
    conv.reflection_history = [];
    const speak = await guideSays(conv, START_OF_REFLECTION);
    conv.reflection_history.push(
      { role: "user", content: START_OF_REFLECTION },
      { role: "assistant", content: speak },
    );
    await conv.save();
    return speak;
  });

const toSelfRating = (v) => {
  const n = Math.round(Number(v));
  return v === null || v === undefined || v === "" || !Number.isFinite(n) || n < 1 || n > 10 ? null : n;
};
const REFLECTION_STATUSES = ["completed", "partial", "skipped", "ended_early_distress"];

/*
 * [END_OF_REFLECTION]: turn the conversation into the dashboard result. A
 * learner who never answered skipped it; no model call is needed for that.
 *
 * Runs after the closing line has gone back to the game (the model call takes
 * several seconds), on a copy of the conversation taken at that moment. It is
 * written field by field, like grading, so it cannot overwrite the tutor turns
 * that may already be saving on the same document. If the model call fails,
 * the reflection is still recorded, as "partial" with no rating or summary.
 */
const saveReflection = async (sessionId, conv) => {
  const learnerTurns = conv.reflection_history.filter(
    (t) => t.role === "user" && t.content !== START_OF_REFLECTION,
  ).length;

  let result = { self_rating: null, summary: null, status: "skipped", distress_flag: false };
  if (learnerTurns > 0) {
    try {
      const { system } = await reflectionSystem(conv);
      const { data } = await chatJson({
        label: `reflection result session=${sessionId}`,
        system,
        messages: reflectionMessages(conv, END_OF_REFLECTION),
        schema: SCHEMAS.reflectionResult,
        effort: "low",
      });
      const summary = String(data.summary ?? "").trim();
      result = {
        self_rating: toSelfRating(data.self_rating),
        summary: summary || null,
        status: REFLECTION_STATUSES.includes(data.status) ? data.status : "partial",
        distress_flag: data.distress_flag === true,
      };
    } catch (err) {
      console.error(`[SIM] reflection summary failed session=${sessionId}: ${err.message}`);
      result = { self_rating: null, summary: null, status: "partial", distress_flag: false };
    }
  }

  const reflection = { ...result, completed_at: new Date() };
  await SimConversation.updateOne({ session_id: sessionId }, { $set: { reflection } });
  await Session.updateOne({ session_id: sessionId }, { $set: { reflection } }).catch((err) =>
    console.error(`[SIM] could not update Session ${sessionId}: ${err.message}`),
  );
  console.log(
    `[SIM] reflection finished session=${sessionId} status=${result.status} ` +
      `self_rating=${result.self_rating} distress=${result.distress_flag} learnerTurns=${learnerTurns}`,
  );
  return result;
};

/**
 * One reflection turn: the learner's words in, the guide's next question out.
 * [END_OF_REFLECTION] (sent by the game when the learner continues, skips or
 * times out) closes it and saves the result.
 */
export const reflectionTurn = (sessionId, input) =>
  serial(sessionId, async () => {
    const conv = await getConversation(sessionId, { create: false });
    if (!conv) throw httpError(404, "Session not found or expired");
    if (conv.phase !== "reflection") throw httpError(409, "No reflection is running for this session.");

    const { japanese } = await reflectionSystem(conv);
    if (String(input).trim() === END_OF_REFLECTION) {
      // The closing line goes back now; the summary is written in the background.
      conv.phase = "reasoning";
      await conv.save();
      const snapshot = conv.toObject();
      saveReflection(sessionId, snapshot).catch((err) =>
        console.error(`[SIM] could not save reflection session=${sessionId}: ${err.message}`),
      );
      return CLOSING[japanese ? "ja" : "en"];
    }

    const speak = await guideSays(conv, String(input));
    conv.reflection_history.push(
      { role: "user", content: String(input) },
      { role: "assistant", content: speak },
    );
    await conv.save();
    return speak;
  });

/** One clinical-reasoning turn, after feedback. Resolves to { response, usage }. */
export const reasoningTurn = (sessionId, input) =>
  serial(sessionId, async () => {
    let conv = await getConversation(sessionId, { create: false });
    if (!conv) throw httpError(404, "No simulator session with that session_id.");
    // Grading may still be running in the background from the end of the
    // consultation; wait for it rather than refusing the learner's question.
    if (!conv.feedback && grading.has(sessionId)) {
      await grading.get(sessionId).catch(() => {});
      conv = await getConversation(sessionId, { create: false });
    }
    if (!conv.feedback) {
      throw httpError(409, "Call /api/sessions/feedback for this session before clinical reasoning.");
    }

    const { brief, questions } = await scenarioFor(conv.scenario_id);
    const context = {
      diagnosis_conversation_history: [
        { role: "system", content: brief },
        ...conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
      ],
      feedback: conv.feedback,
      feedback_questions: questions,
    };
    const messages = [
      { role: "user", content: `Context for this tutoring conversation:\n${JSON.stringify(context)}` },
      { role: "assistant", content: JSON.stringify({ response: "Understood. Ask me anything about your consultation." }) },
      ...conv.reasoning_history.map(({ role, content }) => ({ role, content })),
      { role: "user", content: JSON.stringify({ user_input: String(input) }) },
    ];
    const { data, usage } = await chatJson({
      label: `reasoning session=${sessionId}`,
      system: REASONING_PROMPT,
      messages,
      schema: SCHEMAS.reasoning,
      effort: "low",
    });

    const response = String(data.response ?? data.speak ?? "").trim();
    if (!response) throw httpError(502, "The reasoning tutor returned no reply.");
    conv.reasoning_history.push(
      { role: "user", content: String(input) },
      { role: "assistant", content: response },
    );
    await conv.save();
    return { response, usage };
  });

/**
 * Everything about a session in the shape Voxio's GET /agents/session used to
 * return, so anything still reading that shape keeps working.
 */
export const voxioStyleState = (conv) =>
  conv && {
    diagnosis_conversation_history: conv.diagnosis_history.map(({ role, content }) => ({ role, content })),
    reasoning_conversation_history: conv.reasoning_history.map(({ role, content }) => ({ role, content })),
    feedback: conv.feedback || undefined,
    score: conv.score,
    end_diagnosis: conv.end_diagnosis,
    speak: [...conv.diagnosis_history].reverse().find((t) => t.role === "assistant")?.content ?? GREETING,
    response: [...conv.reasoning_history].reverse().find((t) => t.role === "assistant")?.content,
    node_type: conv.phase,
  };

export const isValidSessionId = (id) => typeof id === "string" && id.length > 0 && id.length <= 64;
