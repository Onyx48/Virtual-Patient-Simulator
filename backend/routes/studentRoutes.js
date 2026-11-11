// WHOLE_PROJECT/routes/studentRoutes.js
import express from "express";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import redisClient from "../utils/redisClient.js";
import {
  assignedStudentIdsByScenario,
  assignedScenarioCountStages,
} from "../utils/scenarioAssignment.js";
import { parsePagination, pageResponse, escapeRegex } from "../utils/pagination.js";
import {
  studentsCacheKey,
  invalidateStudentsCache,
} from "../utils/studentsCache.js";
import { inviteStatusOf } from "../utils/inviteStatus.js";
import { sendEducatorMessage, assertMailConfigured } from "../utils/emailService.js";

const router = express.Router();
const STUDENTS_CACHE_TTL = 120;

const isRedisReady = () => redisClient && redisClient.status === "ready";

router.post("/", protect, checkAccess("manageStudents"), async (req, res) => {
  const { name, email, password } = req.body;

  console.log(
    "POST /api/students - User ID:",
    req.user?._id,
    "Role:",
    req.user?.role,
  );

  if (
    !req.user ||
    !req.user._id ||
    !mongoose.Types.ObjectId.isValid(req.user._id)
  ) {
    console.error("Invalid user ID for supervisor:", req.user?._id);
    return res
      .status(400)
      .json({ message: "Invalid user authentication for student creation" });
  }

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email, and password are required" });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: "student",
      schoolId: req.user.schoolId,
      supervisor: new mongoose.Types.ObjectId(req.user._id),
    });
    await user.save();
    await invalidateStudentsCache(req.scope);

    res.status(201).json(user);
  } catch (err) {
    console.error("Error in POST:", err);
    res.status(500).json({ message: err.message });
  }
});

// Column keys StudentPage sorts by -> fields computed in the pipeline below.
// visualId is the tail of _id, so _id is the closest stable order for it.
const STUDENT_SORT_FIELDS = {
  visualId: "_id",
  name: "name",
  email: "email",
  schoolName: "_schoolName",
  groupName: "_groupName",
  totalSessions: "totalSessions",
  assignedScenariosCount: "assignedScenariosCount",
  inviteStatus: "inviteStatus",
  lastSessionAt: "lastSessionAt",
};

/*
 * One page of the roster. The Progress and Scenarios columns are derived
 * (sessions, assignments), and the table filters and sorts on them, so they are
 * computed in the pipeline before the page is cut; only the page's documents
 * leave the database. Not cached: the key space per page/sort/filter is too
 * large for the two-minute cache to pay off.
 */
