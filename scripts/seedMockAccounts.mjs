/**
 * Seeds three demo logins — a school admin, an educator and a student — inside
 * one mock school, with enough surrounding data (a 30-student roster, groups,
 * scenarios, scored sessions with transcripts and feedback) that every list
 * page has more than one page to paginate through.
 *
 * Run with:   node scripts/seedMockAccounts.mjs           (wipe + reseed)
 *             node scripts/seedMockAccounts.mjs --clean   (wipe only)
 *
 * Everything it writes hangs off MOCK_SCHOOL_NAME or a MOCK_DOMAIN email, and
 * every run deletes exactly that first, so re-running never duplicates and never
 * touches real records.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const { default: connectDB } = await import("../backend/db.js");
const User = (await import("../backend/models/userModel.js")).default;
const School = (await import("../backend/models/schoolModel.js")).default;
const Student = (await import("../backend/models/studentModel.js")).default;
const Group = (await import("../backend/models/groupModel.js")).default;
const Scenario = (await import("../backend/models/scenarioModel.js")).default;
const Session = (await import("../backend/models/sessionModel.js")).default;

const MOCK_DOMAIN = "mock.proroleplay.test";
const MOCK_SCHOOL_NAME = "Mock Physiotherapy Academy";
const PASSWORD = "Demo@1234";

const ACCOUNTS = {
  admin: { name: "Priya Raman", email: `admin@${MOCK_DOMAIN}`, role: "school_admin" },
  educator: { name: "Dr. Marcus Lee", email: `educator@${MOCK_DOMAIN}`, role: "educator" },
  student: { name: "Aiko Tanaka", email: `student@${MOCK_DOMAIN}`, role: "student" },
};

// Deterministic PRNG so every reseed produces the same data.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

const FIRST = ["Wei", "Hana", "Arjun", "Sofia", "Kenji", "Mei", "Lucas", "Nur", "Daniel", "Yuki",
  "Ravi", "Chloe", "Haruto", "Aisha", "Ethan", "Lin", "Omar", "Sara", "Jun", "Isabel",
  "Tomas", "Mira", "Kai", "Leila", "Ben", "Rina", "Ahmad", "Grace", "Ivan"];
const LAST = ["Chen", "Sato", "Kumar", "Rossi", "Wong", "Ito", "Silva", "Hassan", "Park", "Lim",
  "Nair", "Martin", "Yamada", "Rahman", "Tan", "Novak", "Kim", "Ong", "Garcia", "Abe"];

const SCENARIOS = [
  ["Frozen shoulder in a 52-year-old teacher", "Adhesive capsulitis, 4 months of progressive loss of shoulder ROM.", "Medium", "Female", "Linda Moore"],
  ["Rotator cuff tendinopathy in a swimmer", "Painful arc and night pain in a 24-year-old competitive swimmer.", "Easy", "Male", "Jake Turner"],
  ["Acute low back pain after lifting", "Warehouse worker with non-specific LBP, no red flags.", "Easy", "Male", "Carlos Mendes"],
  ["Lumbar radiculopathy with leg pain", "L5 radicular symptoms, positive SLR, 6 weeks duration.", "Hard", "Female", "Grace Holt"],
  ["ACL reconstruction, 3 months post-op", "Return-to-sport assessment for a 19-year-old footballer.", "Medium", "Male", "Ryo Nakamura"],
  ["Knee osteoarthritis in a retired farmer", "Bilateral knee OA, morning stiffness, reduced walking tolerance.", "Easy", "Male", "Harold Brooks"],
  ["Lateral ankle sprain in a netball player", "Grade II inversion sprain, 5 days post injury.", "Easy", "Female", "Mei Ling"],
  ["Greater trochanteric pain syndrome", "Lateral hip pain worse lying on side, 48-year-old runner.", "Medium", "Female", "Sandra Kaur"],
  ["Chronic neck pain in an office worker", "Postural neck pain with intermittent headaches.", "Medium", "Female", "Yuna Kim"],
  ["Plantar fasciitis in a nurse", "First-step heel pain after long shifts.", "Easy", "Female", "Amelia Price"],
  ["Hip osteoarthritis pre-replacement", "Severe groin pain, waiting list for THR, education focus.", "Hard", "Male", "George Wallace"],
  ["Tennis elbow in a carpenter", "Lateral epicondylalgia aggravated by gripping tools.", "Medium", "Male", "Tom Fischer"],
];

const STRENGTHS = [
  "Opened with a clear introduction and confirmed the patient's identity.",
  "Used open questions well to explore the history of the presenting complaint.",
  "Screened for red flags systematically.",
  "Summarised the patient's story back accurately before moving on.",
  "Showed empathy when the patient described the impact on work.",
];
const IMPROVE = [
  "Ask about aggravating and easing factors in more detail.",
  "Explore the patient's goals and expectations earlier.",
  "Avoid leading questions when asking about symptom behaviour.",
  "Cover past medical history and medications before the physical assessment.",
  "Check the 24-hour pattern of symptoms.",
];

const transcriptFor = (patient) => [
  { role: "assistant", speaker: patient, content: "Hi, I'm here about the pain I've been having." },
  { role: "user", speaker: "", content: "Hello, I'm your physiotherapist today. Can you tell me what brought you in?" },
  { role: "assistant", speaker: patient, content: "It started a few weeks ago and it's been getting worse, especially in the mornings." },
  { role: "user", speaker: "", content: "Where exactly do you feel it, and does it spread anywhere?" },
  { role: "assistant", speaker: patient, content: "Mostly right here. Sometimes it goes a little further down when I've been active." },
  { role: "user", speaker: "", content: "On a scale of 0 to 10, how bad is it at its worst?" },
  { role: "assistant", speaker: patient, content: "About a seven. On a good day maybe a three." },
  { role: "user", speaker: "", content: "What makes it better or worse?" },
  { role: "assistant", speaker: patient, content: "Rest helps. Lifting things or staying in one position for too long makes it worse." },
  { role: "user", speaker: "", content: "Any numbness, tingling, weight loss or trouble sleeping?" },
  { role: "assistant", speaker: patient, content: "No numbness. Sleep is a bit disturbed when I roll onto it." },
];

const feedbackFor = (score) => {
  const s = [pick(STRENGTHS), pick(STRENGTHS)];
  const i = [pick(IMPROVE), pick(IMPROVE)];
  return [
    `Overall score: ${Math.round(score * 10)}/10 (AI-generated feedback)`,
    "",
    "Strengths:",
    ...[...new Set(s)].map((x) => `- ${x}`),
    "",
    "Areas to improve:",
    ...[...new Set(i)].map((x) => `- ${x}`),
  ].join("\n");
};

const clean = async () => {
  const school = await School.findOne({ schoolName: MOCK_SCHOOL_NAME });
  const users = await User.find({ email: new RegExp(`@${MOCK_DOMAIN.replace(/\./g, "\\.")}$`) })
    .select("_id")
    .lean();
  const userIds = users.map((u) => u._id);

  const [sessions, scenarios, groups, students, deletedUsers] = await Promise.all([
    Session.deleteMany({ student_id: { $in: userIds.map(String) } }),
    school ? Scenario.deleteMany({ schoolId: school._id }) : { deletedCount: 0 },
    school ? Group.deleteMany({ schoolId: school._id }) : { deletedCount: 0 },
    Student.deleteMany({ user: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
  if (school) await School.deleteOne({ _id: school._id });

  console.log(
    `Cleaned: ${deletedUsers.deletedCount} users, ${students.deletedCount} student profiles, ` +
      `${groups.deletedCount} groups, ${scenarios.deletedCount} scenarios, ` +
      `${sessions.deletedCount} sessions, ${school ? 1 : 0} school`,
  );
};

const seedData = async () => {
  const school = await School.create({
    schoolName: MOCK_SCHOOL_NAME,
    description: "Demo institution with mock data for testing dashboards and pagination.",
    email: `school@${MOCK_DOMAIN}`,
    startDate: daysAgo(120),
    expireDate: new Date(Date.now() + 245 * 86400000),
    status: "Active",
    permissions: "Both",
    inviteStatus: "invited",
  });

  // User.create (not insertMany) so the pre-save hook hashes the password.
  const admin = await User.create({
    ...ACCOUNTS.admin,
    password: PASSWORD,
    schoolId: school._id,
    lastLoginAt: daysAgo(1),
    credentialsSentAt: daysAgo(100),
  });
  school.assignedAdmin = { id: admin._id, name: admin.name, email: admin.email };
  await school.save();

  const educator = await User.create({
    ...ACCOUNTS.educator,
    password: PASSWORD,
    schoolId: school._id,
    supervisor: admin._id,
    department: "Science",
    lastLoginAt: daysAgo(0),
    credentialsSentAt: daysAgo(95),
  });

  const groups = await Group.insertMany(
    ["MSK Cohort 2026 A", "MSK Cohort 2026 B", "Sports Rehab Elective"].map((name) => ({
      name,
      educatorId: educator._id,
      schoolId: school._id,
    })),
  );

  // The demo student first, then a roster around them. Invite status varies so
  // the Login column has all three states.
  const rosterSpecs = [{ ...ACCOUNTS.student, groupId: groups[0]._id, login: "active" }];
  for (let i = 0; i < 29; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    rosterSpecs.push({
      name: `${first} ${last}`,
      email: `${first}.${last}.${i}@${MOCK_DOMAIN}`.toLowerCase(),
      role: "student",
      groupId: i % 4 === 3 ? null : groups[i % 3]._id,
      login: i % 5 === 0 ? "pending" : i % 5 === 1 ? "invited" : "active",
    });
  }

  const students = [];
  for (const spec of rosterSpecs) {
    const { login, ...fields } = spec;
    students.push(
      await User.create({
        ...fields,
        password: PASSWORD,
        schoolId: school._id,
        supervisor: educator._id,
        credentialsSentAt: login === "pending" ? null : daysAgo(90),
        lastLoginAt: login === "active" ? daysAgo(Math.floor(between(0, 20))) : null,
      }),
    );
  }
  await Student.insertMany(
    students.map((u, i) => ({
      user: u._id,
      educatorId: educator._id,
      grade: `Year ${(i % 3) + 2}`,
      school: school.schoolName,
      enrollmentDate: daysAgo(110),
    })),
  );

  const demoStudent = students[0];
  const scenarios = [];
  for (const [idx, [scenarioName, description, difficulty, gender, patientName]] of SCENARIOS.entries()) {
    const status = idx < 9 ? "Published" : idx < 11 ? "Draft" : "Archived";
    // Published ones go to a group plus a few individual students; the demo
    // student gets six directly so their dashboard is full.
    const assignedGroups = status === "Published" ? [groups[idx % 3]._id] : [];
    const assignedTo =
      status === "Published"
        ? [
            ...(idx < 6 ? [demoStudent._id] : []),
            ...students.slice(1).filter(() => rand() < 0.2).map((s) => s._id),
          ]
        : [];
    scenarios.push(
      await Scenario.create({
        scenarioName,
        description,
        educator: educator._id,
        schoolId: school._id,
        status,
        permissions: "Both",
        difficulty,
        patientName,
        patientGender: gender,
        language: "English",
        assignedTo,
        assignedGroups,
        scenarioPrompt:
          `Physiotherapy Case: ${scenarioName}\n\n${description}\n\n` +
          `You are ${patientName}, the patient in this case. Answer the student's questions in character, ` +
          `briefly and naturally, revealing only what you are asked about.`,
        aiQuestions: [
          "Did the student ask about onset and duration?",
          "Did the student ask about aggravating and easing factors?",
          "Did the student screen for red flags?",
          "Did the student ask how the problem affects daily life and work?",
        ].join("\n"),
        // Simulator key: makes the mock case runnable (backend/utils/simEngine.js).
        apiKey: `sim_mock_${idx}`,
        createdAt: daysAgo(100 - idx * 6),
      }),
    );
  }

  // Sessions: the demo student practises each assigned case 2-4 times with a
  // rising score; about two thirds of the roster has some activity.
  const sessions = [];
  const addSessions = (student, scenario, count, base) => {
    for (let n = 0; n < count; n++) {
      const score = Math.min(0.98, Math.max(0.2, base + n * 0.08 + between(-0.05, 0.05)));
      const when = daysAgo(Math.floor(between(1, 80)));
      sessions.push({
        transcription: transcriptFor(scenario.patientName),
        feedback: feedbackFor(score),
        score: Number(score.toFixed(2)),
        student_id: student._id.toString(),
        scenario_id: scenario._id.toString(),
        createdAt: when,
        updatedAt: when,
      });
    }
  };
  scenarios.slice(0, 6).forEach((sc) => addSessions(demoStudent, sc, 2 + Math.floor(rand() * 3), between(0.45, 0.65)));
  students.slice(1).forEach((st) => {
    if (rand() < 0.33) return;
    const published = scenarios.filter((s) => s.status === "Published");
    for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) {
      addSessions(st, pick(published), 1 + Math.floor(rand() * 2), between(0.35, 0.8));
    }
  });
  await Session.insertMany(sessions, { timestamps: false });

  console.log(
    `Seeded: 1 school, ${students.length + 2} users, ${groups.length} groups, ` +
      `${scenarios.length} scenarios, ${sessions.length} sessions`,
  );
};

await connectDB();
try {
  await clean();
  if (!process.argv.includes("--clean")) {
    await seedData();
    console.log("\nLogins (password for all: " + PASSWORD + "):");
    Object.values(ACCOUNTS).forEach((a) => console.log(`  ${a.role.padEnd(13)} ${a.email}`));
  }
} finally {
  await mongoose.disconnect();
}
