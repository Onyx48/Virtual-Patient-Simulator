// WHOLE_PROJECT/routes/studentRoutes.js
import express from "express";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import redisClient from "../utils/redisClient.js";
import { assignedStudentIdsByScenario } from "../utils/scenarioAssignment.js";
import {
  studentsCacheKey,
  invalidateStudentsCache,
} from "../utils/studentsCache.js";
import { inviteStatusOf } from "../utils/inviteStatus.js";

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

router.get("/", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
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
        },
      },
    ]);

    const studentsWithStats = students.map((student) => {
      const sessionStat = sessionStats.find(
        (s) => s._id === student._id.toString(),
      );
      return {
        ...student.toObject(),
        assignedScenariosCount:
          scenarioCountByStudent.get(student._id.toString()) || 0,
        bestScore: sessionStat?.bestScore || null,
        avgScore: sessionStat?.avgScore || null,
        totalSessions: sessionStat?.totalSessions || 0,
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
