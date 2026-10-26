#!/usr/bin/env node
/**
 * Load test for the VPS API. No extra packages: Node 22's fetch only.
 *
 * Simulates N users who log in once, then keep clicking around the screens
 * their role actually uses (paged lists, dashboards, session history) with a
 * pause between clicks. Users join gradually (ramp-up), hold for the test
 * duration, and the script prints response times and error rates per screen.
 *
 * It only sends GET requests after login: it never creates data and never
 * starts a voice/AI session (those cost money per call; see PENDING.md).
 *
 * Usage (from the repo root):
 *   node scripts/loadTest.mjs --target https://staging-api.example.com --users 100
 *
 * Options (all optional):
 *   --target   API base URL                         default http://localhost:5001
 *   --users    concurrent simulated users           default 20
 *   --duration seconds to hold full load            default 60
 *   --ramp     seconds to bring all users in        default 20
 *   --think    pause between clicks, ms (min-max)   default 1000-3000
 *   --accounts JSON file: [{"email","password"}]    default the three mock accounts
 *   --p95      fail if any screen's p95 is above this, ms   default 2000
 *   --errors   fail if error rate is above this, %         default 1
 *   --out      write the full results to this JSON file
 *   --allow-production   needed to run against a production URL
 *
 * Exit code is 1 when a threshold fails, so it can gate a CI job.
 */
import { readFileSync, writeFileSync } from "node:fs";

// ---- options ---------------------------------------------------------------

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const TARGET = String(opt("target", "http://localhost:5001")).replace(/\/$/, "");
const USERS = Number(opt("users", 20));
const DURATION_S = Number(opt("duration", 60));
const RAMP_S = Number(opt("ramp", 20));
const [THINK_MIN, THINK_MAX] = String(opt("think", "1000-3000")).split("-").map(Number);
const P95_LIMIT = Number(opt("p95", 2000));
const ERROR_LIMIT = Number(opt("errors", 1));
const OUT = opt("out", null);
const ALLOW_PROD = opt("allow-production", false) === true;
const REQUEST_TIMEOUT_MS = 30_000;

const DEFAULT_ACCOUNTS = [
  { email: "admin@mock.proroleplay.test", password: "Demo@1234" },
  { email: "educator@mock.proroleplay.test", password: "Demo@1234" },
  { email: "student@mock.proroleplay.test", password: "Demo@1234" },
];
const accountsFile = opt("accounts", null);
const ACCOUNTS = accountsFile ? JSON.parse(readFileSync(accountsFile, "utf8")) : DEFAULT_ACCOUNTS;

if (!(USERS > 0 && DURATION_S > 0 && RAMP_S >= 0 && THINK_MAX >= THINK_MIN)) {
  console.error("Invalid options. See the header of scripts/loadTest.mjs.");
  process.exit(2);
}
if (!ACCOUNTS.length) {
  console.error("No accounts to log in with.");
  process.exit(2);
}

// The live app. Load-testing it slows it down for real users.
const PRODUCTION_HOSTS = ["vpsbackend.metawingsxr.com", "vps.metawingsxr.com", "vpsdashboard.metawingsxr.com"];
if (PRODUCTION_HOSTS.includes(new URL(TARGET).hostname) && !ALLOW_PROD) {
  console.error(`Refusing to load-test production (${TARGET}). Use the staging URL, or pass --allow-production.`);
  process.exit(2);
}

// ---- what each role clicks on ---------------------------------------------
// [label, path, weight]. Weight = how often that screen is opened relative to
// the others. Paths use the same paged query strings the UI sends.

const page = () => 1 + Math.floor(Math.random() * 3);
const SCREENS = {
  student: [
    ["student dashboard", () => "/api/dashboard/student-stats", 4],
    ["my scenarios", () => "/api/scenarios", 4],
  ],
  educator: [
    ["educator dashboard", () => "/api/dashboard/educator-stats", 3],
    ["students list", () => `/api/students?page=${page()}&limit=8&sortBy=name&sortDir=asc`, 4],
    ["students search", () => `/api/students?page=1&limit=8&searchTerm=${randomLetter()}`, 2],
    ["scenarios list", () => `/api/scenarios?page=${page()}&limit=10`, 3],
    ["groups", () => "/api/groups", 1],
  ],
  school_admin: [
    ["school admin dashboard", () => "/api/dashboard/school-admin-stats", 3],
    ["students list", () => `/api/students?page=${page()}&limit=8`, 3],
    ["scenarios list", () => `/api/scenarios?page=${page()}&limit=10&sortBy=educator`, 2],
    ["users list", () => `/api/users?page=${page()}&limit=10`, 2],
    ["groups", () => "/api/groups", 1],
  ],
  superadmin: [
    ["superadmin dashboard", () => "/api/dashboard/stats", 3],
    ["schools list", () => `/api/schools?page=${page()}&limit=15`, 3],
    ["users list", () => `/api/users?page=${page()}&limit=10`, 2],
  ],
};
const randomLetter = () => "aeiou"[Math.floor(Math.random() * 5)];

const pickWeighted = (list) => {
  const total = list.reduce((s, [, , w]) => s + w, 0);
  let r = Math.random() * total;
  for (const item of list) if ((r -= item[2]) < 0) return item;
  return list[list.length - 1];
};

// ---- measurement -----------------------------------------------------------

const stats = new Map(); // label -> { times: [], errors: 0, codes: {} }
const errorSamples = [];