const sendStudentPage = async (req, res, paging) => {
  const match = { role: "student" };
  if (req.scope.educatorId) match.supervisor = req.scope.educatorId;
  else if (req.scope.schoolId) match.schoolId = req.scope.schoolId;

  const { searchTerm, assigned, progress, groupId } = req.query;
  if (groupId === "none") match.groupId = null;
  else if (groupId && mongoose.Types.ObjectId.isValid(groupId)) match.groupId = new mongoose.Types.ObjectId(groupId);
  if (searchTerm) {
    const rx = new RegExp(escapeRegex(searchTerm), "i");
    match.$or = [{ name: rx }, { email: rx }];
  }

  const filters = {};
  if (assigned === "assigned") filters.assignedScenariosCount = { $gt: 0 };
  if (assigned === "unassigned") filters.assignedScenariosCount = 0;
  if (progress === "active") filters.totalSessions = { $gt: 0 };
  if (progress === "inactive") filters.totalSessions = 0;
  // Assigned something but never practised: the students an educator chases first.
  if (progress === "notstarted") {
    filters.totalSessions = 0;
    filters.assignedScenariosCount = { $gt: 0 };
  }

  // Per-student stats: session counts and scores (indexed on sessions.student_id).
  const statsStages = [
    ...assignedScenarioCountStages(),
    { $addFields: { _sid: { $toString: "$_id" } } },
    {
      $lookup: {
        from: "sessions",
        localField: "_sid",
        foreignField: "student_id",
        pipeline: [{ $group: { _id: null, best: { $max: "$score" }, avg: { $avg: "$score" }, n: { $sum: 1 }, last: { $max: "$createdAt" } } }],
        as: "_stats",
      },
    },
    { $addFields: { _stats: { $first: "$_stats" } } },
    {
      $addFields: {
        totalSessions: { $ifNull: ["$_stats.n", 0] },
        bestScore: { $ifNull: ["$_stats.best", null] },
        avgScore: { $ifNull: ["$_stats.avg", null] },
        lastSessionAt: { $ifNull: ["$_stats.last", null] },
      },
    },
  ];
  // Must agree with inviteStatusOf in utils/inviteStatus.js.
  const inviteStage = {
    $addFields: {
      inviteStatus: {
        $cond: [
          { $ifNull: ["$lastLoginAt", false] },
          "active",
          { $cond: [{ $ifNull: ["$credentialsSentAt", false] }, "invited", "pending"] },
        ],
      },
    },
  };
  const namesStages = [
    { $lookup: { from: "schools", localField: "schoolId", foreignField: "_id", as: "_school" } },
    { $lookup: { from: "groups", localField: "groupId", foreignField: "_id", as: "_group" } },
    {
      $addFields: {
        schoolId: {
          $let: {
            vars: { s: { $first: "$_school" } },
            in: { $cond: ["$$s", { _id: "$$s._id", schoolName: "$$s.schoolName" }, null] },
          },
        },
        groupId: {
          $let: {
            vars: { g: { $first: "$_group" } },
            in: { $cond: ["$$g", { _id: "$$g._id", name: "$$g.name" }, null] },
          },
        },
        _schoolName: { $toLower: { $ifNull: [{ $first: "$_school.schoolName" }, ""] } },
        _groupName: { $toLower: { $ifNull: [{ $first: "$_group.name" }, ""] } },
      },
    },
  ];
  const hide = { $project: { password: 0, _stats: 0, _sid: 0, _school: 0, _group: 0, _schoolName: 0, _groupName: 0 } };

  /*
   * When neither the filters nor the sort depend on the stats, pick the page first and compute
   * the stats for those rows only. Otherwise every matching student needs them before sorting.
   * Either way the result is the same; this only changes how much work it takes.
   */
  const STAT_KEYS = ["totalSessions", "assignedScenariosCount", "lastSessionAt"];
  const NAME_KEYS = ["_schoolName", "_groupName"];
  const sortKeys = Object.keys(paging.sort);
  const needsStatsFirst = Object.keys(filters).length > 0 || sortKeys.some((k) => STAT_KEYS.includes(k));
  const needsNamesFirst = sortKeys.some((k) => NAME_KEYS.includes(k));

  const [result] = needsStatsFirst
    ? await User.aggregate([
        { $match: match },
        ...statsStages,
        inviteStage,
        { $match: filters },
        ...namesStages,
        { $facet: { items: [{ $sort: paging.sort }, { $skip: paging.skip }, { $limit: paging.limit }, hide], total: [{ $count: "n" }] } },
      ])
    : await User.aggregate([
        { $match: match },
        inviteStage,
        {
          $facet: {
            items: [
              ...(needsNamesFirst ? namesStages : []),
              { $sort: paging.sort },
              { $skip: paging.skip },
              { $limit: paging.limit },
              ...(needsNamesFirst ? [] : namesStages),
              ...statsStages,
              hide,
            ],
            total: [{ $count: "n" }],
          },
        },
      ]);

  res.json(pageResponse(result.items, result.total[0]?.n || 0, paging));
};

