/*
 * Deep load-test data, on top of seedLoadTest.js (run that first). Same guard: writes ONLY to a
 * database whose name contains "loadtest" (MONGODB_DB, default vps_loadtest); production is never
 * touched. The breadth seed gives 5000 thin schools; this gives ONE school real depth, so the
 * pages that list a person's scenarios and attempts are tested at scale:
 *
 *   educator edu1-1@loadtest.test : --scenarios (default 5000) scenarios, all assigned to their class
 *   their class                   : --students  (default 300) more students, each with a history:
 *                                   8-25 scenarios tried, 1-4 attempts each, scores that improve,
 *                                   per-question verdicts, a transcript, reflection, Clinical Reasoning
 *   stu1-1-1@loadtest.test        : a heavy history (40 scenarios) to look at as a student
 *   ai usage                      : 30 days of AI calls for the superadmin's spend panel
 *
 *   node backend/scripts/seedLoadTestDeep.js [--scenarios 5000] [--students 300] [--reset]
 *
 * Every document written here carries seed: "deep"; --reset deletes those first (nothing else).
 */
import dns from "dns";
import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";
import { reasoningRecord } from "../utils/reasoningScore.js";

dotenv.config();
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(","));

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const DB = process.env.MONGODB_DB || "vps_loadtest";
const N_SCN = +arg("scenarios", 5000);
const N_STU = +arg("students", 300);
const RESET = process.argv.includes("--reset");
const CLUSTER_CAP_MB = +arg("cap", 420);
if (!/loadtest/i.test(DB)) { console.error(`Refusing: target database "${DB}" does not contain "loadtest".`); process.exit(1); }

const TAG = { seed: "deep" };
const oid = () => new mongoose.Types.ObjectId();
const rand = (a, b) => a + Math.random() * (b - a);
const int = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const daysAgo = (d) => new Date(Date.now() - d * 86400000);

