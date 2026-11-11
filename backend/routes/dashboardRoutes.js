import mongoose from "mongoose";
import express from "express";
import School from "../models/schoolModel.js";
import Scenario from "../models/scenarioModel.js";
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import Group from "../models/groupModel.js";
import * as L from "../utils/learning.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import {
  assignedStudentIdsByScenario,
  assignedToStudentQuery,
} from "../utils/scenarioAssignment.js";

const router = express.Router();

router.get(
  "/stats",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const activeSchools = await School.countDocuments({ status: "Active" });
      const activeScenarios = await Scenario.countDocuments({});
      const activeEducators = await User.countDocuments({ role: "educator" });
      const activeStudents = await User.countDocuments({ role: "student" });

      res.json({
        activeSchools,
        activeScenarios,
        activeEducators,
        activeStudents,
      });
    } catch (error) {
      console.error("Error fetching global stats:", error);
      res.status(500).json({ message: "Server error fetching stats" });
    }
  },
);

router.get(
  "/schools-detailed",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const schools = await School.find({ status: "Active" }).sort({
        createdAt: -1,
      });

      // Three grouped counts in total, not three queries per school (thousands at once at scale).
      const ids = schools.map((x) => x._id);
      const [userCounts, scenarioCounts] = await Promise.all([
        User.aggregate([{ $match: { schoolId: { $in: ids }, role: { $in: ["student", "educator"] } } }, { $group: { _id: { s: "$schoolId", r: "$role" }, n: { $sum: 1 } } }]),
        Scenario.aggregate([{ $match: { schoolId: { $in: ids } } }, { $group: { _id: "$schoolId", n: { $sum: 1 } } }]),
      ]);
      const cnt = new Map(userCounts.map((x) => [`${x._id.s}:${x._id.r}`, x.n]));
      const scn = new Map(scenarioCounts.map((x) => [String(x._id), x.n]));
      const detailedSchools = schools.map((school) => ({
        _id: school._id,
        name: school.schoolName,
        students: cnt.get(`${school._id}:student`) || 0,
        educators: cnt.get(`${school._id}:educator`) || 0,
        activeScenarios: scn.get(String(school._id)) || 0,
        assignedAdmin: school.assignedAdmin,
      }));

      res.json(detailedSchools);
    } catch (error) {
      console.error("Error fetching detailed school data:", error);
      res.status(500).json({ message: "Server error fetching school details" });
    }
  },
);

router.get(
  "/student-stats",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const studentId = req.user._id.toString();

      // Individually assigned plus everything assigned to this student's group.
      const assignedScenarios = await Scenario.find(
        assignedToStudentQuery(req.user),
      ).select("_id scenarioName");

      const totalAssigned = assignedScenarios.length;

      if (totalAssigned === 0) {
        return res.json({
          completedCount: 0,
          availableCount: 0,
          averageScore: null,
          scenarioScores: [],
          totalAssigned: 0,
        });
      }

      const sessions = await Session.find({ student_id: studentId });

      /*
       * Only sessions on scenarios still assigned to this student count. They used
       * to all count, so a student who had run a scenario that was later
       * unassigned, deleted, or reassigned had completedCount > totalAssigned —
       * and "Available Scenarios" rendered the difference as -1.
       */
      const assignedIds = new Set(
        assignedScenarios.map((scenario) => scenario._id.toString()),
      );

      const scenarioBestScores = {};
      const completedScenarioIds = new Set();

      sessions.forEach((session) => {
        const scenarioId = session.scenario_id.toString();
        if (!assignedIds.has(scenarioId)) return;
        if (
          !scenarioBestScores[scenarioId] ||
          session.score > scenarioBestScores[scenarioId].score
        ) {
          scenarioBestScores[scenarioId] = {
            score: session.score,
            sessionId: session._id,
          };
        }
        completedScenarioIds.add(scenarioId);
      });

      const scenarioScores = assignedScenarios.map((scenario) => {
        const bestScore = scenarioBestScores[scenario._id.toString()];
        return {
          scenarioId: scenario._id,
          scenarioName: scenario.scenarioName,
          bestScore: bestScore ? bestScore.score : null,
          isCompleted: completedScenarioIds.has(scenario._id.toString()),
        };
      });

      const completedCount = completedScenarioIds.size;
      // Clamped as a backstop: a count of scenarios can never be negative, whatever
      // the two inputs do.
      const availableCount = Math.max(0, totalAssigned - completedCount);

      const scores = Object.values(scenarioBestScores).map((s) => s.score);
      const averageScore =
        scores.length > 0
          ? Math.round(
              (scores.reduce((a, b) => a + b, 0) / scores.length) * 100,
            )
          : null;

      res.json({
        completedCount,
        availableCount,
        averageScore,
        scenarioScores,
        totalAssigned,
      });
    } catch (error) {
      console.error("Error fetching student stats:", error);
      res.status(500).json({ message: "Server error fetching student stats" });
    }
  },
);

router.get(
  "/monthly-activity",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const userRole = req.user.role;
      let schoolId = null;

      if (userRole === "educator") {
        schoolId = req.user.schoolId;
      } else if (userRole === "school_admin") {
        schoolId = req.user.schoolId;
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const sessionMatch = { createdAt: { $gte: sixMonthsAgo } };
      const userMatch = { role: "student" };

      if (schoolId) {
        userMatch.schoolId = schoolId;
      }

      const students = await User.find(userMatch).select("_id");
      const studentIds = students.map((s) => s._id);

      if (schoolId) {
        sessionMatch.student_id = {
          $in: studentIds.map((id) => id.toString()),
        };
      }

      /*
       * One count per month: sessions started. A row exists from the moment a
       * student presses Start (see POST /api/sessions/start — it has to exist
       * before the simulator can call back), so counting rows counts attempts.
       *
       * This used to report that same count under the name `completed` and then
       * invent two more series from it — `active: completed * 0.7` and
       * `inactive: completed * 0.3` — so the chart drew three bars of which two
       * were arithmetic on the first.
       */
      const monthlySessions = await Session.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            started: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const result = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthName = monthNames[date.getMonth()];

        const monthData = monthlySessions.find(
          (m) => m._id.year === year && m._id.month === month,
        );

        // A month with no sessions is still pushed, so the axis always shows six
        // months rather than collapsing to however many had activity.
        result.push({
          name: monthName,
          started: monthData ? monthData.started : 0,
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching monthly activity:", error);
      res
        .status(500)
        .json({ message: "Server error fetching monthly activity" });
    }
  },
);

router.get(
  "/teaching-effectiveness",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const userRole = req.user.role;
      let schoolId = null;
      let educatorId = null;

      if (userRole === "educator") {
        educatorId = req.user._id;
        schoolId = req.user.schoolId;
      } else if (userRole === "school_admin") {
        schoolId = req.user.schoolId;
      }

      const userMatch = { role: "student" };
      if (schoolId) userMatch.schoolId = schoolId;

      const students = await User.find(userMatch).select("_id");
      const studentIds = students.map((s) => s._id);

      const scenarioMatch = {};
      if (schoolId) scenarioMatch.schoolId = schoolId;
      if (educatorId) scenarioMatch.educator = educatorId;

      const scenarios = await Scenario.find(scenarioMatch).select(
        "_id assignedTo assignedGroups",
      ).lean();

      // Group members count as assigned, so the total is taken from the unioned
      // student set rather than the assignedTo array alone.
      const assignedIdsByScenario = await assignedStudentIdsByScenario(scenarios);
      const inScope = new Set(studentIds.map((id) => id.toString()));

      const assignedPairs = new Set();
      scenarios.forEach((scenario) => {
        const scenarioId = scenario._id.toString();
        assignedIdsByScenario.get(scenarioId).forEach((id) => {
          if (inScope.has(id)) assignedPairs.add(`${id}::${scenarioId}`);
        });
      });
      const totalAssigned = assignedPairs.size;

      /*
       * Only sessions on the scenarios in scope. This used to take every session
       * by any student in the school, so an educator's rate — and its
       * engagement trend — counted runs of other educators' scenarios.
       */
      const sessionMatch = {
        scenario_id: { $in: scenarios.map((s) => s._id.toString()) },
        student_id: { $in: [...inScope] },
      };

      const sessions = await Session.find(sessionMatch).select("student_id scenario_id score").lean();

      // An assignment counts as completed once it has at least one session. A
      // session on a scenario the student was never assigned (e.g. assigned and
      // later removed) is not part of the denominator, so it is not counted in
      // the numerator either.
      const completedPairs = new Set();
      sessions.forEach((session) => {
        const pair = `${session.student_id}::${session.scenario_id}`;
        if (assignedPairs.has(pair)) completedPairs.add(pair);
      });
      const totalCompleted = completedPairs.size;

      const completionRate =
        totalAssigned > 0
          ? Math.round((totalCompleted / totalAssigned) * 100)
          : 0;

      const scores = sessions.map((s) => s.score);
      const avgScore =
        scores.length > 0
          ? Math.round(
              (scores.reduce((a, b) => a + b, 0) / scores.length) * 100,
            )
          : 0;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const recentSessions = await Session.countDocuments({
        ...sessionMatch,
        createdAt: { $gte: thirtyDaysAgo },
      });

      const previousSessions = await Session.countDocuments({
        ...sessionMatch,
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      });

      const engagementChange =
        previousSessions > 0
          ? Math.round(
              ((recentSessions - previousSessions) / previousSessions) * 100,
            )
          : recentSessions > 0
            ? 100
            : 0;

      res.json({
        effectiveness: completionRate,
        avgScore,
        engagementChange,
        totalAssigned,
        totalCompleted,
      });
    } catch (error) {
      console.error("Error fetching teaching effectiveness:", error);
      res
        .status(500)
        .json({ message: "Server error fetching teaching effectiveness" });
    }
  },
);


