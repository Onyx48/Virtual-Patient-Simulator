/*
 * The in-app assistant (after ci/internal-shortlisting's workspace chat). It answers from the
 * caller's own data only (the same scope as their dashboards) and never changes anything by
 * itself: changes come back as an <actions> proposal the user confirms, and POST /execute checks
 * every action again against the caller's scope before running it.
 *
 *   GET    /api/assistant/chats            the caller's conversations
 *   GET    /api/assistant/chats/:id        one conversation
 *   DELETE /api/assistant/chats/:id
 *   POST   /api/assistant/chat             { chatId?, message } -> { chatId, title, message }
 *   POST   /api/assistant/execute          { chatId, messageId, actions } -> { results }
 *
 * Students get a practice coach: their own attempts by skill, never checklist questions,
 * evidence or case answers (mindsets/student.md, S8).
 */
import express from "express";
import mongoose from "mongoose";
import AssistantChat from "../models/assistantChatModel.js";
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import Scenario from "../models/scenarioModel.js";
import Group from "../models/groupModel.js";
import School from "../models/schoolModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { generateTextWithFallback } from "../utils/aiText.js";
import { assignedToStudentQuery } from "../utils/scenarioAssignment.js";
import { sendEducatorMessage, assertMailConfigured } from "../utils/emailService.js";
import * as L from "../utils/learning.js";

const router = express.Router();
const STAFF = ["educator", "school_admin"];
const DAILY_LIMIT = { student: 40, educator: 120, school_admin: 120, superadmin: 120 };
const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const clip = (s, n) => (s ? String(s).replace(/\s+/g, " ").slice(0, n) : undefined);

/* ---------- Context: what the assistant may know, per role ---------- */

const studentScope = (user) =>
  user.role === "educator" ? { role: "student", supervisor: user._id } : user.role === "school_admin" ? { role: "student", schoolId: user.schoolId } : null;

