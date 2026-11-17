/**
 * Data for the new learner and educator dashboards (design: Notion
 * "vps_dashboards_v18", 17 Nov 2026; CR UI34).
 *
 * Only what the platform records today is computed here: sessions, their
 * History Taking score (Session.score, 0-1), feedback text and transcript,
 * attempts per scenario, activity, cohorts (Groups). The design's per-criterion
 * rubric, Clinical Reasoning and Treatment Planning scores, self-reflection,
 * PDF report and educator comment have no backend yet; the frontend shows them
 * as "in development" placeholders, and `available` below says so explicitly
 * so the UI never has to guess.
 *
 *   GET /api/dashboard/v2/learner                  the signed-in student
 *   GET /api/dashboard/v2/educator?groupId=&discipline=
 *   GET /api/dashboard/v2/session/:id              one session, for its detail page
 */
import express from "express";
import mongoose from "mongoose";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Group from "../models/groupModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import { assignedToStudentQuery } from "../utils/scenarioAssignment.js";
import { isDiscipline, normalizeDiscipline } from "../utils/discipline.js";

const router = express.Router();

export const TARGET = 75;
const DAY = 86_400_000;

/** What the dashboards can show from real data today. */
const AVAILABLE = {
  historyTaking: true,
  rubric: false,
  clinicalReasoning: false,
  treatmentPlanning: false,
  selfReflection: false,
  pdfReport: false,
  educatorComment: false,
};

const pct = (score) => (Number.isFinite(score) ? Math.round(Math.min(Math.max(score, 0), 1) * 100) : null);

/** A session is complete once it has been graded (feedback written). */
const isDone = (s) => Boolean(String(s.feedback || "").trim());

/*
 * Minutes between the session row being created and last written. The row can
 * be written again long after the consultation (grading, a later retry), so a
 * span over two hours is not a session length; it is reported as unknown
 * rather than adding days to practice time.
 */
const MAX_SESSION_MIN = 120;
const minutes = (s) => {
  const ms = new Date(s.updatedAt) - new Date(s.createdAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const m = Math.max(1, Math.round(ms / 60_000));
  return m <= MAX_SESSION_MIN ? m : null;
};

/** Active within 14 days, at risk 15-30, inactive beyond or never. */
const activityOf = (lastDate, now = Date.now()) => {
  if (!lastDate) return { status: "inactive", days: null };
  const days = Math.floor((now - new Date(lastDate)) / DAY);
  return { status: days <= 14 ? "active" : days <= 30 ? "at_risk" : "inactive", days };
};

/**
 * One student's sessions in display shape, oldest first, numbered per scenario
 * (attempt) and overall. `scenarios` maps id -> {name, discipline}; sessions on
 * scenarios not in the map (deleted, unassigned, other discipline) are dropped.
 */
const shapeSessions = (rows, scenarios) => {
  const attempts = {};
  return rows
    .filter((s) => scenarios.has(String(s.scenario_id)))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((s, i) => {
      const sid = String(s.scenario_id);
      attempts[sid] = (attempts[sid] || 0) + 1;
      const done = isDone(s);
      return {
        id: String(s._id),
        no: i + 1,
        scenarioId: sid,
        scenarioName: scenarios.get(sid).name,
        discipline: scenarios.get(sid).discipline,
        attempt: attempts[sid],
        date: s.createdAt,
        durationMin: minutes(s),
        status: done ? "completed" : (s.transcription || []).length ? "in_progress" : "started",
        ht: done ? pct(s.score) : null,
        turns: (s.transcription || []).length,
      };
    });
};

const summarise = (sessions) => {
  const done = sessions.filter((s) => s.status === "completed");
  const first = done[0];
  const latest = done[done.length - 1];
  return {
    completed: done.length,
    inProgress: sessions.filter((s) => s.status !== "completed").length,
    firstHT: first?.ht ?? null,
    latestHT: latest?.ht ?? null,
    progress: done.length >= 2 ? latest.ht - first.ht : null,
    atTarget: latest ? latest.ht >= TARGET : false,
    lastDate: sessions.length ? sessions[sessions.length - 1].date : null,
    practiceMin: done.reduce((t, s) => t + (s.durationMin || 0), 0),
  };
};

const scenarioMap = (list) =>
  new Map(
    list.map((s) => [
      String(s._id),
      { name: s.scenarioName, discipline: normalizeDiscipline(s.discipline) },
    ]),
  );

// ---- learner ---------------------------------------------------------------

router.get("/learner", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "The learner dashboard is for students." });
    }
    const me = req.user;

    const [scenarioDocs, rows, profile, group] = await Promise.all([
      Scenario.find({ ...assignedToStudentQuery(me), status: "Published" })
        .select("scenarioName description discipline difficulty")
        .lean(),
      Session.find({ student_id: String(me._id) })
        .select("scenario_id score feedback transcription createdAt updatedAt")
        .lean(),
      Student.findOne({ user: me._id }).select("educatorId").lean(),
      me.groupId ? Group.findById(me.groupId).select("name educatorId").lean() : null,
    ]);

    const scenarios = scenarioMap(scenarioDocs);
    const sessions = shapeSessions(rows, scenarios);

    const educatorId = profile?.educatorId || group?.educatorId;
    const educator = educatorId
      ? await User.findById(educatorId).select("name email").lean()
      : null;

    // Cohort average of everyone else's latest completed HT, for context only.
    let cohortHT = null;
    if (group) {
      const peers = await User.find({ groupId: group._id, role: "student", _id: { $ne: me._id } })
        .select("_id")
        .lean();
      if (peers.length) {
        const peerRows = await Session.find({
          student_id: { $in: peers.map((p) => String(p._id)) },
          scenario_id: { $in: [...scenarios.keys()] },
          feedback: { $nin: ["", null] },
        })
          .select("student_id score createdAt")
          .sort({ createdAt: 1 })
          .lean();
        const latest = new Map();
        peerRows.forEach((r) => latest.set(r.student_id, pct(r.score)));
        const vals = [...latest.values()].filter((v) => v !== null);
        if (vals.length) cohortHT = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
    }

    const perScenario = scenarioDocs.map((s) => {
      const mine = sessions.filter((x) => x.scenarioId === String(s._id));
      const done = mine.filter((x) => x.status === "completed");
      const last = mine[mine.length - 1];
      return {
        id: String(s._id),
        name: s.scenarioName,
        description: s.description || "",
        discipline: normalizeDiscipline(s.discipline),
        difficulty: s.difficulty || "",
        status: done.length ? "completed" : mine.length ? "in_progress" : "not_started",
        sessionsCompleted: done.length,
        bestHT: done.length ? Math.max(...done.map((x) => x.ht)) : null,
        latestHT: done.length ? done[done.length - 1].ht : null,
        lastSessionId: last?.id || null,
        inProgressSince: last && last.status !== "completed" ? last.date : null,
      };
    });

    res.json({
      target: TARGET,
      available: AVAILABLE,
      learner: { id: String(me._id), name: me.name, email: me.email, cohort: group?.name || null },
      educator: educator ? { name: educator.name, email: educator.email } : null,
      summary: { ...summarise(sessions), assigned: scenarioDocs.length, cohortHT },
      scenarios: perScenario,
      sessions: sessions.slice().reverse(),
    });
  } catch (err) {
    console.error("[DASHBOARD v2] learner:", err);
    res.status(500).json({ message: "Could not load your dashboard." });
  }
});