/*
 * The educator dashboard's filters (group, since, scenario), resolved to the students and
 * scenarios the caller may see. Educator: own students and own scenarios. school_admin: school.
 */
// Sessions store scores on 0–1, 0–10 or 0–100 depending on the grader version; same rule as src/lib/utils.js toScorePercent.
const scorePct = (v) => { const n = Number(v); if (!(n > 0)) return 0; return Math.round(n <= 1 ? n * 100 : n <= 10 ? n * 10 : n); };

/*
 * Question text and criterion for a handful of (scenario, number) keys. The grouped queries below
 * only count; carrying the text through every group exceeded Mongo's 100 MB $group limit at scale.
 */
const questionTexts = async (keys) => {
  const out = new Map();
  await Promise.all(keys.map(async ({ scenario, number }) => {
    const doc = await Session.findOne({ scenario_id: scenario, "question_results.number": number })
      .select({ question_results: { $elemMatch: { number } } }).lean();
    const q = doc?.question_results?.[0];
    out.set(`${scenario}:${number}`, { question: q?.question || "", criterion: q?.criterion || null });
  }));
  return out;
};

const scopeCache = new Map();
const dashboardScope = async (req) => {
  const role = req.user.role;
  const who = { role: "student" };
  const scen = {};
  if (role === "educator") { who.supervisor = req.user._id; scen.educator = req.user._id; scen.schoolId = req.user.schoolId; }
  else if (role === "school_admin") { who.schoolId = req.user.schoolId; scen.schoolId = req.user.schoolId; }
  const { groupId, since, scenarioId } = req.query;
  if (groupId && mongoose.Types.ObjectId.isValid(groupId)) who.groupId = groupId;
  if (scenarioId && mongoose.Types.ObjectId.isValid(scenarioId)) scen._id = scenarioId;
  // One dashboard view fires ~10 reads that all need the same two lists: share them for 15 s
  // (per caller and filter) instead of loading them 10 times. Read-only, so nothing goes stale
  // for longer than that.
  const key = `${req.user._id}|${JSON.stringify(who)}|${JSON.stringify(scen)}`;
  const hit = scopeCache.get(key);
  let lists = hit && Date.now() - hit.at < 15000 ? hit.p : null;
  if (!lists) {
    lists = Promise.all([
      User.find(who).select("_id name email groupId").lean(),
      Scenario.find(scen).select("_id scenarioName").lean(),
    ]);
    scopeCache.set(key, { at: Date.now(), p: lists });
    lists.catch(() => scopeCache.delete(key));
    if (scopeCache.size > 500) scopeCache.delete(scopeCache.keys().next().value);
  }
  const [students, scenarios] = await lists;
  const sessionMatch = {
    student_id: { $in: students.map((u) => u._id.toString()) },
    scenario_id: { $in: scenarios.map((x) => x._id.toString()) },
  };
  const days = parseInt(since, 10);
  if (days > 0) sessionMatch.createdAt = { $gte: new Date(Date.now() - days * 86400000) };
  return {
    students: new Map(students.map((u) => [u._id.toString(), u])),
    scenarios: new Map(scenarios.map((x) => [x._id.toString(), x.scenarioName || "Untitled"])),
    sessionMatch,
  };
};

/*
 * Learning overview for the selected cohort (?groupId), all time: who is at target, who is active,
 * progress from first to latest scored session, criteria where learners are below standard, and a
 * per-group summary. Rules live in utils/learning.js and are explained on /definitions.
 */
router.get("/learning-overview", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    const { students, sessionMatch } = await dashboardScope(req);
    delete sessionMatch.createdAt; // progress and status need the whole history
    // Without the checklists (the heavy part); those are rolled up in Mongo below, and only for
    // each learner's latest attempt per scenario, which is all the criteria view uses.
    const rows = await Session.find({ ...sessionMatch, score: { $gt: 0 } })
      .select("student_id scenario_id score createdAt reflection.summary")
      .sort({ createdAt: 1 }).lean();
    const latestIds = [...rows.reduce((m, r) => m.set(`${r.student_id}:${r.scenario_id}`, r._id), new Map()).values()];
    const critRows = latestIds.length ? await Session.aggregate([
      { $match: { _id: { $in: latestIds } } },
      { $project: { student_id: 1, question_results: 1 } },
      { $unwind: "$question_results" },
      { $project: { student_id: 1, c: { $ifNull: ["$question_results.criterion", "General"] }, v: { $ifNull: ["$question_results.review.observed", "$question_results.observed"] } } },
      { $group: { _id: { s: "$student_id", c: "$c" }, met: { $sum: { $switch: { branches: [{ case: { $eq: ["$v", "yes"] }, then: 1 }, { case: { $eq: ["$v", "partly"] }, then: 0.5 }], default: 0 } } }, n: { $sum: 1 } } },
    ]) : [];
    const critBy = new Map();
    for (const r of critRows) {
      const m = critBy.get(r._id.s) || {};
      if (r.n) m[r._id.c] = Math.round((r.met / r.n) * 100);
      critBy.set(r._id.s, m);
    }

    const per = new Map();
    for (const s of rows) {
      const list = per.get(s.student_id) || [];
      list.push(s);
      per.set(s.student_id, list);
    }
    const now = Date.now();
    const learners = [...students.values()].map((u) => {
      const id = u._id.toString();
      const list = per.get(id) || [];
      const first = list[0], last = list[list.length - 1];
      const latest = last ? scorePct(last.score) : null;
      const reflection = [...list].reverse().find((x) => x.reflection?.summary)?.reflection.summary || null;
      return {
        _id: id, name: u.name, email: u.email, groupId: u.groupId ? String(u.groupId) : null,
        sessions: list.length,
        sessions30: list.filter((x) => now - new Date(x.createdAt).getTime() <= 30 * 86400000).length,
        firstScore: first ? scorePct(first.score) : null,
        latestScore: latest,
        gain: list.length >= 2 ? latest - scorePct(first.score) : null,
        atTarget: latest != null && latest >= L.TARGET,
        lastAt: last?.createdAt || null,
        status: L.activity(last?.createdAt, now),
        reflection,
        criteria: critBy.get(id) || {},
      };
    });

    const sumUp = (list) => {
      const gains = list.filter((x) => x.gain != null).map((x) => x.gain);
      const scored = list.filter((x) => x.latestScore != null);
      return {
        learners: list.length,
        started: scored.length,
        atTarget: list.filter((x) => x.atTarget).length,
        active: list.filter((x) => x.status === "active").length,
        atRisk: list.filter((x) => x.status === "atrisk").length,
        inactive: list.filter((x) => x.status === "inactive").length,
        notStarted: list.filter((x) => x.status === "new").length,
        progress: gains.length ? Math.round(gains.reduce((a, b) => a + b, 0) / gains.length) : null,
        progressOf: gains.length,
        avgLatest: scored.length ? Math.round(scored.reduce((a, b) => a + b.latestScore, 0) / scored.length) : null,
        sessions30: list.reduce((a, b) => a + b.sessions30, 0),
      };
    };

    // Criteria: share of learners below standard on their latest attempts.
    const crit = new Map();
    for (const l of learners) {
      for (const [k, v] of Object.entries(l.criteria)) {
        const c = crit.get(k) || { criterion: k, of: 0, below: 0, sum: 0 };
        c.of += 1; c.sum += v; if (v < L.TARGET) c.below += 1;
        crit.set(k, c);
      }
    }
    const criteria = [...crit.values()]
      .map((c) => ({ criterion: c.criterion, of: c.of, below: c.below, share: Math.round((c.below / c.of) * 100), avg: Math.round(c.sum / c.of) }))
      .sort((a, b) => b.share - a.share || a.avg - b.avg);

    // Per group, for the admin's cohort table and the cohort switch.
    const groupIds = [...new Set(learners.map((l) => l.groupId).filter(Boolean))];
    const names = new Map((await Group.find({ _id: { $in: groupIds } }).select("_id name").lean()).map((g) => [String(g._id), g.name]));
    const groups = groupIds.map((g) => ({ _id: g, name: names.get(g) || "Group", ...sumUp(learners.filter((l) => l.groupId === g)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const ungrouped = learners.filter((l) => !l.groupId);
    if (ungrouped.length && groups.length) groups.push({ _id: null, name: "No group", ...sumUp(ungrouped) });

    res.json({
      rules: { target: L.TARGET, activeDays: L.ACTIVE_DAYS, riskDays: L.RISK_DAYS },
      totals: sumUp(learners),
      learners: learners.map(({ criteria: _c, ...rest }) => rest),
      criteria,
      groups,
    });
  } catch (err) {
    console.error("Learning overview error:", err);
    res.status(500).json({ message: "Server error building the learning overview." });
  }
});

/* Latest sessions, newest first, with student and scenario names (dashboard feed, scenario insight). */
router.get("/sessions-feed", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    const { students, scenarios, sessionMatch } = await dashboardScope(req);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const rows = await Session.find(sessionMatch).select("_id student_id scenario_id score createdAt reflection.distress_flag")
      .sort({ createdAt: -1 }).limit(limit).lean();
    res.json(rows.map((x) => ({
      sessionId: x._id,
      studentId: x.student_id,
      studentName: students.get(x.student_id)?.name || "Student",
      scenarioId: x.scenario_id,
      scenarioName: scenarios.get(x.scenario_id) || "Scenario",
      score: x.score > 0 ? scorePct(x.score) : null,
      distress: !!x.reflection?.distress_flag,
      at: x.createdAt,
    })));
  } catch (error) {
    console.error("Error fetching sessions feed:", error);
    res.status(500).json({ message: "Server error fetching sessions" });
  }
});

