/*
 * Load-test seed. Writes ONLY to a database whose name contains "loadtest" (default vps_loadtest)
 * on the cluster in MONGODB_URI. It refuses to run against any other database, and it never writes
 * to the production database: from production it only *reads* the index list, so the test database
 * has the same indexes as the real one.
 *
 *   node backend/scripts/seedLoadTest.js [--schools 5000] [--educators 5] [--students 10] [--scenarios 2] [--drop]
 *
 * Shape per school: 1 school admin, N educators; per educator: 1 group, M scenarios, K students
 * (each with a Student profile and one scored session). A superadmin is created too; its login is
 * written to LOADTEST_CREDENTIALS (a file path) or printed to that file only, never to stdout.
 */
import dns from "dns";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";

dotenv.config();
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(","));

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const DB = process.env.MONGODB_DB || "vps_loadtest";
const N_SCHOOLS = +arg("schools", 5000);
const N_EDU = +arg("educators", 5);
const N_STU = +arg("students", 2);
const N_SCN = +arg("scenarios", 2);
const DROP = process.argv.includes("--drop");
// Stop before the whole cluster grows past this (MB). A free Atlas tier blocks ALL writes,
// production included, once it reaches 512 MB, so stay well under it.
const CLUSTER_CAP_MB = +arg("cap", 380);
const CRED_FILE = process.env.LOADTEST_CREDENTIALS || "loadtest-credentials.txt";

if (!/loadtest/i.test(DB)) {
  console.error(`Refusing: target database "${DB}" does not contain "loadtest".`);
  process.exit(1);
}