const CONDITIONS = [
  ["Lateral ankle sprain", "netball player", "Ankle"], ["Acute low back pain", "warehouse worker", "Lumbar spine"], ["Rotator cuff tendinopathy", "swimmer", "Shoulder"],
  ["Knee osteoarthritis", "retired teacher", "Knee"], ["Frozen shoulder", "office manager", "Shoulder"], ["ACL reconstruction rehab", "footballer", "Knee"],
  ["Lumbar radiculopathy", "taxi driver", "Lumbar spine"], ["Tennis elbow", "carpenter", "Elbow"], ["Plantar fasciitis", "nurse on night shifts", "Foot"],
  ["Whiplash-associated disorder", "commuter after a car accident", "Neck"], ["Patellofemoral pain", "teenage runner", "Knee"], ["Carpal tunnel syndrome", "data-entry clerk", "Wrist"],
  ["Post-stroke hemiparesis", "retired engineer", "Neuro"], ["Hip fracture recovery", "86-year-old living alone", "Hip"], ["Achilles tendinopathy", "masters athlete", "Ankle"],
  ["Cervical radiculopathy", "graphic designer", "Neck"], ["Hamstring strain", "sprinter", "Thigh"], ["De Quervain's tenosynovitis", "new parent", "Wrist"],
  ["Parkinson's disease, falls", "retired farmer", "Neuro"], ["COPD exacerbation rehab", "former smoker", "Cardiorespiratory"],
  ["Total knee replacement", "keen gardener", "Knee"], ["Thoracic outlet syndrome", "violinist", "Shoulder"], ["Osteoporotic vertebral fracture", "72-year-old", "Thoracic spine"],
  ["Shin splints", "army recruit", "Leg"], ["Hand flexor tendon repair", "chef", "Hand"], ["Vestibular dizziness", "bus driver", "Neuro"],
];
const PATIENTS = ["Mei Ling", "Raj Kumar", "Siti Nur", "James Tan", "Aiko Sato", "Daniel Lim", "Priya Nair", "Wei Jie", "Hannah Goh", "Ahmad Faiz", "Grace Ong", "Marcus Lee", "Nurul Huda", "Kenji Mori", "Olivia Chua"];
const FIRST = ["Aisha", "Ben", "Chloe", "Dinesh", "Elena", "Farhan", "Grace", "Hiro", "Isla", "Jun", "Kavya", "Liam", "Maya", "Nadia", "Omar", "Pei Shan", "Qi", "Rania", "Sean", "Tara", "Umar", "Vera", "Wen", "Xin Yi", "Yusuf", "Zara"];
const LAST = ["Tan", "Lim", "Ng", "Wong", "Kumar", "Rahman", "Lee", "Chen", "Goh", "Singh", "Ong", "Teo", "Ismail", "Koh", "Chua", "Pillai"];
const CRITERIA = [
  ["Introduction and consent", "Did you introduce yourself and confirm the patient's name?"],
  ["Presenting concern exploration", "Did you ask where the pain is and how it started?"],
  ["Presenting concern exploration", "Did you ask what makes it better or worse?"],
  ["Red flags & safety", "Did you screen for night pain, weight loss or numbness?"],
  ["Red flags & safety", "Did you ask about bladder or bowel changes?"],
  ["Relevant history gathering", "Did you ask about previous episodes and treatment?"],
  ["Relevant history gathering", "Did you ask about medication and general health?"],
  ["Psychosocial context", "Did you ask how it affects work, sleep and daily life?"],
  ["Psychosocial context", "Did you explore worries and expectations?"],
  ["Communication", "Did you use open questions and summarise back?"],
  ["Structure", "Did the interview follow a clear order?"],
  ["Summary", "Did you close with a summary and next steps?"],
];
const TURNS = [
  ["user", "Hello, I'm your physiotherapist today. Could you confirm your name for me?"], ["assistant", "Yes, it's {p}. Nice to meet you."],
  ["user", "What brings you in today?"], ["assistant", "It's my {area}. It's been bothering me for about three weeks now."],
  ["user", "How did it start?"], ["assistant", "I think it was during {cause}. It got worse over the next few days."],
  ["user", "What makes it better or worse?"], ["assistant", "Resting helps a bit. Stairs and long walks make it worse."],
  ["user", "Does the pain wake you at night?"], ["assistant", "Sometimes, when I roll onto that side."],
  ["user", "Any numbness, tingling, or changes with your bladder or bowels?"], ["assistant", "No, nothing like that."],
  ["user", "How is it affecting your work and daily life?"], ["assistant", "I've had to cut back. I'm worried it won't get better before {event}."],
  ["user", "So, to summarise: three weeks of {area} pain, worse with activity, no red flags. Let's examine you next."], ["assistant", "That sounds right. Thank you."],
];
const REFLECT = ["I think I covered the history well but rushed the red flags.", "I forgot to ask about sleep and work until the end.", "I felt more confident this time; I summarised before closing.", "I asked too many closed questions early on.", "I should have explored the patient's worries more."];

function transcript(p, area) {
  const n = int(8, TURNS.length);
  return TURNS.slice(0, n).map(([role, text]) => ({ role, content: text.replace("{p}", p).replace("{area}", area.toLowerCase()).replace("{cause}", pick(["a training session", "lifting boxes at work", "a long weekend of gardening"])).replace("{event}", pick(["my competition", "my holiday", "going back to work"])) }));
}
function verdicts(pct) {
  const p = pct / 100;
  return CRITERIA.map(([criterion, question], i) => {
    const r = Math.random();
    const observed = r < p ? "yes" : r < p + 0.15 ? "partly" : "no";
    return { number: i + 1, question, criterion, observed, evidence: observed === "no" ? "Not asked in the conversation." : "Asked during the interview." };
  });
}
function crRecord(skill) {
  const lvl = () => clamp(Math.round(rand(skill * 4 - 1, skill * 4 + 0.6)), 1, 4);
  const ind = () => pick(skill > 0.7 ? ["independent", "independent", "prompted"] : skill > 0.5 ? ["prompted", "independent", "step_by_step"] : ["step_by_step", "prompted", "not_reached"]);
  const fb = {
    criteria: [1, 2, 3, 4, 5].map((n) => ({ criterion: n, quality_rating: lvl(), independence: ind() })),
    summary: skill > 0.65 ? "You built a clear picture and prioritised sensibly." : "You gathered useful cues but needed prompting to link them to a working diagnosis.",
    went_well: ["Picked up the key cue early", "Considered more than one diagnosis"].slice(0, int(1, 2)),
    work_on: ["Justify why the leading diagnosis fits best", "Screen red flags before moving on"].slice(0, int(1, 2)),
    focus_next_time: pick(["Say out loud why you rank one hypothesis above another.", "Check red flags before the examination plan."]),
    missed_red_flag: Math.random() < 0.08,
  };
  return { ...reasoningRecord(fb, "completed"), completed_at: new Date(), source: "seed" };
}

