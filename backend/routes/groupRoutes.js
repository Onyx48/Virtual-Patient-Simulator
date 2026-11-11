import express from "express";
import Group from "../models/groupModel.js";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { invalidateStudentsCache } from "../utils/studentsCache.js";

const router = express.Router();

// Only educators and school_admins can manage groups
const requireEducatorOrAdmin = (req, res, next) => {
  if (!["educator", "school_admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

// GET /api/groups - fetch groups belonging to the logged-in educator
router.get("/", protect, requireEducatorOrAdmin, async (req, res) => {
  try {
    const filter =
      req.user.role === "educator"
        ? { educatorId: req.user._id }
        : req.user.schoolId
        ? { schoolId: req.user.schoolId }
        : {};

    const groups = await Group.find(filter).sort({ name: 1 });

    // Attach student count to each group
    const groupIds = groups.map((g) => g._id);
    const counts = await User.aggregate([
      { $match: { role: "student", groupId: { $in: groupIds } } },
      { $group: { _id: "$groupId", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach((c) => (countMap[c._id.toString()] = c.count));

    const result = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      educatorId: g.educatorId,
      schoolId: g.schoolId,
      studentCount: countMap[g._id.toString()] || 0,
      joinCode: g.joinCode || null,
      createdAt: g.createdAt,
      notes: (g.notes || []).map((n) => ({
        _id: n._id, text: n.text, authorName: n.authorName, createdAt: n.createdAt,
        mine: n.author?.toString() === req.user._id.toString(),
      })),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// The group if the caller may manage it: its educator, or a school_admin of its school.
const loadOwnGroup = async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) { res.status(404).json({ message: "Group not found" }); return null; }
  const own = req.user.role === "superadmin"
    || (req.user.role === "educator" && group.educatorId?.toString() === req.user._id.toString())
    || (req.user.role === "school_admin" && group.schoolId && group.schoolId.toString() === req.user.schoolId?.toString());
  if (!own) { res.status(403).json({ message: "Access denied" }); return null; }
  return group;
};

// POST /api/groups/:id/notes { text } - add a note to a group
router.post("/:id/notes", protect, requireEducatorOrAdmin, async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ message: "Write a note first." });
    const group = await loadOwnGroup(req, res);
    if (!group) return;
    group.notes = [...(group.notes || []), { text: text.slice(0, 4000), author: req.user._id, authorName: req.user.name || "" }];
    await group.save();
    const n = group.notes[group.notes.length - 1];
    res.status(201).json({ _id: n._id, text: n.text, authorName: n.authorName, createdAt: n.createdAt, mine: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/groups/:id/notes/:noteId - remove your own note
router.delete("/:id/notes/:noteId", protect, requireEducatorOrAdmin, async (req, res) => {
  try {
    const group = await loadOwnGroup(req, res);
    if (!group) return;
    const note = (group.notes || []).find((n) => n._id.toString() === req.params.noteId);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.author?.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Only the author can remove this note." });
    group.notes = group.notes.filter((n) => n._id.toString() !== req.params.noteId);
    await group.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Join codes (after ci/internal-shortlisting's class join code) ---------------------------------
// Unambiguous characters only: no 0/O, 1/I/L, so a code read off a projector is typed right.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

// POST /api/groups/join { code } - a student joins their class. Same school only, and never moves a
// student away from a different educator: that is refused with a message to ask their educator.
router.post("/join", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Only students join a class with a code." });
    const code = String(req.body?.code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 6) return res.status(400).json({ message: "A class code has 6 letters and numbers." });
    const group = await Group.findOne({ joinCode: code });
    if (!group) return res.status(404).json({ message: "No class has that code. Check it with your educator." });
    const me = await User.findById(req.user._id).select("schoolId supervisor groupId");
    if (group.schoolId && me.schoolId && String(group.schoolId) !== String(me.schoolId)) {
      return res.status(403).json({ message: "That class is at a different school." });
    }
    if (me.supervisor && String(me.supervisor) !== String(group.educatorId)) {
      return res.status(409).json({ message: "That class belongs to another educator. Ask your educator to move you." });
    }
    if (String(me.groupId || "") === String(group._id)) return res.json({ ok: true, group: { _id: group._id, name: group.name }, already: true });
    me.groupId = group._id;
    if (!me.supervisor) me.supervisor = group.educatorId;
    await me.save({ validateBeforeSave: false });
    try { await invalidateStudentsCache(me.schoolId, [group.educatorId]); } catch { /* cache is best effort */ }
    res.json({ ok: true, group: { _id: group._id, name: group.name } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups/:id/join-code - make (or replace) the class code. DELETE turns joining off.
router.post("/:id/join-code", protect, requireEducatorOrAdmin, async (req, res) => {
  try {
    const group = await loadOwnGroup(req, res);
    if (!group) return;
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      if (!(await Group.exists({ joinCode: code }))) { group.joinCode = code; break; }
    }
    await group.save();
    res.json({ joinCode: group.joinCode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/:id/join-code", protect, requireEducatorOrAdmin, async (req, res) => {
  try {
    const group = await loadOwnGroup(req, res);
    if (!group) return;
    group.joinCode = undefined;
    await group.save();
    res.json({ joinCode: null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/*
 * GET /api/groups/:id/overview - the class page: roster with practice stats, the funnel
 * (in the class -> assigned -> started -> covered everything -> averaging 70%+), practice per day
 * this week, and who needs attention grouped by reason (ci: grouped by stage, not ranked).
 */
router.get("/:id/overview", protect, requireEducatorOrAdmin, async (req, res) => {
  try {
    const group = await loadOwnGroup(req, res);
    if (!group) return;
    const Session = (await import("../models/sessionModel.js")).default;
    const Scenario = (await import("../models/scenarioModel.js")).default;
    const { assignedStudentIdsByScenario } = await import("../utils/scenarioAssignment.js");
    const students = await User.find({ role: "student", groupId: group._id }).select("_id name email lastLoginAt").lean();
    const ids = students.map((s) => String(s._id));
    const scenarios = await Scenario.find({ $or: [{ assignedGroups: group._id }, { assignedTo: { $in: students.map((s) => s._id) } }] })
      .select("_id assignedTo assignedGroups scenarioName").lean();
    const byScenario = await assignedStudentIdsByScenario(scenarios);
    const assigned = new Map(ids.map((id) => [id, new Set()]));
    byScenario.forEach((set, scen) => set.forEach((sid) => assigned.get(String(sid))?.add(String(scen))));
    const sessions = await Session.find({ student_id: { $in: ids } }).select("student_id scenario_id score createdAt").lean();
    const pct = (v) => { const n = Number(v); if (!(n > 0)) return 0; return Math.round(n <= 1 ? n * 100 : n <= 10 ? n * 10 : n); };
    const now = Date.now();
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now - (6 - i) * 86400000); return { date: d.toISOString().slice(0, 10), sessions: 0 }; });
    const stats = new Map(ids.map((id) => [id, { n: 0, best: new Map(), last: null }]));
    sessions.forEach((x) => {
      const s = stats.get(x.student_id); if (!s) return;
      s.n += 1;
      s.best.set(x.scenario_id, Math.max(s.best.get(x.scenario_id) || 0, pct(x.score)));
      if (!s.last || x.createdAt > s.last) s.last = x.createdAt;
      const day = days.find((d) => d.date === new Date(x.createdAt).toISOString().slice(0, 10));
      if (day) day.sessions += 1;
    });
    const roster = students.map((u) => {
      const s = stats.get(String(u._id));
      const asg = assigned.get(String(u._id));
      const covered = [...asg].filter((sc) => s.best.has(sc)).length;
      const bests = [...s.best.values()];
      const avg = bests.length ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length) : null;
      return { _id: u._id, name: u.name, email: u.email, lastLoginAt: u.lastLoginAt || null, sessions: s.n, assigned: asg.size, covered, avg, lastSessionAt: s.last };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const q = (f) => roster.filter(f);
    const attention = [
      { key: "nosignin", label: "Never signed in", students: q((r) => !r.lastLoginAt) },
      { key: "notstarted", label: "Assigned but not started", students: q((r) => r.lastLoginAt && r.assigned > 0 && r.sessions === 0) },
      { key: "quiet", label: "Quiet for two weeks", students: q((r) => r.lastSessionAt && now - new Date(r.lastSessionAt).getTime() > 14 * 86400000) },
      { key: "low", label: "Averaging under 50%", students: q((r) => r.avg != null && r.avg < 50) },
    ].filter((a) => a.students.length).map((a) => ({ ...a, students: a.students.map((r) => ({ _id: r._id, name: r.name, email: r.email })) }));
    res.json({
      group: { _id: group._id, name: group.name, joinCode: group.joinCode || null },
      notes: (group.notes || []).map((n) => ({ _id: n._id, text: n.text, authorName: n.authorName, createdAt: n.createdAt, mine: n.author?.toString() === req.user._id.toString() })),
      funnel: [
        { stage: "In the class", students: roster.length },
        { stage: "Assigned", students: q((r) => r.assigned > 0).length },
        { stage: "Started", students: q((r) => r.sessions > 0).length },
        { stage: "Covered all", students: q((r) => r.assigned > 0 && r.covered >= r.assigned).length },
        { stage: "Averaging 70%+", students: q((r) => r.avg != null && r.avg >= 70).length },
      ],
      week: days,
      scenarios: scenarios.map((s) => ({ _id: s._id, name: s.scenarioName })),
      roster,
      attention,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groups - create a new group
router.post("/", protect, requireEducatorOrAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Group name is required" });
  }

  try {
    const existing = await Group.findOne({
      name: name.trim(),
      educatorId: req.user._id,
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "A group with this name already exists" });
    }

    const group = new Group({
      name: name.trim(),
      educatorId: req.user._id,
      schoolId: req.user.schoolId || null,
    });
    await group.save();
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/groups/:id - rename a group
router.put("/:id", protect, requireEducatorOrAdmin, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (
      req.user.role === "educator" &&
      group.educatorId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { name } = req.body;
    if (name) group.name = name.trim();
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/groups/:id - delete a group, unassign all students in it
router.delete("/:id", protect, requireEducatorOrAdmin, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (
      req.user.role === "educator" &&
      group.educatorId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    await User.updateMany({ groupId: group._id }, { $set: { groupId: null } });
    await Group.findByIdAndDelete(req.params.id);
    // The cached roster carries each student's group name, so it is wrong the
    // moment those members are turned loose.
    await invalidateStudentsCache({
      schoolId: group.schoolId,
      educatorIds: [group.educatorId],
    });
    res.json({ message: "Group deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