/*
 * What the educator and school-admin dashboards show about scenarios, and nothing more: counts,
 * the drafts and unassigned ones (first few by name), the newest four, and the ones with sessions
 * (for the score-spread picker). Replaces loading every scenario in full (5000 = several MB).
 */
router.get("/scenario-summary", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    const role = req.user.role;
    const q = {};
    if (role === "educator") q.educator = req.user._id;
    else if (role === "school_admin") q.schoolId = req.user.schoolId;
    else if (role !== "superadmin") return res.status(403).json({ message: "Access denied" });
    const draft = { ...q, $or: [{ status: "Draft" }, { status: { $exists: false } }, { status: null }] };
    const unassigned = { ...q, status: "Published", $and: [{ $or: [{ assignedTo: { $size: 0 } }, { assignedTo: { $exists: false } }] }, { $or: [{ assignedGroups: { $size: 0 } }, { assignedGroups: { $exists: false } }] }] };
    const pick = "_id scenarioName status createdAt";
    const [total, published, draftCount, drafts, unassignedCount, unassignedList, recent, ids] = await Promise.all([
      Scenario.countDocuments(q), Scenario.countDocuments({ ...q, status: "Published" }),
      Scenario.countDocuments(draft), Scenario.find(draft).select(pick).sort({ updatedAt: -1 }).limit(5).lean(),
      Scenario.countDocuments(unassigned), Scenario.find(unassigned).select(pick).sort({ createdAt: -1 }).limit(5).lean(),
      Scenario.find(q).select(pick).sort({ createdAt: -1 }).limit(4).lean(),
      Scenario.find(q).distinct("_id"),
    ]);
    // Scenarios with sessions, most practised first (the score-spread picker), capped.
    const practised = await Session.aggregate([
      { $match: { scenario_id: { $in: ids.map(String) } } },
      { $group: { _id: "$scenario_id", totalSessions: { $sum: 1 } } },
      { $sort: { totalSessions: -1 } }, { $limit: 100 },
    ]);
    const names = new Map((await Scenario.find({ _id: { $in: practised.map((p) => p._id) } }).select("_id scenarioName").lean()).map((x) => [String(x._id), x.scenarioName]));
    res.json({
      total, published,
      drafts: { count: draftCount, items: drafts }, unassigned: { count: unassignedCount, items: unassignedList },
      recent, withSessions: practised.map((p) => ({ _id: p._id, scenarioName: names.get(p._id) || "Scenario", totalSessions: p.totalSessions })),
    });
  } catch (error) {
    console.error("Error fetching scenario summary:", error);
    res.status(500).json({ message: "Server error fetching scenario summary" });
  }
});

/*
 * Everything about how one scenario went, for its analytics page (educator: own scenarios; school
 * admin: the school; superadmin: any). Aggregated in Mongo; no transcripts leave the database.
 */
