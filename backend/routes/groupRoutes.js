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
      createdAt: g.createdAt,
    }));

    res.json(result);
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
