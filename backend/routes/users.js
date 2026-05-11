import express from "express";
import User from "../models/userModel.js";
import School from "../models/schoolModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import { sendWelcomeEmail } from "../utils/emailService.js";

const router = express.Router();

console.log("User Model Status:", User ? "Loaded" : "FAILED IMPORT");

router.get("/", protect, checkAccess("manageUsers"), async (req, res) => {
  try {
    let query = {};

    const { role, schoolId } = req.query;
    if (role) query.role = role;
    if (schoolId) query.schoolId = schoolId;

    if (req.scope) {
      if (req.scope.schoolId) {
        query.schoolId = req.scope.schoolId;
      }
    }

    const users = await User.find(query)
      .select("-password")
      .populate("schoolId", "schoolName");

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", protect, checkAccess("manageUsers"), async (req, res) => {
  console.log("[USERS] POST route hit. Body:", req.body);
  try {
    const { name, email, password, role, schoolId, department } = req.body;
    console.log("Creating user. Department:", department, "Role:", role);

    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, password, and role are required." });
    }

    const normalizedRole = role.toLowerCase();

    const allowedRoles = ["student", "educator", "school_admin", "superadmin"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        message: `Invalid role '${role}'. Must be one of: ${allowedRoles.join(
          ", ",
        )}`,
      });
    }

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

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    let finalSchoolId = schoolId;
    if (req.user.role === "school_admin") {
      finalSchoolId = req.user.schoolId;
    } else if (req.user.role === "educator") {
      finalSchoolId = req.user.schoolId;
    }

    if (
      (normalizedRole === "educator" || normalizedRole === "school_admin") &&
      !finalSchoolId
    ) {
      return res.status(400).json({
        message: "School ID is required for educators and school admins.",
      });
    }

    let supervisor = null;
    if (req.user.role === "educator" && normalizedRole === "student") {
      supervisor = req.user._id;
    }

    const finalDepartment =
      normalizedRole === "student" ? undefined : department || "Science";

    const userData = {
      name,
      email,
      password,
      role: normalizedRole,
      schoolId: finalSchoolId,
      supervisor: supervisor,
      department: finalDepartment,
    };

    const newUser = new User(userData);
    await newUser.save();
    console.log("[USER] Calling sendWelcomeEmail for user:", email);
    sendWelcomeEmail({
      toEmail: email,
      name,
      password,
    }).catch((err) => console.error("[USER] Welcome email failed:", err));

    if (normalizedRole === "school_admin") {
      await School.findByIdAndUpdate(finalSchoolId, {
        assignedAdmin: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
        },
      });
    }

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

router.get("/:id", protect, checkAccess("manageUsers"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("schoolId");
    if (user) {
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

router.put("/:id", protect, checkAccess("manageUsers"), async (req, res) => {
  const { id } = req.params;
  const { name, email, role, schoolId, department } = req.body;

  try {
    const user = await User.findById(id).populate("schoolId");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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

    if (department !== undefined) {
      user.department = department;
    }

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

      user.role = normalizedRole;
    }

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

    const oldSchoolId = user.schoolId;
    const oldRole = user.role;
    const newRole = user.role;
    const newSchoolId = user.schoolId;

    const updatedUser = await user.save();

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

router.delete("/:id", protect, checkAccess("manageUsers"), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).populate("schoolId");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      req.scope.schoolId &&
      user.schoolId &&
      user.schoolId._id.toString() !== req.scope.schoolId.toString()
    ) {
      return res.status(403).json({
        message: "Access denied: Cannot delete user from another school",
      });
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
