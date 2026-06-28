/**
 * Generates realistic random sessions for Benjamin's 369 SIT students.
 * Each student-scenario pair gets 0-3 sessions with:
 *  - Realistic physiotherapy assessment transcription
 *  - Score 0.35-0.95 (later attempts trend higher)
 *  - AI-style feedback paragraph
 *  - createdAt spread over the last 90 days
 *
 * Dry run:  node generateSessions.js
 * Apply:    node generateSessions.js --run
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import User from "../models/userModel.js";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";

// ─── helpers ───────────────────────────────────────────────────────────────

function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function randBetween(min, max, rng) {
  return min + rng() * (max - min);
}

function randomDate(daysBack, rng) {
  const now = new Date("2026-06-28T12:00:00Z");
  const msBack = Math.floor(rng() * daysBack * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - msBack);
}

// ─── content pools ─────────────────────────────────────────────────────────

const USER_QUESTIONS = [
  "Where exactly is the pain located?",
  "When did this pain first start?",
  "Does the pain radiate anywhere else?",
  "On a scale of 0 to 10, how would you rate your pain right now?",
  "What makes the pain worse?",
  "What activities provide relief?",
  "Is the pain constant or does it come and go?",
  "Have you had any previous episodes of this pain?",
  "Does the pain affect your sleep?",
  "Any numbness or tingling in your arms or hands?",
  "Have you noticed any weakness in your arms?",
  "Have you tried any treatments so far?",
  "Does your pain change with neck movement?",
  "Does sitting or standing affect the pain?",
  "Any headaches associated with this pain?",
  "How is this affecting your daily activities?",
  "Do you have any other medical conditions?",
  "Are you on any medication currently?",
];

const SCENARIO_RESPONSES = {
  neck_it: [
    "The pain is mainly at the base of my neck on the right side, and it travels down into my right shoulder.",
    "It started about three months ago after I got a new desk setup at work.",
    "Yes, it radiates down my right arm, sometimes all the way to my fingers.",
    "Right now I'd say it's about a 6 out of 10. It's worse in the evenings.",
    "Looking down at my screen for long periods really aggravates it. Also turning my head to the right.",
    "Heat on my neck helps a bit, and lying down with a supportive pillow.",
    "It's there most of the time but it peaks in the afternoon when I've been at my desk a while.",
    "I had a similar episode about two years ago but it resolved on its own.",
    "Yes, it wakes me up if I roll onto my right side.",
    "I do get tingling in my right ring finger and little finger occasionally.",
    "Not really weakness, but my right arm feels heavier than usual.",
    "I've been taking ibuprofen. My GP referred me here.",
    "Rotating to the right increases the pain significantly.",
    "Sitting is worse, especially when slumped. Standing relieves it slightly.",
    "I do get tension headaches starting at the base of my skull.",
    "I can't concentrate at work and I've had to take some days off.",
    "I have mild hypertension, well-controlled with medication.",
    "Amlodipine for the blood pressure and ibuprofen as needed for the pain.",
  ],
  neck_chronic: [
    "It's centered right at the back of my neck, mostly on the left side.",
    "It's been building up over the past six months. I think it's posture-related.",
    "It spreads across my upper back and sometimes into the back of my head.",
    "About a 5 out of 10 most days. Sometimes spikes to an 8.",
    "Prolonged reading and computer work make it much worse.",
    "Gentle stretching and a warm shower in the morning help.",
    "It's constant at a low level, with flare-ups two or three times a week.",
    "Yes, I've had neck pain on and off for years but never this persistent.",
    "It disrupts my sleep. I wake up stiff and sore every morning.",
    "I get occasional numbness in my left thumb and index finger.",
    "Some weakness when gripping with my left hand.",
    "I've tried physiotherapy before briefly. It helped a little.",
    "Extension and left rotation are the most painful movements.",
    "Sitting is far worse. I work from home and my setup is poor.",
    "Regular headaches, usually at the base of my skull and temples.",
    "I've had to give up playing golf which is very frustrating for me.",
    "I have type 2 diabetes, well managed with diet.",
    "Just metformin for the diabetes. No other regular medications.",
  ],
  shoulder: [
    "The pain is primarily in my right shoulder, deep inside the joint.",
    "It came on suddenly about six weeks ago when I was lifting boxes at work.",
    "It radiates up into my neck and down the outside of my upper arm.",
    "Right now it's about a 7 out of 10. It's been pretty bad today.",
    "Reaching overhead and behind my back are both very painful.",
    "Rest and ice packs help. Keeping my arm close to my body.",
    "It's constant. There's no position where I'm completely comfortable.",
    "I injured my shoulder about five years ago but it recovered fully.",
    "Terrible. I can't find a comfortable sleeping position at all.",
    "I get pins and needles down the outside of my arm sometimes.",
    "Definite weakness when trying to lift my arm above shoulder height.",
    "I've been using a sling and taking paracetamol regularly.",
    "Any movement hurts, but rotation inward is the worst.",
    "Both positions are painful. I prefer standing as I can hold my arm.",
    "No headaches specifically, but I'm getting tension in my neck.",
    "I can't do my job properly. I work in a warehouse.",
    "No significant medical history apart from mild asthma.",
    "Salbutamol inhaler as needed. Nothing else.",
  ],
};

const FEEDBACK_TEMPLATES = [
  (name, score) => `The student demonstrated ${score >= 0.75 ? "strong" : "developing"} history-taking skills during this session. They covered key areas including pain location, onset, radiation pattern, and aggravating and relieving factors. ${score >= 0.8 ? "The questioning was systematic and thorough, following a logical clinical reasoning pathway." : "The questioning would benefit from a more structured approach following standard physiotherapy assessment frameworks."} The student ${score >= 0.7 ? "appropriately probed for neurological symptoms" : "could improve by more consistently exploring neurological red flags"} such as paraesthesia and muscle weakness. Overall performance reflects ${score >= 0.85 ? "excellent" : score >= 0.65 ? "satisfactory" : "a developing"} clinical communication competency.`,

  (name, score) => `This session showed ${score >= 0.75 ? "commendable" : "emerging"} assessment technique. The student asked relevant questions about pain characteristics and functional limitations. ${score >= 0.8 ? "Particularly notable was the student's exploration of the psychosocial impact of the condition on the patient's daily activities and occupation." : "Greater attention to the biopsychosocial impact of the patient's condition on their occupation and lifestyle would strengthen the assessment."} Neurological screening was ${score >= 0.7 ? "included appropriately" : "partially addressed and should be more consistent"}. The student should ${score >= 0.8 ? "continue to apply this thorough approach" : "work on structuring history-taking questions to ensure all clinical domains are covered systematically"}.`,

  (name, score) => `The student's performance in this virtual patient session was ${score >= 0.85 ? "excellent" : score >= 0.7 ? "good" : score >= 0.55 ? "fair" : "below expectations"}. History-taking covered ${score >= 0.75 ? "most" : "some"} of the essential components of a musculoskeletal assessment. ${score >= 0.8 ? "The student demonstrated clinical reasoning by linking symptoms to functional impairment and exploring the patient's understanding of their condition." : "The student should focus on developing clinical reasoning skills that link symptom patterns to likely diagnoses and functional impairment."} Red flag screening ${score >= 0.7 ? "was appropriately conducted" : "requires more consistent application"}. Continued practice with simulated patients will ${score >= 0.75 ? "further refine" : "help build"} confidence and systematic thinking.`,

  (name, score) => `History-taking in this session was ${score >= 0.8 ? "systematic and patient-centred" : "partially structured with room for improvement"}. The student explored the location, intensity, and temporal characteristics of pain, which forms a solid foundation for musculoskeletal assessment. ${score >= 0.75 ? "The student also effectively inquired about aggravating and relieving factors, sleep disturbance, and the impact on daily function." : "Key areas such as sleep disturbance, occupational impact, and prior treatment history were underexplored."} Neurological symptom screening ${score >= 0.7 ? "was addressed" : "was minimal and should be prioritised in future sessions"}. Overall this was a ${score >= 0.8 ? "strong" : score >= 0.6 ? "reasonable" : "foundational"} attempt that reflects ${score >= 0.8 ? "solid" : "developing"} clinical communication skills.`,
];

// ─── session builder ────────────────────────────────────────────────────────

function getResponsePool(scenarioName) {
  const n = scenarioName.toLowerCase();
  if (n.includes("shoulder")) return SCENARIO_RESPONSES.shoulder;
  if (n.includes("chronic") || n.includes("arthur") || n.includes("franklin"))
    return SCENARIO_RESPONSES.neck_chronic;
  return SCENARIO_RESPONSES.neck_it;
}

function buildTranscription(scenario, rng) {
  const systemContent = `You are a virtual patient for a physiotherapy training simulation.\nScenario: ${scenario.scenarioName}.\nRespond naturally as the patient based on your case history.`;

  const responsePool = getResponsePool(scenario.scenarioName);
  const numTurns = 4 + Math.floor(rng() * 5); // 4-8 Q&A pairs

  const questionIndices = Array.from({ length: USER_QUESTIONS.length }, (_, i) => i);
  // Shuffle question indices using rng
  for (let i = questionIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [questionIndices[i], questionIndices[j]] = [questionIndices[j], questionIndices[i]];
  }

  const turns = [{ role: "system", content: systemContent }];
  for (let i = 0; i < numTurns; i++) {
    const qi = questionIndices[i % questionIndices.length];
    const userQ = USER_QUESTIONS[qi];
    const assistantR = responsePool[qi % responsePool.length];
    const movement = pick(
      ["head_nod", "head_shake", "grimace", "shoulder_shrug", "neutral", "pain_expression"],
      rng,
    );
    turns.push({ role: "user", content: `user_input : ${userQ}` });
    turns.push({
      role: "assistant",
      content: `{'speak': '${assistantR}', 'movement': '${movement}'}`,
    });
  }
  return turns;
}

function buildScore(attemptIndex, totalAttempts, rng) {
  // Base score 0.38-0.72, improves with later attempts
  const base = 0.38 + rng() * 0.34;
  const improvement = attemptIndex * (0.04 + rng() * 0.06);
  return Math.min(0.95, parseFloat((base + improvement).toFixed(2)));
}

function buildFeedback(scenarioName, score) {
  const template = FEEDBACK_TEMPLATES[Math.floor(score * FEEDBACK_TEMPLATES.length)];
  return template(scenarioName, score);
}

// ─── main ───────────────────────────────────────────────────────────────────

const SESSION_DISTRIBUTION = [
  { sessions: 0, weight: 20 }, // 20% haven't started
  { sessions: 1, weight: 35 }, // 35% done once
  { sessions: 2, weight: 30 }, // 30% done twice
  { sessions: 3, weight: 15 }, // 15% done three times
];

function pickSessionCount(rng) {
  const r = rng() * 100;
  let cumulative = 0;
  for (const { sessions, weight } of SESSION_DISTRIBUTION) {
    cumulative += weight;
    if (r < cumulative) return sessions;
  }
  return 1;
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const benjamin = await User.findOne({ name: /benjamin/i, role: "educator" });
  if (!benjamin) { console.error("Benjamin not found."); process.exit(1); }

  const students = await User.find({
    role: "student",
    supervisor: benjamin._id,
  }).select("_id email");

  const scenarios = await Scenario.find({
    educator: benjamin._id,
  }).select("_id scenarioName assignedTo");

  console.log(`Educator : Benjamin (${benjamin._id})`);
  console.log(`Students : ${students.length}`);
  console.log(`Scenarios: ${scenarios.length}\n`);

  // Build student lookup
  const studentMap = {};
  students.forEach((s) => { studentMap[s._id.toString()] = s; });

  const allDocs = [];

  for (const scenario of scenarios) {
    const assignedIds = (scenario.assignedTo || []).map((id) => id.toString());
    let sessionCount = 0;

    for (const studentId of assignedIds) {
      // Use student+scenario for deterministic seed (reproducible if re-run)
      const seedStr = studentId + scenario._id.toString();
      let seedNum = 0;
      for (let i = 0; i < seedStr.length; i++) {
        seedNum = (seedNum * 31 + seedStr.charCodeAt(i)) >>> 0;
      }
      const rng = seededRand(seedNum);

      const numSessions = pickSessionCount(rng);
      if (numSessions === 0) continue;

      // Generate session dates spread over past 90 days, sorted ascending
      const dates = Array.from({ length: numSessions }, () =>
        randomDate(90, rng)
      ).sort((a, b) => a - b);

      for (let i = 0; i < numSessions; i++) {
        const score = buildScore(i, numSessions, rng);
        const transcription = buildTranscription(scenario, rng);
        const feedback = buildFeedback(scenario.scenarioName, score);
        const createdAt = dates[i];

        allDocs.push({
          student_id: studentId,
          scenario_id: scenario._id.toString(),
          score,
          feedback,
          transcription,
          createdAt,
          updatedAt: createdAt,
        });
        sessionCount++;
      }
    }

    console.log(
      `  "${scenario.scenarioName.slice(0, 55)}" → ${sessionCount} sessions across ${assignedIds.length} students`
    );
  }

  console.log(`\nTotal sessions to insert: ${allDocs.length}`);

  if (process.argv[2] !== "--run") {
    console.log("\nDry run. Pass --run to apply.\n");
    await mongoose.disconnect();
    return;
  }

  console.log("\nInserting...");
  // Use raw collection to set explicit createdAt (bypass Mongoose auto-timestamp)
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < allDocs.length; i += BATCH) {
    const batch = allDocs.slice(i, i + BATCH);
    await Session.collection.insertMany(batch, { ordered: false });
    inserted += batch.length;
    process.stdout.write(`\r  ${inserted}/${allDocs.length} inserted`);
  }

  console.log(`\n\nDone. ${inserted} sessions created.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
