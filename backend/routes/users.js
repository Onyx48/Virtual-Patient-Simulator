// WHOLE_PROJECT/routes/users.js
import express from "express";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import School from "../models/schoolModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";

const router = express.Router();

// Debugging: Check if User model is loaded correctly
console.log("User Model Status:", User ? "Loaded" : "FAILED IMPORT");

// @desc    Get all users (scoped)
// @route   GET /api/users
// @access  Private (Educator, School Admin, Superadmin)
router.get("/", protect, checkAccess("manageUsers"), async (req, res) => {
  try {
    let query = {};

    // Apply query params
    const { role, schoolId } = req.query;
    if (role) query.role = role;
    if (schoolId) query.schoolId = schoolId;

    // Apply role-based scoping
    if (req.scope) {
      if (req.scope.schoolId) {
        query.schoolId = req.scope.schoolId; // School admin sees only users in their school
      }
      // Note: Educator scope might need additional filtering for their students/educators
    }

    const users = await User.find(query)
      .select("-password")
      .populate("schoolId", "schoolName");

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @desc    Create a new user
// @route   POST /api/users
// @access  Private (Educator, School Admin, Superadmin)
router.post("/", protect, checkAccess("manageUsers"), async (req, res) => {
  try {
    // 1. Destructure inputs
    const { name, email, password, role, schoolId, department, grade } =
      req.body;
    console.log("Creating user. Department:", department, "Role:", role);

    // 2. Validate inputs
    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, password, and role are required." });
    }

    // 3. Normalize role
    const normalizedRole = role.toLowerCase();

    // 4. Validate Role against allowed list
    const allowedRoles = ["student", "educator", "school_admin", "superadmin"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        message: `Invalid role '${role}'. Must be one of: ${allowedRoles.join(
          ", "
        )}`,
      });
    }

    // 5. Enforce creation hierarchy
    const allowedCreations = {
      superadmin: ["school_admin"],
      school_admin: ["educator", "student"],
      educator: ["student"],
    };

    if (!allowedCreations[req.user.role]?.includes(normalizedRole)) {
      return res.status(403).json({
        message: `${req.user.role} cannot create ${normalizedRole} role.`,
      });
    }

    // 6. For school_admin, ensure school exists and is not already assigned
    if (normalizedRole === "school_admin") {
      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(400).json({ message: "Invalid school ID." });
      }
      if (school.assignedAdmin && school.assignedAdmin.id) {
        return res.status(400).json({
          message: "This school is already assigned to another school admin.",
        });
      }
    }

    // 7. Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // 8. Determine schoolId based on creator role
    let finalSchoolId = schoolId;
    if (req.user.role === "school_admin") {
      // School admin can only create users in their school
      finalSchoolId = req.user.schoolId;
    } else if (req.user.role === "educator") {
      // Educator creates users in their school
      finalSchoolId = req.user.schoolId;
    }
    // Superadmin can specify any schoolId or leave undefined

    // Validate final schoolId
    if (
      (normalizedRole === "educator" || normalizedRole === "school_admin") &&
      !finalSchoolId
    ) {
      return res.status(400).json({
        message: "School ID is required for educators and school admins.",
      });
    }

    // 9. Determine Supervisor and Department

    // --- SUPERVISOR LOGIC FIXED ---
    let supervisor = null;
    if (req.user.role === "school_admin" && normalizedRole === "educator") {
      // If School Admin creates Educator, they are the supervisor
      supervisor = req.user._id;
    } else if (req.user.role === "educator" && normalizedRole === "student") {
      // If Educator creates Student, they are the supervisor
      supervisor = req.user._id;
    }

    // --- DEPARTMENT LOGIC FIXED ---
    // If role is student, force department to be undefined so it isn't saved.
    // If role is educator/admin, use provided department or default to Science.
    const finalDepartment =
      normalizedRole === "student" ? undefined : department || "Science";

    const userData = {
      name,
      email,
      password,
      role: normalizedRole,
      schoolId: finalSchoolId,
      supervisor: supervisor, // Updated supervisor logic
      department: finalDepartment, // Updated department logic
    };

    const newUser = new User(userData);
    await newUser.save();

    // 10. For school_admin, assign to school
    if (normalizedRole === "school_admin") {
      await School.findByIdAndUpdate(finalSchoolId, {
        assignedAdmin: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
        },
      });
    }

    // 11. Handle Student Profile Creation
    if (normalizedRole === "student") {
      const studentProfileExists = await Student.findOne({ user: newUser._id });
      if (!studentProfileExists) {
        // Fetch school name for the profile
        let schoolNameStr = "Unknown School";
        if (finalSchoolId) {
          const sObj = await School.findById(finalSchoolId);
          if (sObj) schoolNameStr = sObj.schoolName;
        }

        const studentData = {
          user: newUser._id,
          // If creator is educator, assign them as educatorId immediately
          educatorId: req.user.role === "educator" ? req.user._id : null,
          grade: grade || "Not Assigned",
          school: schoolNameStr,
        };

        const studentProfile = new Student(studentData);
        await studentProfile.save();
        console.log(
          `Student profile created. Linked to Educator: ${studentData.educatorId}`
        );
      }
    }

    // 12. Response
    const userResponse = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      schoolId: newUser.schoolId,
      supervisor: newUser.supervisor,
      department: newUser.department,
    };
    res.status(201).json({ success: true, user: userResponse });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error("Server Error in POST /api/users:", err);
    res.status(500).json({ message: err.message });
  }
});

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private (Educator, School Admin, Superadmin)
router.get("/:id", protect, checkAccess("manageUsers"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("schoolId");
    if (user) {
      // Check scope for school_admin
      if (
        req.scope.schoolId &&
        user.schoolId &&
        user.schoolId._id.toString() !== req.scope.schoolId.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Access denied: User not in your school" });
      }
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ message: "User not found (invalid ID format)" });
    }
    res.status(500).json({ message: err.message });
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Educator, School Admin, Superadmin)
router.put("/:id", protect, checkAccess("manageUsers"), async (req, res) => {
  const { id } = req.params;
  const { name, email, role, schoolId, department } = req.body;

  try {
    const user = await User.findById(id).populate("schoolId");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check scope for school_admin
    if (
      req.scope.schoolId &&
      user.schoolId &&
      user.schoolId._id.toString() !== req.scope.schoolId.toString()
    ) {
      return res.status(403).json({
        message: "Access denied: Cannot manage user from another school",
      });
    }

    user.name = name || user.name;
    user.email = email || user.email;

    // Update department if provided
    if (department !== undefined) {
      user.department = department;
    }

    // Update schoolId if provided
    if (schoolId !== undefined) {
      user.schoolId = schoolId;
    }

    if (role) {
      const normalizedRole = role.toLowerCase();
      const allowedRoles = [
        "student",
        "educator",
        "school_admin",
        "superadmin",
      ];
      if (!allowedRoles.includes(normalizedRole)) {
        return res.status(400).json({
          message: `Invalid role. Must be: ${allowedRoles.join(", ")}`,
        });
      }

      const oldRole = user.role;
      if (normalizedRole !== oldRole) {
        user.role = normalizedRole;
        // Handle profile cleanup/creation based on role change
        if (oldRole === "student" && normalizedRole !== "student") {
          await Student.findOneAndDelete({ user: user._id });
        } else if (oldRole !== "student" && normalizedRole === "student") {
          const existingProfile = await Student.findOne({ user: user._id });
          if (!existingProfile) {
            await new Student({ user: user._id }).save();
          }
        }
      }
    }

    // Check for school_admin uniqueness if role is school_admin and schoolId is provided
    if (user.role === "school_admin" && schoolId !== undefined) {
      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(400).json({ message: "Invalid school ID." });
      }
      if (
        school.assignedAdmin &&
        school.assignedAdmin.toString() !== user._id.toString()
      ) {
        return res.status(400).json({
          message: "This school is already assigned to another school admin.",
        });
      }
    }

    // Handle school assignment changes
    const oldSchoolId = user.schoolId;
    const oldRole = user.role;
    const newRole = user.role;
    const newSchoolId = user.schoolId;

    const updatedUser = await user.save();

    // Clear old assignment if role changed from school_admin or schoolId changed
    if (
      oldRole === "school_admin" &&
      (newRole !== "school_admin" ||
        newSchoolId?.toString() !== oldSchoolId?.toString())
    ) {
      if (oldSchoolId) {
        await School.findByIdAndUpdate(oldSchoolId, {
          assignedAdmin: { id: null, name: "", email: "" },
        });
      }
    }

    // Set new assignment if now school_admin
    if (newRole === "school_admin" && newSchoolId) {
      await School.findByIdAndUpdate(newSchoolId, {
        assignedAdmin: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
        },
      });
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Educator, School Admin, Superadmin)
router.delete("/:id", protect, checkAccess("manageUsers"), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).populate("schoolId");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check scope for school_admin
    if (
      req.scope.schoolId &&
      user.schoolId &&
      user.schoolId._id.toString() !== req.scope.schoolId.toString()
    ) {
      return res.status(403).json({
        message: "Access denied: Cannot delete user from another school",
      });
    }

    if (user.role === "student") {
      await Student.findOneAndDelete({ user: user._id });
    }
    if (user.role === "school_admin" && user.schoolId) {
      await School.findByIdAndUpdate(user.schoolId, {
        assignedAdmin: { id: null, name: "", email: "" },
      });
    }
    await User.findByIdAndDelete(id);
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