async function staffContext(user) {
  const who = studentScope(user);
  const scen = user.role === "educator" ? { educator: user._id } : { schoolId: user.schoolId };
  const grp = user.role === "educator" ? { educatorId: user._id } : { schoolId: user.schoolId };
  const [students, scenarios, groups] = await Promise.all([
    User.find(who).select("_id name email groupId inviteStatus readinessOverride educatorNote supervisor").limit(400).lean(),
    Scenario.find(scen).select("_id scenarioName status assignedTo assignedGroups difficulty").lean(),
    Group.find(grp).select("_id name").lean(),
  ]);
  const groupName = new Map(groups.map((g) => [String(g._id), g.name]));
  const sessions = await Session.find({ student_id: { $in: students.map((s) => String(s._id)) }, score: { $gt: 0 } })
    .select("+question_results student_id scenario_id score createdAt reflection.summary")
    .sort({ createdAt: 1 }).limit(8000).lean();
  const per = new Map();
  for (const s of sessions) (per.get(s.student_id) || per.set(s.student_id, []).get(s.student_id)).push(s);
  const scenName = new Map(scenarios.map((s) => [String(s._id), s.scenarioName]));

  const learners = students.map((u) => {
    const id = String(u._id);
    const list = per.get(id) || [];
    const first = list[0], last = list[list.length - 1];
    const crit = [...L.learnerCriteria(list)].filter(([, v]) => v < L.TARGET).sort((a, b) => a[1] - b[1]).slice(0, 3);
    const assigned = scenarios.filter((sc) => (sc.assignedTo || []).some((x) => String(x) === id) || (u.groupId && (sc.assignedGroups || []).some((g) => String(g) === String(u.groupId))));
    const tried = new Set(list.map((x) => x.scenario_id));
    return {
      id, name: u.name, email: u.email,
      group: u.groupId ? groupName.get(String(u.groupId)) || null : null,
      invite: u.inviteStatus === "pending" ? "never signed in" : undefined,
      status: L.activity(last?.createdAt),
      lastSession: day(last?.createdAt),
      sessions: list.length,
      latest: last ? L.scorePct(last.score) : null,
      first: first ? L.scorePct(first.score) : null,
      best: list.length ? Math.max(...list.map((x) => L.scorePct(x.score))) : null,
      weakSkills: crit.length ? crit.map(([k, v]) => `${k} ${v}%`) : undefined,
      notStarted: assigned.filter((sc) => !tried.has(String(sc._id))).map((sc) => sc.scenarioName).slice(0, 6),
      lastReflection: clip([...list].reverse().find((x) => x.reflection?.summary)?.reflection.summary, 160),
      readiness: u.readinessOverride?.status || undefined,
      note: clip(u.educatorNote?.text, 120),
    };
  });

  const byScenario = new Map();
  for (const s of sessions) {
    const r = byScenario.get(s.scenario_id) || { n: 0, sum: 0, people: new Set() };
    r.n += 1; r.sum += L.scorePct(s.score); r.people.add(s.student_id);
    byScenario.set(s.scenario_id, r);
  }
  const crit = new Map();
  for (const [sid, list] of per) {
    if (!students.some((u) => String(u._id) === sid)) continue;
    for (const [k, v] of L.learnerCriteria(list)) {
      const c = crit.get(k) || { of: 0, below: 0 };
      c.of += 1; if (v < L.TARGET) c.below += 1;
      crit.set(k, c);
    }
  }
  return {
    today: day(new Date()),
    rules: { target: `${L.TARGET}%`, active: "last scored session within 14 days", atRisk: "15-30 days", inactive: "over 30 days" },
    groups: groups.map((g) => ({ id: String(g._id), name: g.name, students: students.filter((s) => String(s.groupId) === String(g._id)).length })),
    scenarios: scenarios.map((s) => {
      const r = byScenario.get(String(s._id));
      return { id: String(s._id), name: s.scenarioName, status: s.status || "Draft", assignedStudents: (s.assignedTo || []).length, assignedGroups: (s.assignedGroups || []).map((g) => groupName.get(String(g))).filter(Boolean), sessions: r?.n || 0, students: r?.people.size || 0, avg: r ? Math.round(r.sum / r.n) : null };
    }),
    skillsBelowStandard: [...crit].map(([k, c]) => ({ skill: k, learnersBelow: c.below, of: c.of })).sort((a, b) => b.learnersBelow - a.learnersBelow).slice(0, 8),
    learners,
    recentSessions: sessions.slice(-25).reverse().map((s) => ({ student: learners.find((l) => l.id === s.student_id)?.name, scenario: scenName.get(s.scenario_id) || "Scenario", score: L.scorePct(s.score), date: day(s.createdAt) })),
  };
}

async function studentContext(user) {
  const [scenarios, sessions] = await Promise.all([
    Scenario.find(assignedToStudentQuery(user)).select("_id scenarioName difficulty status testable").lean(),
    Session.find({ student_id: String(user._id), score: { $gt: 0 } }).select("+question_results scenario_id score createdAt reflection.summary").sort({ createdAt: 1 }).limit(300).lean(),
  ]);
  const name = new Map(scenarios.map((s) => [String(s._id), s.scenarioName]));
  const crit = [...L.learnerCriteria(sessions)].map(([k, v]) => ({ skill: k, met: `${v}%` })).sort((a, b) => parseInt(a.met, 10) - parseInt(b.met, 10));
  return {
    today: day(new Date()),
    target: `${L.TARGET}%`,
    scenarios: scenarios.map((s) => {
      const mine = sessions.filter((x) => x.scenario_id === String(s._id));
      return { id: String(s._id), name: s.scenarioName, difficulty: s.difficulty, open: s.testable === true, attempts: mine.length, scores: mine.map((x) => L.scorePct(x.score)), last: day(mine[mine.length - 1]?.createdAt) };
    }),
    skills: crit,
    attempts: sessions.slice(-20).map((x) => ({ scenario: name.get(x.scenario_id) || "Scenario", score: L.scorePct(x.score), date: day(x.createdAt), myReflection: clip(x.reflection?.summary, 200) })),
  };
}