router.get("/", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    const paging = parsePagination(req.query, STUDENT_SORT_FIELDS, { name: 1 });
    if (paging) return await sendStudentPage(req, res, paging);

    const cacheKey = studentsCacheKey(req.scope);

    if (isRedisReady()) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    let students = [];
    const Scenario = (await import("../models/scenarioModel.js")).default;
    const Session = (await import("../models/sessionModel.js")).default;

    if (req.scope.educatorId) {
      students = await User.find({
        role: "student",
        supervisor: req.scope.educatorId,
      })
        // Without this the bcrypt hash is spread into the response by
        // `...student.toObject()` below.
        .select("-password")
        .populate("schoolId", "schoolName")
        .populate("groupId", "name");
    } else if (req.scope.schoolId) {
      students = await User.find({
        role: "student",
        schoolId: req.scope.schoolId,
      })
        .select("-password")
        .populate("schoolId", "schoolName")
        .populate("groupId", "name");
    } else {
      students = await User.find({ role: "student" })
        .select("-password")
        .populate("schoolId", "schoolName")
        .populate("groupId", "name");
    }

    if (students.length === 0) {
      return res.json(students);
    }

    const studentIds = students.map((s) => s._id);

    /*
     * Assigned-scenario count per student. Computed in JS rather than with an
     * $unwind aggregate, because a scenario can reach a student through their
     * group as well as through assignedTo, and the count must not double up when
     * both apply.
     */
    const studentGroupIds = [
      ...new Set(
        students
          .map((s) => (s.groupId?._id || s.groupId)?.toString())
          .filter(Boolean),
      ),
    ];

    const relevantScenarios = await Scenario.find({
      $or: [
        { assignedTo: { $in: studentIds } },
        { assignedGroups: { $in: studentGroupIds } },
      ],
    })
      .select("_id assignedTo assignedGroups")
      .lean();

    const assignedIdsByScenario =
      await assignedStudentIdsByScenario(relevantScenarios);

    const scenarioCountByStudent = new Map();
    assignedIdsByScenario.forEach((ids) => {
      ids.forEach((id) => {
        scenarioCountByStudent.set(id, (scenarioCountByStudent.get(id) || 0) + 1);
      });
    });

    const sessionStats = await Session.aggregate([
      {
        $match: { student_id: { $in: studentIds.map((id) => id.toString()) } },
      },
      {
        $group: {
          _id: "$student_id",
          bestScore: { $max: "$score" },
          avgScore: { $avg: "$score" },
          totalSessions: { $sum: 1 },
          lastSessionAt: { $max: "$createdAt" },
        },
      },
    ]);

    // A Map, not sessionStats.find() per student: that was quadratic and froze the server at scale.
    const statById = new Map(sessionStats.map((s) => [s._id, s]));
    const studentsWithStats = students.map((student) => {
      const sessionStat = statById.get(student._id.toString());
      return {
        ...student.toObject(),
        assignedScenariosCount:
          scenarioCountByStudent.get(student._id.toString()) || 0,
        bestScore: sessionStat?.bestScore || null,
        avgScore: sessionStat?.avgScore || null,
        totalSessions: sessionStat?.totalSessions || 0,
        lastSessionAt: sessionStat?.lastSessionAt || null,
        groupId: student.groupId || null,
        // Derived server-side so the roster and any other consumer cannot
        // disagree about what counts as invited — see utils/inviteStatus.js.
        inviteStatus: inviteStatusOf(student),
      };
    });

    if (isRedisReady()) {
      redisClient
        .set(cacheKey, JSON.stringify(studentsWithStats), "EX", STUDENTS_CACHE_TTL)
        .catch(() => {});
    }

    res.json(studentsWithStats);
  } catch (err) {
    console.error("Error in GET:", err);
    res.status(500).json({ message: err.message });
  }
});

/*
 * Readiness for the CPE / placement (after ci/internal-shortlisting: "the product proposes, the
 * educator disposes"). Every student arrives with a proposed status and its reasons; the educator
 * only overrides where they know better. Rules:
 *   Ready    covered at least 80% of assigned scenarios, best-score average 70%+, practised in 21 days
 *   Almost   best-score average 50%+ or covered at least half
 *   Not yet  otherwise (including: assigned but never practised)
 */
const READY_RULES = { cover: 0.8, ready: 70, almost: 50, recentDays: 21 };
const pctScore = (v) => { const n = Number(v); if (!(n > 0)) return 0; return Math.round(n <= 1 ? n * 100 : n <= 10 ? n * 10 : n); };