const record = (label, ms, status, error) => {
  let s = stats.get(label);
  if (!s) stats.set(label, (s = { times: [], errors: 0, codes: {} }));
  s.times.push(ms);
  const code = error ? "network" : String(status);
  s.codes[code] = (s.codes[code] || 0) + 1;
  if (error || status >= 400) {
    s.errors++;
    if (errorSamples.length < 20) errorSamples.push(`${label}: ${error || `HTTP ${status}`}`);
  }
};

const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0;

async function timedFetch(label, path, init = {}) {
  const started = performance.now();
  try {
    const res = await fetch(TARGET + path, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    // Read the whole body: the time to download it is part of what users wait for.
    const body = await res.text();
    record(label, performance.now() - started, res.status);
    return { status: res.status, body };
  } catch (err) {
    record(label, performance.now() - started, 0, err.name === "TimeoutError" ? "timeout" : err.message);
    return { status: 0, body: "" };
  }
}

// ---- simulated user --------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const think = () => sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN));
let stopAt = Infinity;
let activeUsers = 0;

async function login(account) {
  const { status, body } = await timedFetch("login", "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account),
  });
  if (status !== 200) return null;
  const data = JSON.parse(body);
  return { id: data._id, role: data.role, token: data.token };
}

async function virtualUser(n) {
  const account = ACCOUNTS[n % ACCOUNTS.length];
  let session = await login(account);
  if (!session) return;
  activeUsers++;
  try {
    while (performance.now() < stopAt) {
      const screens = SCREENS[session.role];
      if (!screens) return;
      const [label, path] = pickWeighted(screens);
      const { status } = await timedFetch(label, path(session), {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      // Token expired mid-test: log in again like a real user would.
      if (status === 401) session = (await login(account)) || session;
      await think();
    }
  } finally {
    activeUsers--;
  }
}

// ---- run -------------------------------------------------------------------

async function main() {
  // One request up front so a wrong URL fails fast instead of 100 times.
  try {
    await fetch(TARGET + "/api/auth/login", { method: "OPTIONS", signal: AbortSignal.timeout(10_000) });
  } catch {
    console.error(`Cannot reach ${TARGET}. Is the server running?`);
    process.exit(2);
  }

  console.log(`Target ${TARGET}: ${USERS} users, ramp ${RAMP_S}s, hold ${DURATION_S}s, pause ${THINK_MIN}-${THINK_MAX}ms\n`);
  const t0 = performance.now();
  stopAt = t0 + (RAMP_S + DURATION_S) * 1000;

  const progress = setInterval(() => {
    const done = [...stats.values()].reduce((s, x) => s + x.times.length, 0);
    const errs = [...stats.values()].reduce((s, x) => s + x.errors, 0);
    const secs = Math.round((performance.now() - t0) / 1000);
    process.stdout.write(`  ${secs}s  active users ${activeUsers}  requests ${done}  errors ${errs}\n`);
  }, 5000);

  const users = [];
  for (let i = 0; i < USERS; i++) {
    users.push(virtualUser(i));
    if (RAMP_S > 0) await sleep((RAMP_S * 1000) / USERS);
  }
  await Promise.all(users);
  clearInterval(progress);

  report((performance.now() - t0) / 1000);
}

function report(elapsedS) {
  const rows = [];
  let total = 0;
  let totalErrors = 0;
  const failures = [];

  for (const [label, s] of [...stats].sort()) {
    const sorted = [...s.times].sort((a, b) => a - b);
    const row = {
      screen: label,
      requests: sorted.length,
      "errors %": +((s.errors / sorted.length) * 100).toFixed(2),
      "avg ms": Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      "p50 ms": Math.round(percentile(sorted, 50)),
      "p95 ms": Math.round(percentile(sorted, 95)),
      "p99 ms": Math.round(percentile(sorted, 99)),
      "max ms": Math.round(sorted[sorted.length - 1]),
    };
    rows.push(row);
    total += sorted.length;
    totalErrors += s.errors;
    if (row["p95 ms"] > P95_LIMIT) failures.push(`${label}: p95 ${row["p95 ms"]}ms is over ${P95_LIMIT}ms`);
  }

  console.log("\nResults per screen:");
  console.table(rows);

  const errorRate = total ? (totalErrors / total) * 100 : 100;
  if (errorRate > ERROR_LIMIT) failures.push(`error rate ${errorRate.toFixed(2)}% is over ${ERROR_LIMIT}%`);
  if (total === 0) failures.push("no requests completed (did every login fail?)");

  console.log(`Total ${total} requests in ${elapsedS.toFixed(0)}s = ${(total / elapsedS).toFixed(1)} requests/second, errors ${errorRate.toFixed(2)}%`);
  if (errorSamples.length) console.log("\nFirst errors:\n  " + errorSamples.join("\n  "));

  if (OUT) {
    writeFileSync(
      OUT,
      JSON.stringify(
        { target: TARGET, users: USERS, rampS: RAMP_S, durationS: DURATION_S, elapsedS, totalRequests: total, errorRate, screens: rows, failures, errorSamples },
        null,
        2,
      ),
    );
    console.log(`\nFull results written to ${OUT}`);
  }

  if (failures.length) {
    console.log("\nFAILED:\n  " + failures.join("\n  "));
    process.exit(1);
  }
  console.log("\nPASSED");
}

main();