// ---- educator --------------------------------------------------------------

/** The students and cohorts this educator / admin may see. */
const scopeFor = async (req) => {
  const role = req.user.role;
  if (role === "educator") {
    const groups = await Group.find({ educatorId: req.user._id }).select("name").lean();
    const profiles = await Student.find({ educatorId: req.user._id }).select("user").lean();
    const students = await User.find({
      role: "student",
      $or: [{ _id: { $in: profiles.map((p) => p.user) } }, { groupId: { $in: groups.map((g) => g._id) } }],
    })
      .select("name email groupId createdAt lastLoginAt")
      .lean();
    return { groups, students, scenarioFilter: { educator: req.user._id } };
  }
  const schoolId = req.scope?.schoolId;
  const filter = schoolId ? { schoolId } : {};
  const [groups, students] = await Promise.all([
    Group.find(filter).select("name").lean(),
    User.find({ role: "student", ...filter }).select("name email groupId createdAt lastLoginAt").lean(),
  ]);
  return { groups, students, scenarioFilter: filter };
};

router.get("/educator", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    const { groups, students: allStudents, scenarioFilter } = await scopeFor(req);
    const discipline = isDiscipline(req.query.discipline) ? normalizeDiscipline(req.query.discipline) : null;
    const groupId = mongoose.Types.ObjectId.isValid(req.query.groupId) ? String(req.query.groupId) : null;

    const scenarioDocs = await Scenario.find({
      ...scenarioFilter,
      ...(discipline && { discipline: discipline === "PT" ? { $in: ["PT", null] } : "OT" }),
    })
      .select("scenarioName status discipline")
      .lean();
    const scenarios = scenarioMap(scenarioDocs);

    const groupName = new Map(groups.map((g) => [String(g._id), g.name]));
    const students = groupId ? allStudents.filter((s) => String(s.groupId) === groupId) : allStudents;

    const rows = await Session.find({
      student_id: { $in: students.map((s) => String(s._id)) },
      scenario_id: { $in: [...scenarios.keys()] },
    })
      .select("student_id scenario_id score feedback transcription createdAt updatedAt")
      .lean();
    const byStudent = new Map();
    rows.forEach((r) => {
      if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, []);
      byStudent.get(r.student_id).push(r);
    });

    const now = Date.now();
    const learners = students.map((u) => {
      const sessions = shapeSessions(byStudent.get(String(u._id)) || [], scenarios);
      const sum = summarise(sessions);
      const lastDone = [...sessions].reverse().find((s) => s.status === "completed");
      return {
        id: String(u._id),
        name: u.name,
        email: u.email,
        cohortId: u.groupId ? String(u.groupId) : null,
        cohort: u.groupId ? groupName.get(String(u.groupId)) || null : null,
        invited: !u.lastLoginAt,
        ...sum,
        activity: activityOf(lastDone?.date, now),
      };
    });

    const withScore = learners.filter((l) => l.latestHT !== null);
    const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const progressed = learners.filter((l) => l.progress !== null);

    const cohorts = groups.map((g) => {
      const members = allStudents.filter((s) => String(s.groupId) === String(g._id)).map((s) => String(s._id));
      const ls = learners.filter((l) => members.includes(l.id));
      return {
        id: String(g._id),
        name: g.name,
        learners: members.length,
        atTarget: ls.filter((l) => l.atTarget).length,
        progress: avg(ls.filter((l) => l.progress !== null).map((l) => l.progress)),
        avgHT: avg(ls.filter((l) => l.latestHT !== null).map((l) => l.latestHT)),
      };
    });

    res.json({
      target: TARGET,
      available: AVAILABLE,
      scope: { groupId, discipline, groupName: groupId ? groupName.get(groupId) || null : null },
      kpis: {
        learners: learners.length,
        atTarget: learners.filter((l) => l.atTarget).length,
        active: learners.filter((l) => l.activity.status === "active").length,
        atRisk: learners.filter((l) => l.activity.status === "at_risk").length,
        inactive: learners.filter((l) => l.activity.status === "inactive").length,
        notStarted: learners.filter((l) => l.completed === 0).length,
        progress: avg(progressed.map((l) => l.progress)),
        progressedLearners: progressed.length,
        avgPracticeMin: avg(withScore.map((l) => l.practiceMin)),
        scenarios: scenarioDocs.length,
        scenariosPublished: scenarioDocs.filter((s) => s.status === "Published").length,
        avgHT: avg(withScore.map((l) => l.latestHT)),
        firstHT: avg(progressed.map((l) => l.firstHT)),
      },
      cohorts,
      learners,
    });
  } catch (err) {
    console.error("[DASHBOARD v2] educator:", err);
    res.status(500).json({ message: "Could not load the dashboard." });
  }
});