router.get("/readiness", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    const who = { role: "student" };
    if (req.scope.educatorId) who.supervisor = req.scope.educatorId;
    else if (req.scope.schoolId) who.schoolId = req.scope.schoolId;
    if (req.query.groupId && mongoose.Types.ObjectId.isValid(req.query.groupId)) who.groupId = req.query.groupId;
    const students = await User.find(who).select("_id name email groupId readinessOverride").populate("groupId", "name").lean();
    const ids = students.map((s) => String(s._id));
    const Scenario = (await import("../models/scenarioModel.js")).default;
    const Session = (await import("../models/sessionModel.js")).default;
    const groupIds = [...new Set(students.map((s) => s.groupId?._id && String(s.groupId._id)).filter(Boolean))];
    const scenarios = await Scenario.find({ $or: [{ assignedTo: { $in: students.map((s) => s._id) } }, { assignedGroups: { $in: groupIds } }] })
      .select("_id assignedTo assignedGroups").lean();
    const byScenario = await assignedStudentIdsByScenario(scenarios);
    const assigned = new Map(ids.map((id) => [id, new Set()]));
    byScenario.forEach((set, scen) => set.forEach((sid) => assigned.get(String(sid))?.add(String(scen))));
    const sessions = await Session.find({ student_id: { $in: ids } }).select("student_id scenario_id score createdAt").lean();
    const best = new Map(ids.map((id) => [id, new Map()]));
    const last = new Map();
    sessions.forEach((x) => {
      const m = best.get(x.student_id); if (!m) return;
      m.set(x.scenario_id, Math.max(m.get(x.scenario_id) || 0, pctScore(x.score)));
      if (!last.get(x.student_id) || x.createdAt > last.get(x.student_id)) last.set(x.student_id, x.createdAt);
    });
    const now = Date.now();
    const rows = students.map((s) => {
      const id = String(s._id);
      const asg = assigned.get(id);
      const m = best.get(id);
      const covered = [...asg].filter((x) => m.has(x)).length;
      const cover = asg.size ? covered / asg.size : 0;
      const bests = [...m.values()];
      const avg = bests.length ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length) : null;
      const lastAt = last.get(id) || null;
      const recent = lastAt && now - new Date(lastAt).getTime() <= READY_RULES.recentDays * 86400000;
      const reasons = [];
      if (!asg.size) reasons.push("Nothing assigned yet");
      else reasons.push(`Practised ${covered} of ${asg.size} scenarios`);
      if (avg != null) reasons.push(`Best-score average ${avg}%`);
      else if (asg.size) reasons.push("No scored sessions yet");
      if (lastAt && !recent) reasons.push(`Last practised over ${READY_RULES.recentDays} days ago`);
      let proposed = "notyet";
      if (asg.size && cover >= READY_RULES.cover && avg != null && avg >= READY_RULES.ready && recent) proposed = "ready";
      else if ((avg != null && avg >= READY_RULES.almost) || cover >= 0.5) proposed = "almost";
      const o = s.readinessOverride?.status ? s.readinessOverride : null;
      return {
        _id: s._id, name: s.name, email: s.email, group: s.groupId?.name || null,
        assigned: asg.size, covered, avg, lastSessionAt: lastAt, proposed, reasons,
        override: o ? { status: o.status, note: o.note || "", byName: o.byName || "", at: o.at } : null,
        status: o ? o.status : proposed,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ rules: READY_RULES, students: rows });
  } catch (err) {
    console.error("Readiness error:", err);
    res.status(500).json({ message: "Server error computing readiness." });
  }
});

/* PATCH /api/students/:id/readiness { status: ready|almost|notyet|null, note } — null returns to the proposal. */
router.patch("/:id/readiness", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Student not found" });
    const student = await User.findById(req.params.id).select("role supervisor schoolId");
    if (!student || student.role !== "student") return res.status(404).json({ message: "Student not found" });
    if (req.scope.educatorId && String(student.supervisor) !== String(req.scope.educatorId)) return res.status(403).json({ message: "Access denied: Not your student" });
    if (!req.scope.educatorId && req.scope.schoolId && String(student.schoolId) !== String(req.scope.schoolId)) return res.status(403).json({ message: "Access denied" });
    const { status, note } = req.body || {};
    if (status !== null && !["ready", "almost", "notyet"].includes(status)) return res.status(400).json({ message: "Status must be ready, almost, notyet or null." });
    const readinessOverride = status === null ? undefined : { status, note: String(note || "").slice(0, 1000), byName: req.user.name || "", at: new Date() };
    await User.updateOne({ _id: student._id }, readinessOverride ? { $set: { readinessOverride } } : { $unset: { readinessOverride: "" } });
    res.json({ override: readinessOverride || null });
  } catch (err) {
    res.status(500).json({ message: "Server error saving readiness." });
  }
});

/*
 * Email the caller's own students: { studentIds: [] } or { groupId }, plus { subject, html }.
 * One message per student (nobody sees the others' addresses), Reply-To the educator.
 * Capped at 200 recipients per request. Reports who failed instead of failing the batch.
 */