async function superadminContext() {
  const schools = await School.find({}).select("_id name status expireDate subscriptionType").lean();
  const since = new Date(Date.now() - 30 * 86400000);
  const [students, educators, sessions] = await Promise.all([
    User.aggregate([{ $match: { role: "student" } }, { $group: { _id: "$schoolId", n: { $sum: 1 } } }]),
    User.aggregate([{ $match: { role: "educator" } }, { $group: { _id: "$schoolId", n: { $sum: 1 } } }]),
    Session.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $addFields: { sid: { $convert: { input: "$student_id", to: "objectId", onError: null, onNull: null } } } },
      { $lookup: { from: "users", localField: "sid", foreignField: "_id", as: "u" } },
      { $group: { _id: { $first: "$u.schoolId" }, n: { $sum: 1 } } },
    ]),
  ]);
  const m = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
  const st = m(students), ed = m(educators), se = m(sessions);
  return {
    today: day(new Date()),
    schools: schools.map((s) => ({ id: String(s._id), name: s.name, status: s.status, plan: s.subscriptionType, expires: day(s.expireDate), students: st.get(String(s._id)) || 0, educators: ed.get(String(s._id)) || 0, sessions30: se.get(String(s._id)) || 0 })),
  };
}

const contextFor = (user) => (STAFF.includes(user.role) ? staffContext(user) : user.role === "student" ? studentContext(user) : superadminContext());

/* ---------- Prompt ---------- */

const BLOCKS = `
## Rich blocks (the app draws these; use them, they are better than tables)
Chart, for any comparison of numbers. Only raw JSON inside, no code fence:
<chart>{"type":"bar","title":"Latest score by learner","unit":"%","data":[{"name":"Ana","value":82},{"name":"Ben","value":64}]}</chart>
type is "bar", "line" (data in time order) or "pie". Keep to 12 items or fewer.`;

const STAFF_BLOCKS = `
Learner cards, when you name specific learners the user may want to open:
<students>["<learner id>","<learner id>"]</students>

Proposed changes. You CANNOT change anything yourself. When the user asks you to do something (email, remind, assign, move to a group, note, readiness), propose it in ONE block; the user sees a card and must press Confirm. Only raw JSON array inside:
<actions title="Remind the 3 inactive learners">[{"type":"email","studentIds":["<id>"],"subject":"...","body":"Plain text, short, friendly, signed with the user's name."}]</actions>
Action types (ids must come from the data):
- {"type":"email","studentIds":[...],"subject":"...","body":"..."}
- {"type":"assign","scenarioId":"...","studentIds":[...]}  (only Published scenarios)
- {"type":"move_group","groupId":"...","studentIds":[...]}
- {"type":"note","studentId":"...","text":"..."}  (the educator's private note on a learner; replaces the old one)
- {"type":"readiness","studentId":"...","status":"ready"|"almost"|"notyet","note":"why"}
Never propose deleting anything. If you cannot find an id in the data, say so instead of guessing.`;

const SUPER_BLOCKS = `
Proposed changes: you CANNOT change anything yourself. To extend a school's licence, propose:
<actions title="Extend City College by a year">[{"type":"extend_school","schoolId":"...","months":12}]</actions>
The user must press Confirm.`;

function systemPrompt(user, ctx) {
  const who = user.name || "the user";
  const base = `You are the assistant inside the Virtual Patient Simulator (VPS Clinical), where health-profession learners practise history taking with AI virtual patients and get graded feedback.
Today is ${ctx.today}. You are talking to ${who} (${user.role.replace("_", " ")}).
Answer only from the DATA below. Be concrete and brief: lead with the answer, then the few names or numbers that support it. Use short markdown (bold, bullet lists). If the data cannot answer, say what is missing. Never invent names, ids or scores.`;
  if (user.role === "student") {
    return `${base}
You are this learner's practice coach. Encourage, be specific, and suggest what to practise next and why, using their skills (percent of each skill's checklist met; ${ctx.target} is the target) and attempts.
STRICT: you do not know and must never reveal the checklist questions, the grader's evidence, the patient's diagnosis or case answers. If asked, explain that the feedback after each attempt shows what to work on. You cannot start sessions or change anything.
There are no rankings: never compare the learner with classmates.
${BLOCKS}

DATA:
${JSON.stringify(ctx)}`;
  }
  return `${base}
Definitions: "latest" is the latest scored session %, target ${ctx.rules?.target || "75%"}; status active/atrisk/inactive/new comes from the last scored session; weakSkills are skills under target on their latest attempts; notStarted lists assigned scenarios with no session.
${BLOCKS}
${user.role === "superadmin" ? SUPER_BLOCKS : STAFF_BLOCKS}

DATA:
${JSON.stringify(ctx)}`;
}

