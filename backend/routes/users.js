// WHOLE_PROJECT/routes/users.js
import express from "express";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
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
    // 1. Destructure schoolId along with other fields
    const { name, email, password, role, schoolId } = req.body;

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

    // 5. Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // 6. Determine schoolId based on creator role
    let finalSchoolId = schoolId;
    if (req.user.role === "school_admin") {
      // School admin can only create users in their school
      finalSchoolId = req.user.schoolId;
    } else if (req.user.role === "educator") {
      // Educator creates users in their school
      finalSchoolId = req.user.schoolId;
    }
    // Superadmin can specify any schoolId or leave undefined

    // 7. Create New User
    const newUser = new User({
      name,
      email,
      password,
      role: normalizedRole,
      schoolId: finalSchoolId,
    });

    await newUser.save();

    // 7. Handle Student Profile Creation
    if (normalizedRole === "student") {
      const studentProfileExists = await Student.findOne({ user: newUser._id });
      if (!studentProfileExists) {
        const studentProfile = new Student({ user: newUser._id });
        await studentProfile.save();
      }
    }

    // 8. Response
    const userResponse = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      schoolId: newUser.schoolId,
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
  const { name, email, role, schoolId } = req.body; // Added schoolId

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = name || user.name;
    user.email = email || user.email;

    // Update schoolId if provided (allow unassigning if explicit null, or reassignment)
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

    const updatedUser = await user.save();
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
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === "student") {
      await Student.findOneAndDelete({ user: user._id });
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