router.post("/message", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    const { studentIds, groupId, subject, html } = req.body || {};
    if (!String(subject || "").trim()) return res.status(400).json({ message: "Add a subject." });
    if (!String(html || "").replace(/<[^>]*>/g, "").trim()) return res.status(400).json({ message: "Write the message first." });
    try { assertMailConfigured(); } catch (e) { return res.status(503).json({ message: e.message }); }

    const who = { role: "student" };
    if (req.scope.educatorId) who.supervisor = req.scope.educatorId;
    else if (req.scope.schoolId) who.schoolId = req.scope.schoolId;
    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) who.groupId = groupId;
    else if (Array.isArray(studentIds) && studentIds.length) who._id = { $in: studentIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) };
    else return res.status(400).json({ message: "Choose who to send it to." });

    const recipients = await User.find(who).select("_id name email").limit(201).lean();
    if (!recipients.length) return res.status(400).json({ message: "None of those students are yours." });
    if (recipients.length > 200) return res.status(400).json({ message: "That is more than 200 students. Send to smaller groups." });

    const failed = [];
    let sent = 0;
    for (const r of recipients) {
      try {
        await sendEducatorMessage({ toEmail: r.email, subject, html, educatorName: req.user.name, educatorEmail: req.user.email });
        sent += 1;
      } catch (e) {
        failed.push({ email: r.email, reason: e.message || "send failed" });
      }
    }
    res.json({ sent, failed });
  } catch (err) {
    console.error("Student message error:", err);
    res.status(500).json({ message: "Server error sending the message." });
  }
});

/* Set or clear the educator's private note on a student. Body: { text }. Own students only. */
router.patch("/:id/note", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Student not found" });
    const student = await User.findById(req.params.id).select("role supervisor schoolId");
    if (!student || student.role !== "student") return res.status(404).json({ message: "Student not found" });
    if (req.scope.educatorId && student.supervisor?.toString() !== req.scope.educatorId.toString()) {
      return res.status(403).json({ message: "Access denied: Not your student" });
    }
    if (!req.scope.educatorId && req.scope.schoolId && student.schoolId?.toString() !== req.scope.schoolId.toString()) {
      return res.status(403).json({ message: "Access denied: Student not in your school" });
    }
    const text = String(req.body?.text || "").trim().slice(0, 4000);
    const educatorNote = text ? { text, byName: req.user.name || "", at: new Date() } : { text: "", byName: "", at: null };
    await User.updateOne({ _id: student._id }, { $set: { educatorNote } });
    res.json({ educatorNote });
  } catch (err) {
    console.error("Student note error:", err);
    res.status(500).json({ message: "Server error saving the note." });
  }
});

router.get("/:id", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    const student = await User.findById(req.params.id)
      .select("-password")
      .populate("schoolId", "schoolName");

    if (!student || student.role !== "student") {
      return res.status(404).json({ message: "Student not found" });
    }

    if (
      req.scope.schoolId &&
      student.schoolId &&
      student.schoolId.toString() !== req.scope.schoolId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Access denied: Student not in your school" });
    }

    res.json(student);
  } catch (err) {
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ message: "Student not found (invalid ID format)" });
    }
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", protect, checkAccess("manageStudents"), async (req, res) => {
  try {
    const existingStudent = await User.findById(req.params.id);

    if (!existingStudent || existingStudent.role !== "student") {
      return res.status(404).json({ message: "Student not found" });
    }

    if (
      req.scope.schoolId &&
      existingStudent.schoolId &&
      existingStudent.schoolId.toString() !== req.scope.schoolId.toString()
    ) {
      return res.status(403).json({
        message: "Access denied: Cannot manage student from another school",
      });
    }

    const updatedStudent = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    ).populate("schoolId", "schoolName");

    await invalidateStudentsCache(req.scope);
    res.json(updatedStudent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete(
  "/:id",
  protect,
  checkAccess("manageStudents"),
  async (req, res) => {
    try {
      const student = await User.findById(req.params.id);

      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Student not found" });
      }

      if (
        req.scope.schoolId &&
        student.schoolId &&
        student.schoolId.toString() !== req.scope.schoolId.toString()
      ) {
        return res.status(403).json({
          message: "Access denied: Cannot delete student from another school",
        });
      }

      await User.findByIdAndDelete(req.params.id);
      await invalidateStudentsCache(req.scope);

      res.json({
        message: "Student account removed",
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

export default router;