router.get("/scenario-analytics", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    const { scenarioId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(scenarioId)) return res.status(400).json({ message: "scenarioId required" });
    const role = req.user.role;
    const scen = { _id: scenarioId };
    if (role === "educator") { scen.educator = req.user._id; scen.schoolId = req.user.schoolId; }
    else if (role === "school_admin") scen.schoolId = req.user.schoolId;
    else if (role !== "superadmin") return res.status(403).json({ message: "Access denied" });
    const sc = await Scenario.findOne(scen).select("_id scenarioName patientName description status difficulty createdAt assignedTo assignedGroups schoolId").lean();
    if (!sc) return res.status(404).json({ message: "Scenario not found" });
    const sid = String(sc._id);

    const [rows, questions, crCriteria, assigned] = await Promise.all([
      Session.aggregate([
        { $match: { scenario_id: sid } },
        { $project: { student_id: 1, score: 1, createdAt: 1, self: "$reflection.self_rating", distress: "$reflection.distress_flag",
          cr: "$clinical_reasoning.percent", missedRedFlag: "$clinical_reasoning.missed_red_flag", flag: "$student_flag.reason", turns: { $size: { $ifNull: ["$transcription", []] } } } },
        { $sort: { createdAt: 1 } },
      ]),
      Session.aggregate([
        { $match: { scenario_id: sid } },
        { $unwind: "$question_results" },
        { $project: { n: "$question_results.number", q: "$question_results.question", c: "$question_results.criterion", v: { $ifNull: ["$question_results.review.observed", "$question_results.observed"] } } },
        { $group: { _id: "$n", question: { $first: "$q" }, criterion: { $first: "$c" }, yes: { $sum: { $cond: [{ $eq: ["$v", "yes"] }, 1, 0] } }, partly: { $sum: { $cond: [{ $eq: ["$v", "partly"] }, 1, 0] } }, total: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Session.aggregate([
        { $match: { scenario_id: sid, "clinical_reasoning.criteria.0": { $exists: true } } },
        { $unwind: "$clinical_reasoning.criteria" },
        { $group: { _id: "$clinical_reasoning.criteria.n", name: { $first: "$clinical_reasoning.criteria.name" }, avg: { $avg: "$clinical_reasoning.criteria.final" },
          independent: { $sum: { $cond: [{ $eq: ["$clinical_reasoning.criteria.independence", "independent"] }, 1, 0] } }, n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.countDocuments({ role: "student", $or: [{ _id: { $in: sc.assignedTo || [] } }, ...(sc.assignedGroups?.length ? [{ groupId: { $in: sc.assignedGroups } }] : [])] }),
    ]);

    const pct = (v) => (v > 0 ? scorePct(v) : null);
    const scored = rows.filter((r) => r.score > 0).map((r) => ({ ...r, pct: pct(r.score) }));
    const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    const sorted = scored.map((r) => r.pct).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const byStudent = new Map();
    for (const r of scored) { const l = byStudent.get(r.student_id) || []; l.push(r.pct); byStudent.set(r.student_id, l); }
    const firsts = [...byStudent.values()].map((l) => l[0]);
    const latests = [...byStudent.values()].map((l) => l[l.length - 1]);
    const repeaters = [...byStudent.values()].filter((l) => l.length > 1);
    const target = L.TARGET;

    // Weekly, last 12 weeks: attempts and average score.
    const monday = new Date(); monday.setUTCHours(0, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const weeks = Array.from({ length: 12 }, (_, i) => { const st = new Date(monday); st.setUTCDate(st.getUTCDate() - (11 - i) * 7); return { start: st, attempts: 0, sum: 0, scored: 0 }; });
    for (const r of rows) for (let i = weeks.length - 1; i >= 0; i--) if (r.createdAt >= weeks[i].start) { weeks[i].attempts += 1; if (r.score > 0) { weeks[i].sum += pct(r.score); weeks[i].scored += 1; } break; }

    const bands = ["0–19", "20–39", "40–59", "60–79", "80–100"].map((band) => ({ band, attempts: 0 }));
    scored.forEach((r) => { bands[Math.min(4, Math.floor(r.pct / 20))].attempts += 1; });

    const selfPairs = scored.filter((r) => r.self >= 1);
    const crs = rows.filter((r) => r.cr != null);
    const flags = rows.filter((r) => r.flag).reduce((m, r) => ({ ...m, [r.flag]: (m[r.flag] || 0) + 1 }), {});
    const crit = new Map();
    for (const q of questions) {
      const k = q.criterion || "General";
      const c = crit.get(k) || { criterion: k, met: 0, n: 0 };
      c.met += q.yes + q.partly * 0.5; c.n += q.total; crit.set(k, c);
    }

    res.json({
      scenario: { _id: sc._id, name: sc.scenarioName, patient: sc.patientName, description: sc.description, status: sc.status, difficulty: sc.difficulty, createdAt: sc.createdAt },
      target,
      totals: {
        attempts: rows.length, scored: scored.length, unfinished: rows.length - scored.length,
        students: byStudent.size, assigned, notStarted: Math.max(0, assigned - byStudent.size),
        avg: avg(scored.map((r) => r.pct)), median, atTarget: latests.filter((x) => x >= target).length,
        firstAvg: avg(firsts), latestAvg: avg(latests), repeaters: repeaters.length,
        repeatGain: repeaters.length ? avg(repeaters.map((l) => l[l.length - 1] - l[0])) : null,
        attemptsPerStudent: byStudent.size ? Math.round((scored.length / byStudent.size) * 10) / 10 : null,
        avgTurns: avg(rows.filter((r) => r.turns).map((r) => r.turns)),
        lastAt: rows.length ? rows[rows.length - 1].createdAt : null,
      },
      weeks: weeks.map((w) => ({ start: w.start.toISOString(), attempts: w.attempts, avg: w.scored ? Math.round(w.sum / w.scored) : null })),
      bands,
      criteria: [...crit.values()].map((c) => ({ criterion: c.criterion, pct: c.n ? Math.round((c.met / c.n) * 100) : 0 })).sort((a, b) => a.pct - b.pct),
      questions: questions.map((q) => ({ number: q._id, question: q.question, criterion: q.criterion, metPct: q.total ? Math.round(((q.yes + q.partly * 0.5) / q.total) * 100) : 0, total: q.total }))
        .sort((a, b) => a.metPct - b.metPct),
      reasoning: {
        attempts: crs.length, avg: avg(crs.map((r) => r.cr)), missedRedFlag: rows.filter((r) => r.missedRedFlag).length,
        criteria: crCriteria.map((c) => ({ n: c._id, name: c.name, avg: Math.round(c.avg * 10) / 10, independentPct: c.n ? Math.round((c.independent / c.n) * 100) : 0 })),
      },
      reflection: {
        n: selfPairs.length, selfAvg: avg(selfPairs.map((r) => r.self * 10)), scoreAvg: avg(selfPairs.map((r) => r.pct)),
        over: selfPairs.filter((r) => r.self * 10 - r.pct > 15).length, under: selfPairs.filter((r) => r.pct - r.self * 10 > 15).length,
        distress: rows.filter((r) => r.distress).length,
      },
      flags,
    });
  } catch (error) {
    console.error("Error fetching scenario analytics:", error);
    res.status(500).json({ message: "Server error fetching scenario analytics" });
  }
});

/*
 * Who did what on one scenario: every student it is assigned to (directly or through a class),
 * plus anyone else who tried it, with attempts, best, first and latest score, and last attempt.
 * Scoped like the rest of the dashboard (an educator's own scenarios, a school admin's school).
 */
router.get("/scenario-students", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    const { scenarioId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(scenarioId)) return res.status(400).json({ message: "scenarioId required" });
    const role = req.user.role;
    const scen = { _id: scenarioId };
    if (role === "educator") { scen.educator = req.user._id; scen.schoolId = req.user.schoolId; }
    else if (role === "school_admin") scen.schoolId = req.user.schoolId;
    else if (role !== "superadmin") return res.status(403).json({ message: "Access denied" });
    const scenario = await Scenario.findOne(scen).select("_id schoolId assignedTo assignedGroups").lean();
    if (!scenario) return res.status(404).json({ message: "Scenario not found" });

    const stats = await Session.aggregate([
      { $match: { scenario_id: String(scenario._id) } },
      { $sort: { createdAt: 1 } },
      { $group: { _id: "$student_id", attempts: { $sum: 1 }, best: { $max: "$score" }, first: { $first: "$score" }, latest: { $last: "$score" }, lastAt: { $last: "$createdAt" }, lastId: { $last: "$_id" } } },
    ]);
    const tried = stats.map((x) => x._id).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const or = [{ _id: { $in: [...(scenario.assignedTo || []), ...tried] } }];
    if (scenario.assignedGroups?.length) or.push({ groupId: { $in: scenario.assignedGroups } });
    const people = await User.find({ role: "student", $or: or, ...(role !== "superadmin" && { schoolId: scenario.schoolId }) })
      .select("_id name email groupId").lean();
    const byId = new Map(stats.map((x) => [String(x._id), x]));
    const assigned = new Set((scenario.assignedTo || []).map(String));
    const groups = new Set((scenario.assignedGroups || []).map(String));
    const pct = (v) => (v > 0 ? scorePct(v) : null);
    const rows = people.map((u) => {
      const st = byId.get(String(u._id));
      return {
        studentId: u._id, name: u.name, email: u.email,
        assigned: assigned.has(String(u._id)) || groups.has(String(u.groupId)),
        attempts: st?.attempts || 0, best: pct(st?.best), first: pct(st?.first), latest: pct(st?.latest),
        lastAt: st?.lastAt || null, lastSessionId: st?.lastId || null,
      };
    }).sort((a, b) => (b.lastAt ? new Date(b.lastAt) : 0) - (a.lastAt ? new Date(a.lastAt) : 0) || String(a.name).localeCompare(String(b.name)));
    res.json({ total: rows.length, tried: rows.filter((r) => r.attempts).length, rows });
  } catch (error) {
    console.error("Error fetching scenario students:", error);
    res.status(500).json({ message: "Server error fetching scenario students" });
  }
});

/* Attempts students flagged as wrong (misheard, feedback, technical), newest first, last 60 days. */
router.get("/student-flags", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    const { students, scenarios, sessionMatch } = await dashboardScope(req);
    const rows = await Session.find({ ...sessionMatch, "student_flag.reason": { $exists: true }, "student_flag.at": { $gte: new Date(Date.now() - 60 * 86400000) } })
      .select("_id student_id scenario_id student_flag").sort({ "student_flag.at": -1 }).limit(20).lean();
    res.json(rows.map((x) => ({
      sessionId: x._id, studentId: x.student_id, studentName: students.get(x.student_id)?.name || "Student",
      scenarioName: scenarios.get(x.scenario_id) || "Scenario", reason: x.student_flag.reason, text: x.student_flag.text, at: x.student_flag.at,
    })));
  } catch (error) {
    console.error("Error fetching student flags:", error);
    res.status(500).json({ message: "Server error fetching flags" });
  }
});

/*
 * Per-educator adoption for a school admin (mindsets/school-admin.md): students supervised,
 * scenarios (published), sessions on their scenarios (all time and last 30 days), average score,
 * last session, last sign-in. Plus school-wide active students this week. School-scoped.
 */
router.get("/educators-overview", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    if (!["school_admin", "superadmin"].includes(req.user.role)) return res.status(403).json({ message: "Access denied" });
    const school = req.user.role === "school_admin" ? { schoolId: req.user.schoolId } : {};
    const [educators, students, scenarios] = await Promise.all([
      User.find({ ...school, role: "educator" }).select("_id name email department lastLoginAt createdAt").lean(),
      User.find({ ...school, role: "student" }).select("_id supervisor").lean(),
      Scenario.find(school).select("_id educator status").lean(),
    ]);
    const scenOwner = new Map(scenarios.map((x) => [String(x._id), String(x.educator)]));
    const since30 = new Date(Date.now() - 30 * 86400000);
    const since7 = new Date(Date.now() - 7 * 86400000);
    const sessions = await Session.find({ scenario_id: { $in: [...scenOwner.keys()] } }).select("scenario_id student_id score createdAt").lean();
    const per = new Map(educators.map((e) => [String(e._id), { students: 0, scenarios: 0, published: 0, sessions: 0, sessions30: 0, scoreSum: 0, scored: 0, lastSessionAt: null }]));
    students.forEach((u) => { const p = per.get(String(u.supervisor)); if (p) p.students += 1; });
    scenarios.forEach((x) => { const p = per.get(String(x.educator)); if (p) { p.scenarios += 1; if (x.status === "Published") p.published += 1; } });
    const active7 = new Set();
    sessions.forEach((x) => {
      if (x.createdAt >= since7) active7.add(x.student_id);
      const p = per.get(scenOwner.get(x.scenario_id));
      if (!p) return;
      p.sessions += 1;
      if (x.createdAt >= since30) p.sessions30 += 1;
      const pct = scorePct(x.score);
      if (pct > 0) { p.scoreSum += pct; p.scored += 1; }
      if (!p.lastSessionAt || x.createdAt > p.lastSessionAt) p.lastSessionAt = x.createdAt;
    });
    res.json({
      activeStudents7: active7.size,
      totalStudents: students.length,
      sessions30: sessions.filter((x) => x.createdAt >= since30).length,
      educators: educators.map((e) => {
        const p = per.get(String(e._id));
        return {
          _id: e._id, name: e.name, email: e.email, department: e.department || "", lastLoginAt: e.lastLoginAt || null, createdAt: e.createdAt,
          students: p.students, scenarios: p.scenarios, published: p.published, sessions: p.sessions, sessions30: p.sessions30,
          avgScore: p.scored ? Math.round(p.scoreSum / p.scored) : null, lastSessionAt: p.lastSessionAt,
        };
      }).sort((a, b) => b.sessions30 - a.sessions30 || a.name.localeCompare(b.name)),
    });
  } catch (error) {
    console.error("Error fetching educators overview:", error);
    res.status(500).json({ message: "Server error fetching educators overview" });
  }
});

/*
 * The vendor's view (superadmin only, mindsets/superadmin.md): per school adoption, admin set-up and
 * renewal, platform totals, and sessions per week for 12 weeks. Counts only; no student names.
 */
async function platformOverview() {
    const now = Date.now(), since7 = new Date(now - 7 * 86400000), since30 = new Date(now - 30 * 86400000);
    // 12 calendar months back covers 6 months + the previous 6, and 16 weeks for 8 + previous 8.
    const windowStart = new Date(); windowStart.setUTCDate(1); windowStart.setUTCHours(0, 0, 0, 0); windowStart.setUTCMonth(windowStart.getUTCMonth() - 11);
    const AiUsage = (await import("../models/aiUsageModel.js")).default;
    // All independent reads at once (they used to run one after another).
    const [schools, users, scenarios, admins, sessions, spend] = await Promise.all([
      School.find({}).select("_id schoolName status subscriptionType startDate expireDate assignedAdmin inviteStatus inviteSentAt createdAt").lean(),
      // Counted in Mongo (one row per school and role), not by loading every user.
      User.aggregate([{ $match: { role: { $in: ["student", "educator"] } } }, { $group: { _id: { s: "$schoolId", r: "$role" }, n: { $sum: 1 } } }]),
      Scenario.find({}).select("_id schoolId status").lean(),
      User.find({ role: "school_admin" }).select("_id lastLoginAt").lean(),
      Session.aggregate([{ $match: { createdAt: { $gte: windowStart } } }, { $project: { student_id: 1, scenario_id: 1, createdAt: 1, score: 1, "student_flag.reason": 1, tlen: { $size: { $ifNull: ["$transcription", []] } } } }]),
      AiUsage.aggregate([{ $match: { createdAt: { $gte: since30 } } }, { $group: { _id: "$kind", calls: { $sum: 1 }, cost: { $sum: { $ifNull: ["$costUsd", 0] } }, tokens: { $sum: { $add: ["$promptTokens", "$completionTokens"] } } } }]),
    ]);
    // Did not finish: started over 2 hours ago with no conversation and no score (closed tab, simulator failed to load).
    const unfinished = (x) => x.createdAt < new Date(now - 2 * 3600000) && !x.tlen && !(x.score > 0);
    const scenSchool = new Map(scenarios.map((x) => [String(x._id), String(x.schoolId)]));
    const userById = new Map(admins.map((u) => [String(u._id), u]));
    const per = new Map(schools.map((sc) => [String(sc._id), { students: 0, educators: 0, scenarios: 0, published: 0, sessions30: 0, active7: new Set(), lastSessionAt: null, adminLastLogin: null }]));
    users.forEach(({ _id, n }) => {
      const p = per.get(String(_id.s));
      if (!p) return;
      if (_id.r === "student") p.students += n;
      if (_id.r === "educator") p.educators += n;
    });
    scenarios.forEach((x) => { const p = per.get(String(x.schoolId)); if (p) { p.scenarios += 1; if (x.status === "Published") p.published += 1; } });
    /*
     * Calendar buckets, not "now minus N days": weeks run Monday 00:00 to Sunday (UTC), months are
     * calendar months. Each bucket carries its ISO start so the browser formats it in local time.
     */
    const monday = new Date(); monday.setUTCHours(0, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const weekB = Array.from({ length: 16 }, (_, i) => { const st = new Date(monday); st.setUTCDate(st.getUTCDate() - (15 - i) * 7); return { start: st, sessions: 0, students: new Set() }; });
    const monthB = Array.from({ length: 12 }, (_, i) => { const st = new Date(windowStart); st.setUTCMonth(st.getUTCMonth() + i); return { start: st, sessions: 0, students: new Set() }; });
    const put = (buckets, t, x) => { for (let i = buckets.length - 1; i >= 0; i--) if (t >= buckets[i].start) { buckets[i].sessions += 1; buckets[i].students.add(x.student_id); return; } };
    const technical = new Map();
    const active7 = new Set();
    // A session's school comes from its scenario; only students of sessions whose scenario is
    // gone are looked up (rare), instead of loading every user.
    const orphanStudents = [...new Set(sessions.filter((x) => !scenSchool.has(x.scenario_id)).map((x) => x.student_id))];
    if (orphanStudents.length) {
      const found = await User.find({ _id: { $in: orphanStudents.filter((id) => mongoose.Types.ObjectId.isValid(id)) } }).select("_id schoolId").lean();
      found.forEach((u) => userById.set(String(u._id), u));
    }
    sessions.forEach((x) => {
      put(weekB, x.createdAt, x);
      put(monthB, x.createdAt, x);
      if (x.student_flag?.reason === "technical") { const sid = scenSchool.get(x.scenario_id) || String(userById.get(x.student_id)?.schoolId); technical.set(sid, (technical.get(sid) || 0) + 1); }
      if (x.createdAt >= since7) active7.add(x.student_id);
      const p = per.get(scenSchool.get(x.scenario_id) || String(userById.get(x.student_id)?.schoolId));
      if (!p) return;
      if (x.createdAt >= since30) p.sessions30 += 1;
      if (x.createdAt >= since30 && unfinished(x)) p.unfinished30 = (p.unfinished30 || 0) + 1;
      if (x.createdAt >= since7) p.active7.add(x.student_id);
      if (!p.lastSessionAt || x.createdAt > p.lastSessionAt) p.lastSessionAt = x.createdAt;
    });
    const out = schools.map((sc) => {
      const p = per.get(String(sc._id));
      const admin = sc.assignedAdmin?.id ? userById.get(String(sc.assignedAdmin.id)) : null;
      const daysLeft = sc.expireDate ? Math.ceil((new Date(sc.expireDate).getTime() - now) / 86400000) : null;
      return {
        _id: sc._id, name: sc.schoolName, status: sc.status, plan: sc.subscriptionType, startDate: sc.startDate, expireDate: sc.expireDate, daysLeft,
        admin: sc.assignedAdmin?.id ? { name: sc.assignedAdmin.name, email: sc.assignedAdmin.email, lastLoginAt: admin?.lastLoginAt || null } : null,
        inviteStatus: sc.inviteStatus || null,
        students: p.students, educators: p.educators, scenarios: p.scenarios, published: p.published,
        sessions30: p.sessions30, active7: p.active7.size, lastSessionAt: p.lastSessionAt,
        technicalReports: technical.get(String(sc._id)) || 0,
        unfinished30: p.unfinished30 || 0,
      };
    }).sort((a, b) => b.sessions30 - a.sessions30 || String(a.name).localeCompare(String(b.name)));
    return {
      totals: {
        schools: schools.length, activeSchools: schools.filter((x) => x.status === "Active").length,
        students: users.filter((u) => u._id.r === "student").reduce((a, u) => a + u.n, 0), educators: users.filter((u) => u._id.r === "educator").reduce((a, u) => a + u.n, 0),
        scenarios: scenarios.length, sessions30: sessions.filter((x) => x.createdAt >= since30).length, activeStudents7: active7.size,
        unfinished30: sessions.filter((x) => x.createdAt >= since30 && unfinished(x)).length,
      },
      aiSpend30: spend.map((r) => ({ kind: r._id, calls: r.calls, costUsd: Math.round(r.cost * 10000) / 10000, tokens: r.tokens })),
      // Oldest first. The last bucket is the current, still-running week or month.
      weeks: weekB.map((b) => ({ start: b.start.toISOString(), sessions: b.sessions, students: b.students.size })),
      months: monthB.map((b) => ({ start: b.start.toISOString(), sessions: b.sessions, students: b.students.size })),
      schools: out,
    };
}

router.get("/platform-overview", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    if (req.user.role !== "superadmin") return res.status(403).json({ message: "Access denied" });
    res.json(await platformOverview());
  } catch (error) {
    console.error("Error fetching platform overview:", error);
    res.status(500).json({ message: "Server error fetching platform overview" });
  }
});

