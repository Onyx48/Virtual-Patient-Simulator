// WHOLE_PROJECT/routes/studentRoutes.js
import express from "express";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";

const router = express.Router();

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
    console.log(
      "Student user created - ID:",
      user._id,
      "Supervisor:",
      user.supervisor,
    );

    res.status(201).json(user);
  } catch (err) {
    console.error("Error in POST:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    let students = [];
    const Scenario = (await import("../models/scenarioModel.js")).default;
    const Session = (await import("../models/sessionModel.js")).default;

    if (req.scope.educatorId) {
      students = await User.find({
        role: "student",
        supervisor: req.scope.educatorId,
      }).populate("schoolId", "schoolName");
    } else if (req.scope.schoolId) {
      students = await User.find({
        role: "student",
        schoolId: req.scope.schoolId,
      }).populate("schoolId", "schoolName");
    } else {
      students = await User.find({ role: "student" }).populate(
        "schoolId",
        "schoolName",
      );
    }

    if (students.length === 0) {
      return res.json(students);
    }

    const studentIds = students.map((s) => s._id);

    const scenarioStats = await Scenario.aggregate([
      { $match: { assignedTo: { $in: studentIds } } },
      { $unwind: "$assignedTo" },
      {
        $group: {
          _id: "$assignedTo",
          assignedScenariosCount: { $sum: 1 },
        },
      },
    ]);

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
      const scenarioStat = scenarioStats.find(
        (s) => s._id.toString() === student._id.toString(),
      );
      const sessionStat = sessionStats.find(
        (s) => s._id === student._id.toString(),
      );
      return {
        ...student.toObject(),
        assignedScenariosCount: scenarioStat?.assignedScenariosCount || 0,
        bestScore: sessionStat?.bestScore || null,
        avgScore: sessionStat?.avgScore || null,
        totalSessions: sessionStat?.totalSessions || 0,
      };
    });

    console.log(
      "GET /api/students - Scope:",
      req.scope,
      "Students found:",
      studentsWithStats.length,
    );
    res.json(studentsWithStats);
  } catch (err) {
    console.error("Error in GET:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    const student = await User.findById(req.params.id).populate(
      "schoolId",
      "schoolName",
    );

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

      res.json({
        message: "Student account removed",
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

export default router;