async function main() {
  const conn = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
  if (conn.db.databaseName === DB) throw new Error("Target equals the URI database; refusing.");
  const db = conn.useDb(DB, { useCache: false }).db;
  const C = (n) => db.collection(n);
  const t0 = Date.now();

  if (RESET) {
    for (const n of ["scenarios", "users", "students", "sessions", "aiusages"]) console.log("reset", n, (await C(n).deleteMany(TAG)).deletedCount);
  }

  const edu = await C("users").findOne({ email: "edu1-1@loadtest.test" });
  if (!edu) throw new Error("Run seedLoadTest.js first (edu1-1@loadtest.test not found).");
  const group = await C("groups").findOne({ educatorId: edu._id });
  const schoolId = edu.schoolId;
  console.log(`Deepening ${DB}: educator ${edu.email}, class ${group?.name}`);

  // 1. Scenarios, all assigned to the class (some drafts and archived, as in real use).
  const scenarios = [];
  for (let k = 0; k < N_SCN; k++) {
    const [cond, who, area] = CONDITIONS[k % CONDITIONS.length];
    const patient = PATIENTS[k % PATIENTS.length];
    const status = k % 23 === 0 ? "Draft" : k % 37 === 0 ? "Archived" : "Published";
    scenarios.push({
      _id: oid(), ...TAG, scenarioName: `${cond} in a ${who}${k >= CONDITIONS.length ? ` (case ${Math.floor(k / CONDITIONS.length) + 1})` : ""}`,
      patientName: patient, description: `${patient}, a ${who}, presents with ${cond.toLowerCase()}. ${area} focus.`, bodyArea: area,
      educator: edu._id, schoolId, status, permissions: "Read Only", assignedTo: [], assignedGroups: group ? [group._id] : [],
      profession: "physiotherapy", difficulty: pick(["Easy", "Medium", "Medium", "Hard"]), testable: true,
      createdAt: daysAgo(rand(5, 200)), updatedAt: daysAgo(rand(0, 5)),
    });
  }
  for (let i = 0; i < scenarios.length; i += 2000) await C("scenarios").insertMany(scenarios.slice(i, i + 2000), { ordered: false });
  const live = scenarios.filter((x) => x.status === "Published");
  console.log(`scenarios +${scenarios.length} (${live.length} published)`);

  // 2. More students in the class (same password as the other test accounts).
  const users = [], profiles = [];
  for (let i = 0; i < N_STU; i++) {
    const id = oid(), name = `${pick(FIRST)} ${pick(LAST)}`;
    users.push({ _id: id, ...TAG, name, email: `deep${i + 1}@loadtest.test`, password: edu.password, role: "student", schoolId, supervisor: edu._id, groupId: group?._id, lastLoginAt: daysAgo(rand(0, 40)), createdAt: daysAgo(150), updatedAt: new Date() });
    profiles.push({ _id: oid(), ...TAG, user: id, educatorId: edu._id, grade: pick(["Year 1", "Year 2", "Year 3"]), enrollmentDate: daysAgo(150), createdAt: daysAgo(150), updatedAt: new Date() });
  }
  if (users.length) { await C("users").insertMany(users, { ordered: false }); await C("students").insertMany(profiles, { ordered: false }); }
  console.log(`students +${users.length}`);

  // 3. Histories: every student in the class, the original two included.
  const classmates = await C("users").find({ role: "student", groupId: group?._id }).project({ _id: 1, email: 1 }).toArray();
  let total = 0;
  for (let b = 0; b < classmates.length; b += 25) {
    const sessions = [];
    for (const st of classmates.slice(b, b + 25)) {
      const heavy = st.email === "stu1-1-1@loadtest.test";
      const ability = rand(0.35, 0.8);
      const tried = heavy ? 40 : int(8, 25);
      const chosen = new Set();
      while (chosen.size < Math.min(tried, live.length)) chosen.add(pick(live));
      let day = rand(90, 140);
      for (const sc of chosen) {
        const attempts = heavy ? int(2, 4) : int(1, 4);
        let skill = ability + rand(-0.1, 0.05);
        for (let a = 0; a < attempts; a++) {
          day = Math.max(0.2, day - rand(0.3, 4));
          const pct = clamp(Math.round(skill * 100 + rand(-8, 8)), 12, 98);
          const at = daysAgo(day);
          const unfinished = Math.random() < 0.03;
          sessions.push({
            _id: oid(), ...TAG, session_id: crypto.randomUUID(), student_id: String(st._id), scenario_id: String(sc._id),
            score: unfinished ? 0 : pct / 100,
            feedback: unfinished ? "" : `You scored ${pct}/100. ${pct >= 75 ? "A thorough, well-structured history." : pct >= 50 ? "Solid start; red flags and psychosocial questions need more attention." : "Several key areas were missed; slow down and follow a structure."}`,
            transcription: unfinished ? [] : transcript(sc.patientName, sc.bodyArea),
            question_results: unfinished ? [] : verdicts(pct),
            reflection: unfinished ? undefined : { self_rating: clamp(Math.round(pct / 10 + rand(-2, 2)), 1, 10), summary: pick(REFLECT), status: "completed", completed_at: at, distress_flag: Math.random() < 0.01 },
            clinical_reasoning: unfinished || Math.random() < 0.3 ? undefined : crRecord(skill),
            ...(Math.random() < 0.02 && { student_flag: { reason: pick(["misheard", "feedback", "technical"]), at } }),
            createdAt: at, updatedAt: at,
          });
          skill = clamp(skill + rand(0.03, 0.12), 0, 0.97); // practice helps
        }
      }
    }
    await C("sessions").insertMany(sessions, { ordered: false });
    total += sessions.length;
    const mb = (await conn.db.admin().listDatabases()).totalSize / 1e6;
    console.log(`sessions ${total} (students ${Math.min(classmates.length, b + 25)}/${classmates.length}) · cluster ${mb.toFixed(0)} MB`);
    if (mb > CLUSTER_CAP_MB) { console.error(`Cluster over ${CLUSTER_CAP_MB} MB: stopping here.`); break; }
  }

  // 4. AI spend, last 30 days.
  const calls = [];
  for (let d = 0; d < 30; d++) {
    for (let i = 0; i < int(15, 60); i++) {
      const kind = pick(["scenario_ai", "scenario_ai", "sim", "sim", "sim", "other"]);
      const pt = int(800, 6000), ct = int(200, 2500);
      calls.push({ _id: oid(), ...TAG, provider: "openrouter", model: pick(["anthropic/claude-sonnet", "openai/gpt-4o-mini"]), kind, promptTokens: pt, completionTokens: ct,
        costUsd: Math.round((pt * 3e-6 + ct * 15e-6) * 10000) / 10000, createdAt: daysAgo(d + rand(0, 1)) });
    }
  }
  await C("aiusages").insertMany(calls, { ordered: false });
  console.log(`ai usage +${calls.length}`);
  console.log(`Done in ${Math.round((Date.now() - t0) / 1000)}s. New students sign in as deep1..deep${N_STU}@loadtest.test (same password).`);
  await conn.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