/*
 * The same overview, streamed (NDJSON): a line with the headline counts as soon as they are known
 * (cheap counts), then the full overview. The dashboard reads it with TanStack Query's
 * streamedQuery and merges the lines, so the numbers show before the per-school table is ready.
 */
router.get("/platform-overview/stream", protect, checkAccess("viewDashboard"), async (req, res) => {
  if (req.user.role !== "superadmin") return res.status(403).json({ message: "Access denied" });
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  const send = (o) => res.write(`${JSON.stringify(o)}\n`);
  try {
    const full = platformOverview();
    const since30 = new Date(Date.now() - 30 * 86400000);
    const [schools, activeSchools, students, educators, scenarios, sessions30] = await Promise.all([
      School.estimatedDocumentCount(), School.countDocuments({ status: "Active" }),
      User.countDocuments({ role: "student" }), User.countDocuments({ role: "educator" }),
      Scenario.estimatedDocumentCount(), Session.countDocuments({ createdAt: { $gte: since30 } }),
    ]);
    send({ part: "totals", totals: { schools, activeSchools, students, educators, scenarios, sessions30 } });
    send({ part: "full", ...(await full) });
  } catch (error) {
    console.error("Error streaming platform overview:", error);
    send({ part: "error", message: "Server error fetching platform overview" });
  }
  res.end();
});