/* ---------- Routes ---------- */

router.get("/chats", protect, async (req, res) => {
  const rows = await AssistantChat.find({ userId: req.user._id }).select("_id title updatedAt").sort({ updatedAt: -1 }).limit(50).lean();
  res.json(rows);
});

router.get("/chats/:id", protect, async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ message: "Chat not found." });
  const chat = await AssistantChat.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!chat) return res.status(404).json({ message: "Chat not found." });
  res.json(chat);
});

router.delete("/chats/:id", protect, async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ message: "Chat not found." });
  await AssistantChat.deleteOne({ _id: req.params.id, userId: req.user._id });
  res.json({ ok: true });
});

router.post("/chat", protect, async (req, res) => {
  try {
    const text = String(req.body?.message || "").trim().slice(0, 4000);
    if (!text) return res.status(400).json({ message: "Type a question first." });

    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [{ n = 0 } = {}] = await AssistantChat.aggregate([
      { $match: { userId: req.user._id, updatedAt: { $gte: start } } },
      { $unwind: "$messages" },
      { $match: { "messages.role": "user", "messages.at": { $gte: start } } },
      { $count: "n" },
    ]);
    const limit = DAILY_LIMIT[req.user.role] || 40;
    if (n >= limit) return res.status(429).json({ message: `That is the ${limit} questions for today. The assistant is back tomorrow.` });

    let chat = isId(req.body?.chatId) ? await AssistantChat.findOne({ _id: req.body.chatId, userId: req.user._id }) : null;
    if (!chat) chat = new AssistantChat({ userId: req.user._id, role: req.user.role, title: text.slice(0, 60), messages: [] });

    const ctx = await contextFor(req.user);
    const history = chat.messages.slice(-12).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
    const userQuery = `${history ? `Conversation so far:\n${history}\n\n` : ""}User: ${text}\n\nAssistant:`;
    const { text: answer } = await generateTextWithFallback({ systemPrompt: systemPrompt(req.user, ctx), userQuery });

    chat.messages.push({ role: "user", content: text });
    chat.messages.push({ role: "assistant", content: String(answer || "").trim() || "I could not answer that. Try asking another way." });
    await chat.save();
    res.json({ chatId: chat._id, title: chat.title, message: chat.messages[chat.messages.length - 1] });
  } catch (err) {
    console.error("Assistant chat error:", err);
    res.status(502).json({ message: "The assistant could not answer just now. Try again in a moment." });
  }
});

