/*
 * Times the list and dashboard endpoints against a backend running on the load-test database.
 *   PORT=5002 MONGODB_DB=vps_loadtest node backend/index.js     (in another shell)
 *   LOADTEST_PASSWORD=... node backend/scripts/benchLoadTest.js [baseUrl]
 * Prints, per role and endpoint: status, time, response size, and how many rows came back.
 */
const BASE = process.argv[2] || "http://localhost:5002";
const PW = process.env.LOADTEST_PASSWORD;
const TIMEOUT = +(process.env.BENCH_TIMEOUT || 30000);

const ROLES = {
  superadmin: "superadmin@loadtest.test",
  school_admin: "admin1@loadtest.test",
  educator: "edu1-1@loadtest.test",
  student: "stu1-1-1@loadtest.test",
};

const EP = {
  common: ["/api/scenarios", "/api/scenarios?page=1&limit=10", "/api/groups", "/api/rubrics"],
  superadmin: ["/api/schools", "/api/schools?page=1&limit=10", "/api/users", "/api/users?role=educator", "/api/users?page=1&limit=10", "/api/students", "/api/students?page=1&limit=10",
    "/api/dashboard/stats", "/api/dashboard/platform-overview", "/api/dashboard/schools-detailed", "/api/dashboard/educators-overview", "/api/dashboard/monthly-activity",
    "/api/dashboard/learning-overview", "/api/dashboard/sessions-feed", "/api/dashboard/scenario-popularity", "/api/students/readiness", "/api/dashboard/calibration", "/api/dashboard/score-spread",
    "/api/dashboard/question-misses", "/api/dashboard/student-flags", "/api/dashboard/distress", "/api/dashboard/teaching-effectiveness"],
  school_admin: ["/api/users?role=educator", "/api/students", "/api/students?page=1&limit=10", "/api/dashboard/school-admin-stats", "/api/dashboard/educators-overview",
    "/api/dashboard/learning-overview", "/api/students/readiness", "/api/dashboard/sessions-feed"],
  educator: ["/api/students", "/api/students?page=1&limit=10", "/api/dashboard/educator-stats", "/api/dashboard/learning-overview", "/api/students/readiness",
    "/api/dashboard/sessions-feed", "/api/dashboard/question-misses", "/api/dashboard/calibration"],
  student: ["/api/dashboard/student-stats", "/api/sessions/mine", "/api/sessions/mine/focus", "/api/sessions/mine/readiness"],
};

const rows = (j) => Array.isArray(j) ? j.length : j && typeof j === "object"
  ? (Array.isArray(j.items) ? `${j.items.length}/${j.total}` : Object.entries(j).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k}:${v.length}`).join(" ") || "-") : "-";

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PW }) });
  const j = await r.json();
  if (!j.token) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(j).slice(0, 120)}`);
  return j.token;
}

for (const [role, email] of Object.entries(ROLES)) {
  const token = await login(email);
  console.log(`\n## ${role}`);
  const paths = [...(role === "student" ? ["/api/scenarios"] : EP.common), ...EP[role]];
  // Full-list calls last: one that blocks the server would otherwise hide every timing after it.
  const isFull = (p) => !p.includes("page=") && /^\/api\/(students|users|scenarios|groups|schools)(\?role=\w+)?$/.test(p);
  for (const path of [...paths.filter((p) => !isFull(p)), ...paths.filter(isFull)]) {
    const t = Date.now();
    try {
      const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT) });
      const txt = await r.text();
      let j; try { j = JSON.parse(txt); } catch { j = null; }
      const ms = Date.now() - t;
      console.log(`${String(r.status).padEnd(4)} ${String(ms).padStart(6)} ms ${(txt.length / 1024).toFixed(0).padStart(7)} KB  ${String(rows(j)).padEnd(28)} ${path}${ms > 2000 ? "  <-- SLOW" : ""}`);
    } catch (e) {
      console.log(`ERR  ${String(Date.now() - t).padStart(6)} ms ${"".padStart(10)}  ${e.name}: ${e.message.slice(0, 60)}  ${path}`);
    }
  }
}