/** One learner's sessions, for the educator's learner drill-down. */
router.get("/learner/:userId", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    const { students } = await scopeFor(req);
    const u = students.find((s) => String(s._id) === req.params.userId);
    if (!u) return res.status(404).json({ message: "Learner not found in your scope." });
    const rows = await Session.find({ student_id: String(u._id) })
      .select("scenario_id score feedback transcription createdAt updatedAt")
      .lean();
    const scenarioDocs = await Scenario.find({ _id: { $in: [...new Set(rows.map((r) => r.scenario_id))].filter((id) => mongoose.Types.ObjectId.isValid(id)) } })
      .select("scenarioName discipline")
      .lean();
    const sessions = shapeSessions(rows, scenarioMap(scenarioDocs));
    res.json({
      target: TARGET,
      available: AVAILABLE,
      learner: { id: String(u._id), name: u.name, email: u.email },
      summary: summarise(sessions),
      sessions: sessions.slice().reverse(),
    });
  } catch (err) {
    console.error("[DASHBOARD v2] learner detail:", err);
    res.status(500).json({ message: "Could not load this learner." });
  }
});

// ---- one session -----------------------------------------------------------

router.get("/session/:id", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Session not found." });
    }
    const s = await Session.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ message: "Session not found." });

    if (req.user.role === "student") {
      if (s.student_id !== String(req.user._id)) return res.status(404).json({ message: "Session not found." });
    } else if (req.user.role !== "superadmin") {
      const { students } = await scopeFor(req);
      if (!students.some((u) => String(u._id) === s.student_id)) {
        return res.status(404).json({ message: "Session not found." });
      }
    }

    const [scenario, learner, earlier] = await Promise.all([
      mongoose.Types.ObjectId.isValid(s.scenario_id)
        ? Scenario.findById(s.scenario_id).select("scenarioName discipline").lean()
        : null,
      User.findById(s.student_id).select("name email").lean(),
      Session.countDocuments({ student_id: s.student_id, scenario_id: s.scenario_id, createdAt: { $lt: s.createdAt } }),
    ]);

    const done = isDone(s);
    res.json({
      target: TARGET,
      available: AVAILABLE,
      id: String(s._id),
      learner: learner ? { name: learner.name, email: learner.email } : null,
      scenario: scenario
        ? { id: String(scenario._id), name: scenario.scenarioName, discipline: normalizeDiscipline(scenario.discipline) }
        : { id: s.scenario_id, name: "Deleted scenario", discipline: "PT" },
      attempt: earlier + 1,
      date: s.createdAt,
      durationMin: minutes(s),
      status: done ? "completed" : "in_progress",
      ht: done ? pct(s.score) : null,
      feedback: s.feedback || "",
      transcription: (s.transcription || [])
        .filter((t) => t.role !== "system")
        .map(({ role, content, speaker }) => ({ role, content, speaker })),
    });
  } catch (err) {
    console.error("[DASHBOARD v2] session:", err);
    res.status(500).json({ message: "Could not load this session." });
  }
});

export default router;
