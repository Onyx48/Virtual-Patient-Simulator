// WHOLE_PROJECT/routes/studentRoutes.js
import express from "express";
import mongoose from "mongoose";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js"; // To populate user details
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";

const router = express.Router();

// POST /api/students - Create a new student (User + Student profile) by Educator
// @access Private (Educator)
// Grade options for random assignment
const GRADE_OPTIONS = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
  'Grade 11', 'Grade 12', 'Beginner', 'Intermediate', 'Advanced'
];

function getRandomGrade() {
  return GRADE_OPTIONS[Math.floor(Math.random() * GRADE_OPTIONS.length)];
}

router.post("/", protect, checkAccess("manageStudents"), async (req, res) => {
  const { name, email, password, schoolName } = req.body;

  console.log(
    "POST /api/students - User ID:",
    req.user?._id,
    "Role:",
    req.user?.role
  );

  // Safety check for ObjectId conversion
  if (
    !req.user ||
    !req.user._id ||
    !mongoose.Types.ObjectId.isValid(req.user._id)
  ) {
    console.error(
      "Invalid user ID for supervisor/educatorId conversion:",
      req.user?._id
    );
    return res
      .status(400)
      .json({ message: "Invalid user authentication for student creation" });
  }

  // Validation
  if (!name || !email || !password || !schoolName) {
    return res
      .status(400)
      .json({ message: "Name, email, password, and schoolName are required" });
  }

  try {
    // Check if email exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Create User
    const user = new User({
      name,
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save hook
      role: "student",
      schoolId: req.user.schoolId, // Educator's school
      supervisor: new mongoose.Types.ObjectId(req.user._id), // Force ObjectId conversion
    });
    await user.save();
    console.log("User created - ID:", user._id, "Supervisor:", user.supervisor);

    // Create Student profile
    const student = new Student({
      user: user._id,
      educatorId: new mongoose.Types.ObjectId(req.user._id), // Force ObjectId conversion
      school: schoolName,
      grade: getRandomGrade(), // Assign random grade for mock data
    });
    await student.save();
    console.log(
      "Student created - ID:",
      student._id,
      "EducatorId:",
      student.educatorId
    );

    // Populate for response
    const populatedStudent = await Student.findById(student._id).populate(
      "user",
      "name email role"
    );
    res.status(201).json(populatedStudent);
  } catch (err) {
    console.error("Error in POST:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/students - Get all student profiles (with user details)
// @access Private (Educator, School Admin, Superadmin)
router.get("/", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    let query = {};

    // Apply scope filtering
    if (req.scope.educatorId) {
      query.educatorId = req.scope.educatorId; // Educator sees only their students
    } else if (req.scope.schoolId) {
      // For school_admin, find students whose user belongs to their school
      // This works by finding all User IDs first
      const studentUsers = await User.find({
        role: "student",
        schoolId: req.scope.schoolId,
      }).select("_id");
      query.user = { $in: studentUsers.map((u) => u._id) };

      // Removed the 'educatorId: { $exists: true }' restriction so School Admins see all students
    }

    console.log("GET /api/students - Scope:", req.scope, "Query:", query);

    // Populate user details (name, email) and assigned scenarios from the referenced documents
    const students = await Student.find(query)
      .populate("user", "name email role")
      .populate("assignedScenarios", "scenarioName description");
    console.log("Students found:", students.length);
    res.json(students);
  } catch (err) {
    console.error("Error in GET:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/students/:id - Get a single student's profile by their Student Profile _id
// @access Private (Educator, School Admin, Superadmin, Student for own)
router.get("/:id", protect, checkAccess("viewStudents"), async (req, res) => {
  try {
    const studentProfile = await Student.findById(req.params.id).populate(
      "user",
      "name email role schoolId"
    );
    if (!studentProfile) {
      return res.status(404).json({ message: "Student profile not found" });
    }
    // Check scope for school_admin
    if (
      req.scope.schoolId &&
      studentProfile.user.schoolId &&
      studentProfile.user.schoolId.toString() !== req.scope.schoolId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Access denied: Student not in your school" });
    }
    res.json(studentProfile);
  } catch (err) {
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ message: "Student profile not found (invalid ID format)" });
    }
    res.status(500).json({ message: err.message });
  }
});

// GET /api/students/user/:userId - Get a student's profile using their User _id
// Useful for a logged-in student to fetch their own profile details
// @access Private (Educator, School Admin, Superadmin, Student for own)
router.get(
  "/user/:userId",
  protect,
  checkAccess("viewStudents"),
  async (req, res) => {
    try {
      const studentProfile = await Student.findOne({
        user: req.params.userId,
      })
        .populate("user", "name email role")
        .populate("assignedScenarios", "scenarioName description");
      if (!studentProfile) {
        return res
          .status(404)
          .json({ message: "Student profile not found for this user." });
      }
      res.json(studentProfile);
    } catch (err) {
      if (err.kind === "ObjectId") {
        return res
          .status(404)
          .json({
            message: "Student profile not found (invalid user ID format)",
          });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// PUT /api/students/:id - Update a student's profile data (e.g., grade, school) by Student Profile _id
// @access Private (Educator, School Admin, Superadmin)
router.put("/:id", protect, checkAccess("manageStudents"), async (req, res) => {
  try {
    // First, check if the student exists and scope
    const existingStudent = await Student.findById(req.params.id).populate(
      "user",
      "schoolId"
    );

    if (!existingStudent) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    // Check scope for school_admin
    if (
      req.scope.schoolId &&
      existingStudent.user.schoolId &&
      existingStudent.user.schoolId.toString() !== req.scope.schoolId.toString()
    ) {
      return res
        .status(403)
        .json({
          message: "Access denied: Cannot manage student from another school",
        });
    }

    // Use findByIdAndUpdate to support MongoDB operators like $addToSet, $pull
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate("user", "name email role");

    res.json(updatedStudent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/students/:id - Delete a student's profile (and their User account) by Student Profile _id
// @access Private (Educator, School Admin, Superadmin)
router.delete(
  "/:id",
  protect,
  checkAccess("manageStudents"),
  async (req, res) => {
    try {
      const studentProfile = await Student.findById(req.params.id).populate(
        "user",
        "schoolId"
      );
      if (!studentProfile) {
        return res.status(404).json({ message: "Student profile not found" });
      }

      // Check scope for school_admin
      if (
        req.scope.schoolId &&
        studentProfile.user.schoolId &&
        studentProfile.user.schoolId.toString() !==
          req.scope.schoolId.toString()
      ) {
        return res
          .status(403)
          .json({
            message: "Access denied: Cannot delete student from another school",
          });
      }

      // Also delete the associated User account to keep data consistent
      await User.findByIdAndDelete(studentProfile.user);
      await Student.findByIdAndDelete(req.params.id); // Delete the student profile itself

      res.json({
        message: "Student profile and associated user account removed",
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
