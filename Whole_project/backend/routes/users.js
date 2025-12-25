// WHOLE_PROJECT/routes/users.js
import express from "express";
import User from "../models/userModel.js"; // Ensure file name matches exactly (case-sensitive on some OS)
import Student from "../models/studentModel.js";

const router = express.Router();

// Debugging: Check if User model is loaded correctly
console.log("User Model Status:", User ? "Loaded" : "FAILED IMPORT");

// GET /api/users
router.get("/", async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users
router.post("/", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validate inputs
    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, password, and role are required." });
    }

    // 2. Normalize role (Handle "Educator" -> "educator")
    const normalizedRole = role.toLowerCase();

    // 3. Validate Role against allowed list
    const allowedRoles = ["student", "educator", "school_admin", "superadmin"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        message: `Invalid role '${role}'. Must be one of: ${allowedRoles.join(
          ", "
        )}`,
      });
    }

    // 4. Check if user exists
    // This is where your error was happening. 'User' must be a valid model.
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // 5. Create New User
    const newUser = new User({
      name,
      email,
      password,
      role: normalizedRole, // Save the lowercase version
    });

    await newUser.save();

    // 6. Handle Student Profile Creation
    if (normalizedRole === "student") {
      const studentProfileExists = await Student.findOne({ user: newUser._id });
      if (!studentProfileExists) {
        const studentProfile = new Student({ user: newUser._id });
        await studentProfile.save();
      }
    }

    // 7. Response
    const userResponse = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };
    res.status(201).json({ success: true, user: userResponse });
  } catch (err) {
    if (err.name === "ValidationError") {
      // This catches Schema validation errors
      return res.status(400).json({ message: err.message });
    }
    console.error("Server Error in POST /api/users:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
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

// PUT /api/users/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = name || user.name;
    user.email = email || user.email;

    if (role) {
      const normalizedRole = role.toLowerCase();
      const allowedRoles = [
        "student",
        "educator",
        "school_admin",
        "superadmin",
      ];
      if (!allowedRoles.includes(normalizedRole)) {
        return res
          .status(400)
          .json({
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

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
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