/* Every action is checked again here: the model's proposal is only a suggestion. */
router.post("/execute", protect, async (req, res) => {
  try {
    const { chatId, messageId, actions } = req.body || {};
    if (!Array.isArray(actions) || !actions.length || actions.length > 20) return res.status(400).json({ message: "Nothing to run." });
    const chat = isId(chatId) ? await AssistantChat.findOne({ _id: chatId, userId: req.user._id }) : null;
    const msg = chat && messageId ? chat.messages.id(messageId) : null;
    if (!msg) return res.status(404).json({ message: "That proposal is no longer available." });
    if (msg.executed) return res.status(409).json({ message: "Already done.", results: msg.executed });

    const role = req.user.role;
    const scope = studentScope(req.user);
    const mine = async (ids) => {
      const list = (Array.isArray(ids) ? ids : [ids]).filter(isId).slice(0, 200);
      if (!scope || !list.length) return [];
      return User.find({ ...scope, _id: { $in: list } }).select("_id name email").lean();
    };
    const results = [];
    for (const a of actions) {
      try {
        if (role === "superadmin" && a.type === "extend_school") {
          const months = Math.max(1, Math.min(36, parseInt(a.months, 10) || 12));
          const school = isId(a.schoolId) ? await School.findById(a.schoolId) : null;
          if (!school) throw new Error("School not found");
          const from = school.expireDate && school.expireDate > new Date() ? new Date(school.expireDate) : new Date();
          from.setMonth(from.getMonth() + months);
          school.expireDate = from;
          if (school.status === "Expired") school.status = "Active";
          await school.save();
          results.push({ type: a.type, ok: true, detail: `${school.name} now runs to ${day(from)}` });
          continue;
        }
        if (!STAFF.includes(role)) throw new Error("Not allowed");

        if (a.type === "email") {
          assertMailConfigured();
          const to = await mine(a.studentIds);
          if (!to.length) throw new Error("None of those learners are yours");
          const html = String(a.body || "").split(/\n{2,}/).map((p) => `<p>${p.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]).replace(/\n/g, "<br/>")}</p>`).join("");
          let sent = 0;
          for (const r of to) {
            try { await sendEducatorMessage({ toEmail: r.email, subject: String(a.subject || "A note from your educator"), html, educatorName: req.user.name, educatorEmail: req.user.email }); sent += 1; } catch { /* counted below */ }
          }
          results.push({ type: a.type, ok: sent > 0, detail: `Sent to ${sent} of ${to.length}` });
        } else if (a.type === "assign") {
          const scen = user => (user.role === "educator" ? { educator: user._id } : { schoolId: user.schoolId });
          const sc = isId(a.scenarioId) ? await Scenario.findOne({ _id: a.scenarioId, ...scen(req.user) }) : null;
          if (!sc) throw new Error("Scenario not found");
          if (sc.status !== "Published") throw new Error("Publish the scenario first");
          const to = await mine(a.studentIds);
          if (!to.length) throw new Error("None of those learners are yours");
          await Scenario.updateOne({ _id: sc._id }, { $addToSet: { assignedTo: { $each: to.map((u) => u._id) } } });
          results.push({ type: a.type, ok: true, detail: `${sc.scenarioName} assigned to ${to.length}` });
        } else if (a.type === "move_group") {
          const g = isId(a.groupId) ? await Group.findOne({ _id: a.groupId, ...(role === "educator" ? { educatorId: req.user._id } : { schoolId: req.user.schoolId }) }) : null;
          if (!g) throw new Error("Group not found");
          const to = await mine(a.studentIds);
          if (!to.length) throw new Error("None of those learners are yours");
          await User.updateMany({ _id: { $in: to.map((u) => u._id) } }, { $set: { groupId: g._id } });
          results.push({ type: a.type, ok: true, detail: `${to.length} moved to ${g.name}` });
        } else if (a.type === "note") {
          const [u] = await mine([a.studentId]);
          if (!u) throw new Error("Learner not found");
          const text = String(a.text || "").slice(0, 2000);
          await User.updateOne({ _id: u._id }, { $set: { educatorNote: { text, byName: req.user.name || "", at: new Date() } } });
          results.push({ type: a.type, ok: true, detail: `Note saved on ${u.name}` });
        } else if (a.type === "readiness") {
          if (!["ready", "almost", "notyet"].includes(a.status)) throw new Error("Unknown status");
          const [u] = await mine([a.studentId]);
          if (!u) throw new Error("Learner not found");
          await User.updateOne({ _id: u._id }, { $set: { readinessOverride: { status: a.status, note: String(a.note || "").slice(0, 1000), byName: req.user.name || "", at: new Date() } } });
          results.push({ type: a.type, ok: true, detail: `${u.name} set to ${a.status}` });
        } else {
          throw new Error("Unknown action");
        }
      } catch (e) {
        results.push({ type: a?.type, ok: false, detail: e.message || "Failed" });
      }
    }
    msg.executed = { at: new Date(), results };
    chat.markModified("messages");
    await chat.save();
    res.json({ results });
  } catch (err) {
    console.error("Assistant execute error:", err);
    res.status(500).json({ message: "Server error running those changes." });
  }
});

export default router;