/*
 * One school, for the superadmin's school page: profile, admin, notes, educators with adoption,
 * scenarios by status, 8-week and 6-month usage, and health (did not finish, technical reports).
 */
router.get("/school/:id", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    if (req.user.role !== "superadmin") return res.status(403).json({ message: "Access denied" });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "School not found" });
    const school = await School.findById(req.params.id).select("+notes").lean();
    if (!school) return res.status(404).json({ message: "School not found" });
    const sid = school._id;
    const [educators, students, scenarios] = await Promise.all([
      User.find({ schoolId: sid, role: "educator" }).select("_id name email lastLoginAt").lean(),
      User.find({ schoolId: sid, role: "student" }).select("_id supervisor lastLoginAt").lean(),
      Scenario.find({ schoolId: sid }).select("_id educator status scenarioName").lean(),
    ]);
    const admin = school.assignedAdmin?.id ? await User.findById(school.assignedAdmin.id).select("name email lastLoginAt").lean() : null;
    const scenIds = scenarios.map((x) => String(x._id));
    const now = Date.now(), since7 = new Date(now - 7 * 86400000), since30 = new Date(now - 30 * 86400000);
    const monday = new Date(); monday.setUTCHours(0, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const m0 = new Date(); m0.setUTCDate(1); m0.setUTCHours(0, 0, 0, 0); m0.setUTCMonth(m0.getUTCMonth() - 11);
    const sessions = await Session.aggregate([{ $match: { scenario_id: { $in: scenIds }, createdAt: { $gte: m0 } } }, { $project: { student_id: 1, scenario_id: 1, createdAt: 1, score: 1, "student_flag.reason": 1, tlen: { $size: { $ifNull: ["$transcription", []] } } } }]);
    const weeks = Array.from({ length: 16 }, (_, i) => { const st = new Date(monday); st.setUTCDate(st.getUTCDate() - (15 - i) * 7); return { start: st, sessions: 0, students: new Set() }; });
    const months = Array.from({ length: 12 }, (_, i) => { const st = new Date(m0); st.setUTCMonth(st.getUTCMonth() + i); return { start: st, sessions: 0, students: new Set() }; });
    const put = (b, x) => { for (let i = b.length - 1; i >= 0; i--) if (x.createdAt >= b[i].start) { b[i].sessions += 1; b[i].students.add(x.student_id); return; } };
    const owner = new Map(scenarios.map((x) => [String(x._id), String(x.educator)]));
    const ed = new Map(educators.map((e) => [String(e._id), { sessions30: 0, scenarios: 0, students: 0, lastSessionAt: null }]));
    scenarios.forEach((x) => { const p = ed.get(String(x.educator)); if (p) p.scenarios += 1; });
    students.forEach((u) => { const p = ed.get(String(u.supervisor)); if (p) p.students += 1; });
    let unfinished30 = 0, technical30 = 0;
    const active7 = new Set();
    sessions.forEach((x) => {
      put(weeks, x); put(months, x);
      if (x.createdAt >= since7) active7.add(x.student_id);
      const p = ed.get(owner.get(x.scenario_id));
      if (x.createdAt >= since30) {
        if (x.createdAt < new Date(now - 2 * 3600000) && !x.tlen && !(x.score > 0)) unfinished30 += 1;
        if (x.student_flag?.reason === "technical") technical30 += 1;
        if (p) p.sessions30 += 1;
      }
      if (p && (!p.lastSessionAt || x.createdAt > p.lastSessionAt)) p.lastSessionAt = x.createdAt;
    });
    const bucket = (b) => b.map((x) => ({ start: x.start.toISOString(), sessions: x.sessions, students: x.students.size }));
    res.json({
      school: {
        _id: sid, name: school.schoolName, description: school.description || "", email: school.email || "", status: school.status,
        plan: school.subscriptionType, duration: school.duration, startDate: school.startDate, expireDate: school.expireDate,
        daysLeft: school.expireDate ? Math.ceil((new Date(school.expireDate).getTime() - now) / 86400000) : null,
        inviteStatus: school.inviteStatus || null, inviteSentAt: school.inviteSentAt || null,
      },
      admin: admin ? { name: admin.name, email: admin.email, lastLoginAt: admin.lastLoginAt || null } : null,
      notes: (school.notes || []).map((n) => ({ _id: n._id, text: n.text, authorName: n.authorName, createdAt: n.createdAt, mine: String(n.author) === String(req.user._id) })),
      totals: {
        students: students.length, studentsSignedIn: students.filter((u) => u.lastLoginAt).length, educators: educators.length,
        scenarios: scenarios.length, published: scenarios.filter((x) => x.status === "Published").length,
        sessions30: sessions.filter((x) => x.createdAt >= since30).length, activeStudents7: active7.size, unfinished30, technical30,
      },
      weeks: bucket(weeks), months: bucket(months),
      educators: educators.map((e) => ({ _id: e._id, name: e.name, email: e.email, lastLoginAt: e.lastLoginAt || null, ...ed.get(String(e._id)) }))
        .sort((a, b) => b.sessions30 - a.sessions30),
    });
  } catch (error) {
    console.error("Error fetching school detail:", error);
    res.status(500).json({ message: "Server error fetching the school" });
  }
});