const CRITERIA = ["Relevant history gathering", "Presenting concern exploration", "Red flags & safety", "Psychosocial context", "Follow-up & probing", "Communication", "Structure", "Summary"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const daysAgo = (d) => new Date(Date.now() - d * 86400000);
const oid = () => new mongoose.Types.ObjectId();

async function insertChunked(col, docs, size = 5000) {
  for (let i = 0; i < docs.length; i += size) await col.insertMany(docs.slice(i, i + size), { ordered: false });
}

async function main() {
  const conn = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
  const prodDb = conn.db; // database named in MONGODB_URI: read-only use below
  if (prodDb.databaseName === DB) throw new Error("Target equals the URI database; refusing.");
  const db = conn.useDb(DB, { useCache: false }).db;
  console.log(`Seeding ${DB} (production db "${prodDb.databaseName}" is only read for index definitions)`);

  if (DROP) { await db.dropDatabase(); console.log("dropped", DB); }

  const pwPlain = crypto.randomBytes(9).toString("base64url");
  const pw = await bcrypt.hash(pwPlain, 10);
  const now = new Date();

  const C = (n) => db.collection(n);
  const superId = oid();
  await C("users").insertOne({ _id: superId, name: "Load Test Superadmin", email: "superadmin@loadtest.test", password: pw, role: "superadmin", createdAt: now, updatedAt: now });
  let firstEdu = null, firstAdmin = null;

  const t0 = Date.now();
  const BATCH = 250; // schools per round, keeps memory flat
  for (let s0 = 0; s0 < N_SCHOOLS; s0 += BATCH) {
    const schools = [], users = [], profiles = [], groups = [], scenarios = [], sessions = [];
    for (let s = s0; s < Math.min(N_SCHOOLS, s0 + BATCH); s++) {
      const schoolId = oid(), adminId = oid();
      schools.push({ _id: schoolId, schoolName: `Loadtest School ${s + 1}`, email: `school${s + 1}@loadtest.test`, description: "Seeded for load testing",
        subscription: "Subscription (1 Year)", subscriptionType: pick(["Premium", "Basic", "Free"]), startDate: daysAgo(200), expireDate: daysAgo(-165 + (s % 300)),
        status: pick(["Active", "Active", "Active", "Pending", "Expired"]), defaultProfession: pick(["physiotherapy", "occupational_therapy"]), permissions: "Both",
        assignedAdmin: { id: adminId, name: `Admin ${s + 1}`, email: `admin${s + 1}@loadtest.test` }, inviteStatus: "invited", createdAt: daysAgo(200), updatedAt: now });
      users.push({ _id: adminId, name: `Admin ${s + 1}`, email: `admin${s + 1}@loadtest.test`, password: pw, role: "school_admin", schoolId, createdAt: daysAgo(200), updatedAt: now });
      if (!firstAdmin) firstAdmin = `admin${s + 1}@loadtest.test`;

      for (let e = 0; e < N_EDU; e++) {
        const eduId = oid(), groupId = oid(), tag = `${s + 1}-${e + 1}`;
        users.push({ _id: eduId, name: `Educator ${tag}`, email: `edu${tag}@loadtest.test`, password: pw, role: "educator", schoolId, department: "Physiotherapy", createdAt: daysAgo(180), updatedAt: now });
        if (!firstEdu) firstEdu = `edu${tag}@loadtest.test`;
        groups.push({ _id: groupId, name: `Cohort ${tag}`, educatorId: eduId, schoolId, joinCode: crypto.randomBytes(5).toString("hex").toUpperCase(), createdAt: daysAgo(170), updatedAt: now });
        const scnIds = [];
        for (let k = 0; k < N_SCN; k++) {
          const id = oid(); scnIds.push(id);
          scenarios.push({ _id: id, scenarioName: `${pick(["Shoulder pain", "Low back pain", "Knee injury", "Stroke rehab", "Hand therapy"])} ${tag}-${k + 1}`, description: "Seeded case",
            educator: eduId, schoolId, status: "Published", permissions: "Read Only", assignedTo: [], assignedGroups: [groupId], profession: "physiotherapy", difficulty: "Medium", createdAt: daysAgo(160), updatedAt: now });
        }
        for (let st = 0; st < N_STU; st++) {
          const stuId = oid(), stag = `${tag}-${st + 1}`;
          const last = Math.floor(Math.random() * 60);
          users.push({ _id: stuId, name: `Student ${stag}`, email: `stu${stag}@loadtest.test`, password: pw, role: "student", schoolId, supervisor: eduId, groupId, lastLoginAt: daysAgo(last), createdAt: daysAgo(150), updatedAt: now });
          profiles.push({ _id: oid(), user: stuId, educatorId: eduId, grade: "Year 2", enrollmentDate: daysAgo(150), createdAt: daysAgo(150), updatedAt: now });
          if (Math.random() < 0.85) {
            const score = Math.round(30 + Math.random() * 65);
            sessions.push({ _id: oid(), session_id: crypto.randomUUID(), feedback: "Seeded feedback.", score, student_id: String(stuId), scenario_id: String(pick(scnIds)),
              transcription: [{ role: "user", content: "How did the pain start?" }, { role: "assistant", content: "About three weeks ago, lifting boxes." }],
              question_results: CRITERIA.map((c, i) => ({ number: i + 1, question: `Asked about ${c.toLowerCase()}?`, criterion: c, observed: pick(["yes", "yes", "partly", "no"]), evidence: "Seeded." })),
              reflection: { self_rating: 1 + Math.floor(Math.random() * 10), summary: "Felt okay; would ask about red flags earlier.", status: "completed", completed_at: daysAgo(last) },
              createdAt: daysAgo(last), updatedAt: daysAgo(last) });
          }
        }
      }
    }
    await insertChunked(C("schools"), schools);
    await insertChunked(C("users"), users);
    await insertChunked(C("students"), profiles);
    await insertChunked(C("groups"), groups);
    await insertChunked(C("scenarios"), scenarios);
    await insertChunked(C("sessions"), sessions, 2000);
    const done = Math.min(N_SCHOOLS, s0 + BATCH);
    const totalMb = (await prodDb.admin().listDatabases()).totalSize / 1e6;
    if (totalMb > CLUSTER_CAP_MB) { console.error(`Cluster at ${totalMb.toFixed(0)} MB > cap ${CLUSTER_CAP_MB} MB: stopping after ${done} schools.`); break; }
    console.log(`${done}/${N_SCHOOLS} schools · users so far ~${done * (1 + N_EDU * (1 + N_STU))} · ${Math.round((Date.now() - t0) / 1000)}s`);
  }

  // Same indexes as production (read from it, created on the test db). Nothing more, nothing less.
  for (const name of ["users", "schools", "students", "groups", "scenarios", "sessions"]) {
    const idx = (await prodDb.collection(name).indexes().catch(() => [])).filter((i) => i.name !== "_id_");
    for (const i of idx) {
      const { key, name: iname, v, ns, background, ...opts } = i;
      await db.collection(name).createIndex(key, { name: iname, ...opts }).catch((e) => console.warn(`index ${name}.${iname}:`, e.message));
    }
    console.log(`indexes ${name}: ${idx.map((i) => i.name).join(", ") || "(none besides _id)"}`);
  }

  fs.writeFileSync(CRED_FILE, `Load-test logins (database ${DB}), all with the same password:\n  password: ${pwPlain}\n  superadmin: superadmin@loadtest.test\n  school_admin: ${firstAdmin}\n  educator: ${firstEdu}\n`);
  for (const n of ["schools", "users", "students", "groups", "scenarios", "sessions"]) console.log(n, await C(n).estimatedDocumentCount());
  console.log(`Done in ${Math.round((Date.now() - t0) / 1000)}s. Logins written to ${CRED_FILE}`);
  await conn.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