/*
 * Calibration: where educators disagree with the AI grader. Per grading question, how many graded
 * answers an educator reviewed, how many they changed, and which way (AI too harsh / too lenient).
 * The research says educators need this before they trust AI scores (mindsets/educator.md M3, M5).
 */
router.get("/calibration", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    if (!["educator", "school_admin", "superadmin"].includes(req.user.role)) return res.status(403).json({ message: "Access denied" });
    const { scenarios, sessionMatch } = await dashboardScope(req);
    const LEVELS = ["no", "partly", "yes"];
    const ai = "$question_results.observed", ed = "$question_results.review.observed";
    const changedExpr = { $and: [{ $ne: [{ $ifNull: [ed, null] }, null] }, { $ne: [ed, ai] }] };
    const rows = await Session.aggregate([
      { $match: { ...sessionMatch, "question_results.0": { $exists: true } } },
      { $match: { "question_results.review.observed": { $exists: true } } },
      { $unwind: "$question_results" },
      // Only reviewed answers are grouped (few), so the group stays small at any scale.
      { $match: { "question_results.review.observed": { $exists: true } } },
      {
        // Counts only (no per-pair arrays): a "harsh" change is the educator rating higher than the AI.
        $group: {
          _id: { scenario: "$scenario_id", number: "$question_results.number" },
          reviewed: { $sum: { $cond: [{ $ifNull: [ed, false] }, 1, 0] } },
          changed: { $sum: { $cond: [changedExpr, 1, 0] } },
          harsh: { $sum: { $cond: [{ $and: [changedExpr, { $gt: [{ $indexOfArray: [LEVELS, ed] }, { $indexOfArray: [LEVELS, ai] }] }] }, 1, 0] } },
        },
      },
      { $match: { reviewed: { $gt: 0 } } },
      { $addFields: { changeRate: { $round: [{ $multiply: [{ $divide: ["$changed", "$reviewed"] }, 100] }, 0] } } },
      { $sort: { changed: -1, changeRate: -1 } },
      { $limit: Math.min(50, parseInt(req.query.limit, 10) || 12) },
    ]);
    const texts = await questionTexts(rows.map((r) => r._id));
    // How often each listed question was graded at all (reviewed or not), for these few rows only.
    const gradedOf = new Map(await Promise.all(rows.map(async (r) => [`${r._id.scenario}:${r._id.number}`,
      await Session.countDocuments({ ...sessionMatch, scenario_id: r._id.scenario, "question_results.number": r._id.number })])));
    const out = rows.map((r) => {
      const t = texts.get(`${r._id.scenario}:${r._id.number}`) || {};
      return {
        scenarioId: r._id.scenario, scenarioName: scenarios.get(r._id.scenario) || "Scenario", number: r._id.number,
        question: t.question, criterion: t.criterion, graded: gradedOf.get(`${r._id.scenario}:${r._id.number}`) || r.reviewed, reviewed: r.reviewed,
        changed: r.changed, harsh: r.harsh, lenient: r.changed - r.harsh, changeRate: r.changeRate,
      };
    });
    const totals = out.reduce((t, r) => ({ reviewed: t.reviewed + r.reviewed, changed: t.changed + r.changed }), { reviewed: 0, changed: 0 });
    res.json({ totals: { ...totals, agreement: totals.reviewed ? Math.round(((totals.reviewed - totals.changed) / totals.reviewed) * 100) : null }, questions: out });
  } catch (error) {
    console.error("Error fetching calibration:", error);
    res.status(500).json({ message: "Server error fetching calibration" });
  }
});

/* Score spread: how many sessions fall in each 20-point band, per scenario and overall. */
router.get("/score-spread", protect, checkAccess("viewDashboard"), async (req, res) => {
  try {
    const { scenarios, sessionMatch } = await dashboardScope(req);
    const rows = await Session.find({ ...sessionMatch, score: { $gt: 0 } }).select("scenario_id score").lean();
    const rated = await Session.find({ ...sessionMatch, student_rating: { $gte: 1 } }).select("student_rating").lean();
    const bands = ["0–19", "20–39", "40–59", "60–79", "80–100"];
    const empty = () => bands.map((band) => ({ band, sessions: 0 }));
    const overall = empty();
    const per = new Map();
    rows.forEach((x) => {
      const pct = scorePct(x.score);
      const i = Math.min(4, Math.floor(pct / 20));
      overall[i].sessions += 1;
      if (!per.has(x.scenario_id)) per.set(x.scenario_id, empty());
      per.get(x.scenario_id)[i].sessions += 1;
    });
    res.json({
      overall,
      total: rows.length,
      // Students' "how realistic was the patient" (1-5), for the case's quality.
      realism: rated.length ? { avg: Math.round((rated.reduce((t, r) => t + r.student_rating, 0) / rated.length) * 10) / 10, n: rated.length } : null,
      // ?compact=1 (the dashboards): the chart only, without the per-scenario bands.
      ...(req.query.compact ? {} : { byScenario: [...per.entries()].map(([id, b]) => ({ scenarioId: id, scenarioName: scenarios.get(id), bands: b })) }),
    });
  } catch (error) {
    console.error("Error fetching score spread:", error);
    res.status(500).json({ message: "Server error fetching score spread" });
  }
});

/*
 * What the cohort keeps missing (mindsets/educator.md, M6): per grading question, how often
 * sessions on the caller's scenarios got "no" or "partly", worst first. Group-level on purpose:
 * no student names, so it can be shown to a class. ?scenarioId narrows to one scenario.
 */
router.get(
  "/question-misses",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const { scenarios: names, sessionMatch } = await dashboardScope(req);
      const minSessions = Math.max(1, parseInt(req.query.min, 10) || 2);

      // In batches of scenarios: one $group over every question on the platform exceeds Mongo's
      // memory limit at scale. A question belongs to one scenario, so merging each batch's top rows
      // gives exactly the overall top rows.
      const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
      const allIds = sessionMatch.scenario_id.$in;
      let rows = [];
      for (let i = 0; i < allIds.length; i += 2000) {
        const ids = allIds.slice(i, i + 2000);
          const part = await Session.aggregate([
          { $match: { ...sessionMatch, scenario_id: { $in: ids }, "question_results.0": { $exists: true } } },
          { $unwind: "$question_results" },
          {
            $group: {
              _id: { scenario: "$scenario_id", number: "$question_results.number" },
              n: { $sum: 1 },
              // The educator's correction wins over the grader where there is one.
              no: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$question_results.review.observed", "$question_results.observed"] }, "no"] }, 1, 0] } },
              partly: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$question_results.review.observed", "$question_results.observed"] }, "partly"] }, 1, 0] } },
            },
          },
          { $match: { n: { $gte: minSessions } } },
          { $addFields: { missRate: { $divide: [{ $add: ["$no", { $multiply: ["$partly", 0.5] }] }, "$n"] } } },
          { $sort: { missRate: -1, n: -1 } },
          { $limit: Math.min(50, parseInt(req.query.limit, 10) || 10) },
        ]);
        rows = rows.concat(part);
      }
      rows = rows.sort((x, y) => y.missRate - x.missRate || y.n - x.n).slice(0, limit);
      const texts = await questionTexts(rows.map((r) => r._id));
      res.json(rows.map((r) => ({
        scenarioId: r._id.scenario,
        scenarioName: names.get(r._id.scenario),
        number: r._id.number,
        question: texts.get(`${r._id.scenario}:${r._id.number}`)?.question,
        criterion: texts.get(`${r._id.scenario}:${r._id.number}`)?.criterion,
        sessions: r.n,
        no: r.no,
        partly: r.partly,
        missRate: Math.round(r.missRate * 100),
      })));
    } catch (error) {
      console.error("Error fetching question misses:", error);
      res.status(500).json({ message: "Server error fetching question misses" });
    }
  },
);

/*
 * Sessions where the learner showed distress during self-reflection, last 30 days (M11).
 * Educator: their own students; school_admin: their school. Newest first.
 */
router.get(
  "/distress",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const who = { role: "student" };
      if (req.user.role === "educator") who.supervisor = req.user._id;
      else if (req.user.role === "school_admin") who.schoolId = req.user.schoolId;
      const students = await User.find(who).select("_id name email").lean();
      const byId = new Map(students.map((u) => [u._id.toString(), u]));
      const since = new Date(Date.now() - 30 * 86400000);
      const sessions = await Session.find({
        student_id: { $in: [...byId.keys()] },
        "reflection.distress_flag": true,
        createdAt: { $gte: since },
      }).select("_id student_id scenario_id createdAt reflection.status").sort({ createdAt: -1 }).limit(20).lean();
      const scen = await Scenario.find({ _id: { $in: [...new Set(sessions.map((x) => x.scenario_id))] } }).select("_id scenarioName").lean();
      const names = new Map(scen.map((x) => [x._id.toString(), x.scenarioName]));
      res.json(sessions.map((x) => ({
        sessionId: x._id,
        studentId: x.student_id,
        studentName: byId.get(x.student_id)?.name || "Student",
        studentEmail: byId.get(x.student_id)?.email || "",
        scenarioName: names.get(x.scenario_id) || "Scenario",
        at: x.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching distress flags:", error);
      res.status(500).json({ message: "Server error fetching distress flags" });
    }
  },
);

router.get(
  "/scenario-popularity",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const userRole = req.user.role;
      let schoolId = null;
      let educatorId = null;

      if (userRole === "educator") {
        educatorId = req.user._id;
        schoolId = req.user.schoolId;
      } else if (userRole === "school_admin") {
        schoolId = req.user.schoolId;
      }

      const scenarioMatch = {};
      if (schoolId) scenarioMatch.schoolId = schoolId;
      if (educatorId) scenarioMatch.educator = educatorId;

      const scenarios = await Scenario.find(scenarioMatch).select(
        "_id scenarioName assignedTo assignedGroups",
      ).lean();
      const assignedIdsByScenario = await assignedStudentIdsByScenario(scenarios);

      const scenarioIds = scenarios.map((s) => s._id);

      const sessionCounts = await Session.aggregate([
        {
          $match: {
            scenario_id: { $in: scenarioIds.map((id) => id.toString()) },
          },
        },
        { $group: { _id: "$scenario_id", sessionCount: { $sum: 1 } } },
      ]);

      const colors = [
        "#6b7280",
        "#d97706",
        "#a16207",
        "#e5e7eb",
        "#8b5cf6",
        "#ec4899",
        "#14b8a6",
        "#f59e0b",
      ];
      const countById = new Map(sessionCounts.map((s) => [s._id, s.sessionCount]));
      const result = scenarios.map((scenario, index) => {
        const sessionCount = countById.get(scenario._id.toString()) || 0;
        const assignmentCount =
          assignedIdsByScenario.get(scenario._id.toString())?.size || 0;
        const total = sessionCount + assignmentCount;

        return {
          name: scenario.scenarioName || "Untitled Scenario",
          value: total,
          sessionCount,
          assignmentCount,
          color: colors[index % colors.length],
        };
      });

      result.sort((a, b) => b.value - a.value);

      const limit = parseInt(req.query.limit, 10);
      res.json(limit > 0 ? result.slice(0, limit) : result);
    } catch (error) {
      console.error("Error fetching scenario popularity:", error);
      res
        .status(500)
        .json({ message: "Server error fetching scenario popularity" });
    }
  },
);

router.get(
  "/educator-stats",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const educatorId = req.user._id;
      const schoolId = req.user.schoolId;

      // Find students via their school (supervisor may not be populated for all)
      const students = await User.find({
        role: "student",
        schoolId: schoolId,
      }).select("_id");

      const studentIds = students.map((s) => s._id);
      const totalStudents = students.length;

      const [totalScenarios, activeScenariosCount] = await Promise.all([
        Scenario.countDocuments({ educator: educatorId }),
        Scenario.countDocuments({ educator: educatorId, status: "Published" }),
      ]);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const currentMonthStudents = await User.countDocuments({
        role: "student",
        schoolId: schoolId,
        createdAt: { $gte: startOfMonth },
      });

      const lastMonthStudents = await User.countDocuments({
        role: "student",
        schoolId: schoolId,
        createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth },
      });

      const studentGrowth =
        lastMonthStudents > 0
          ? Math.round(
              ((currentMonthStudents - lastMonthStudents) / lastMonthStudents) *
                100,
            )
          : currentMonthStudents > 0
            ? 100
            : 0;

      const currentMonthScenarios = await Scenario.countDocuments({
        educator: educatorId,
        createdAt: { $gte: startOfMonth },
      });

      const lastMonthScenarios = await Scenario.countDocuments({
        educator: educatorId,
        createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth },
      });

      const scenarioGrowth =
        lastMonthScenarios > 0
          ? currentMonthScenarios - lastMonthScenarios
          : currentMonthScenarios;

      let avgProgress = 0;
      let avgTimeSpent = 0;
      let avgProgressChange = 0;

      if (studentIds.length > 0) {
        const sessions = await Session.find({
          student_id: { $in: studentIds.map((id) => id.toString()) },
        }).select("score createdAt").lean();

        if (sessions.length > 0) {
          avgTimeSpent = Math.round(((sessions.length * 5) / 60) * 10) / 10;

          const recentSessions = sessions.filter(
            (s) => s.createdAt >= startOfMonth,
          );
          const prevSessions = sessions.filter(
            (s) =>
              s.createdAt >= startOfLastMonth && s.createdAt < startOfMonth,
          );

          // Scoped to this month so the headline matches its own
          // "vs last month" delta below, instead of mixing an all-time
          // average with a month-over-month change.
          const progressSessions =
            recentSessions.length > 0 ? recentSessions : sessions;
          avgProgress = Math.round(
            (progressSessions.reduce((sum, s) => sum + s.score, 0) /
              progressSessions.length) *
              100,
          );

          if (prevSessions.length > 0 && recentSessions.length > 0) {
            const recentAvg =
              recentSessions.reduce((sum, s) => sum + s.score, 0) /
              recentSessions.length;
            const prevAvg =
              prevSessions.reduce((sum, s) => sum + s.score, 0) /
              prevSessions.length;
            avgProgressChange = Math.round(
              ((recentAvg - prevAvg) / prevAvg) * 100,
            );
          }
        }
      }

      res.json({
        totalStudents,
        studentGrowth,
        totalScenarios,
        scenarioGrowth,
        activeScenariosCount,
        avgProgress,
        avgProgressChange,
        avgTimeSpent,
      });
    } catch (error) {
      console.error("Error fetching educator stats:", error);
      res.status(500).json({ message: "Server error fetching educator stats" });
    }
  },
);

router.get(
  "/school-admin-stats",
  protect,
  checkAccess("viewDashboard"),
  async (req, res) => {
    try {
      const schoolId = req.user.schoolId;

      const students = await User.find({
        role: "student",
        schoolId: schoolId,
      }).select("_id createdAt");
      const studentIds = students.map((s) => s._id);

      const educators = await User.find({
        role: "educator",
        schoolId: schoolId,
      }).select("_id createdAt");

      const scenarios = await Scenario.find({ schoolId: schoolId }).select(
        "createdAt",
      );

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const chartData = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthName = monthNames[month];

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);

        const monthStudents = students.filter(
          (s) => s.createdAt >= startOfMonth && s.createdAt <= endOfMonth,
        ).length;

        const monthEducators = educators.filter(
          (e) => e.createdAt >= startOfMonth && e.createdAt <= endOfMonth,
        ).length;

        const monthScenarios = scenarios.filter(
          (s) => s.createdAt >= startOfMonth && s.createdAt <= endOfMonth,
        ).length;

        chartData.push({
          name: monthName,
          students: monthStudents,
          educators: monthEducators,
          scenarios: monthScenarios,
        });
      }

      res.json({
        totalStudents: students.length,
        totalEducators: educators.length,
        totalScenarios: scenarios.length,
        chartData,
      });
    } catch (error) {
      console.error("Error fetching school admin stats:", error);
      res
        .status(500)
        .json({ message: "Server error fetching school admin stats" });
    }
  },
);

export default router;
