import express from "express";
import User from "../models/userModel.js";
import School from "../models/schoolModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import { sendWelcomeEmail } from "../utils/emailService.js";
import crypto from "crypto";
import redisClient from "../utils/redisClient.js";
import { invalidateStudentsCache } from "../utils/studentsCache.js";
import { publicMessage } from "../utils/appEnv.js";
import { groupNameMatcher } from "../utils/groupName.js";

const router = express.Router();
const USERS_CACHE_TTL = 120; // seconds

console.log("User Model Status:", User ? "Loaded" : "FAILED IMPORT");

const usersListCacheKey = (scopeSchoolId, role) => {
  const schoolPart = scopeSchoolId ? scopeSchoolId.toString() : "all";
  const rolePart = role || "all";
  return `users:${schoolPart}:${rolePart}`;
};

const isRedisReady = () => redisClient && redisClient.status === "ready";

/*
 * `educatorIds` are the supervisors whose student lists this change touches —
 * on a reassignment, both the old and the new one.
 *
 * Creating a student here has to purge the students cache as well as the users
 * cache: GET /api/students is cached separately, so clearing only `users:*`
 * left an educator's roster claiming for two minutes that the student they had
 * just added did not exist.
 */
const invalidateUsersCache = async (schoolId, educatorIds = []) => {
  await invalidateStudentsCache({ schoolId, educatorIds });

  if (!isRedisReady()) return;
  try {
    const roles = ["student", "educator", "school_admin", "all"];
    const schoolPart = schoolId ? schoolId.toString() : "all";
    await Promise.all(
      roles.map((r) => redisClient.del(`users:${schoolPart}:${r}`))
    );
  } catch (err) {
    console.error("Redis cache invalidation error:", err.message);
  }
};

// GET ALL USERS (with filters)
router.get("/", protect, checkAccess("manageUsers"), async (req, res) => {
  try {
    let query = {};
    const { role, schoolId } = req.query;
    if (role) query.role = role;
    if (schoolId) query.schoolId = schoolId;
    if (req.scope?.schoolId) {
      query.schoolId = req.scope.schoolId;
    }

    const cacheKey = usersListCacheKey(req.scope?.schoolId, role);

    if (isRedisReady()) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    }

    const users = await User.find(query)
      .select("-password")
      .populate("schoolId", "schoolName");

    if (isRedisReady()) {
      redisClient.set(cacheKey, JSON.stringify(users), "EX", USERS_CACHE_TTL).catch(() => {});
    }

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE SINGLE USER
router.post("/", protect, checkAccess("manageUsers"), async (req, res) => {
  console.log("[USERS] POST route hit. Body:", req.body);
  try {
    let { password } = req.body;
    const { name, email, role, schoolId, department, groupId, newGroupName } = req.body;

    if (!name || !email || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, and role are required." });
    }
    if (!password) {
      password = crypto.randomBytes(8).toString("hex");
    }

    const normalizedRole = role.toLowerCase();
    const allowedRoles = ["student", "educator", "school_admin", "superadmin"];
    if (!allowedRoles.includes(normalizedRole)) {
      return res
        .status(400)
        .json({
          message: `Invalid role '${role}'. Must be one of: ${allowedRoles.join(", ")}`,
        });
    }

    const allowedCreations = {
      superadmin: ["school_admin"],
      school_admin: ["educator", "student"],
      educator: ["student"],
    };
    if (!allowedCreations[req.user.role]?.includes(normalizedRole)) {
      return res
        .status(403)
        .json({
          message: `${req.user.role} cannot create ${normalizedRole} role.`,
        });
    }

    if (normalizedRole === "school_admin") {
      const school = await School.findById(schoolId);
      if (!school)
        return res.status(400).json({ message: "Invalid school ID." });
      if (school.assignedAdmin?.id)
        return res
          .status(400)
          .json({
            message: "This school is already assigned to another school admin.",
          });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    let finalSchoolId = schoolId;
    if (req.user.role === "school_admin" || req.user.role === "educator") {
      finalSchoolId = req.user.schoolId;
    }

    if (
      (normalizedRole === "educator" || normalizedRole === "school_admin") &&
      !finalSchoolId
    ) {
      return res
        .status(400)
        .json({
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
      supervisor,
      department: finalDepartment,
    };
    const newUser = new User(userData);
    await newUser.save();

    // Handle group assignment for students
    if (normalizedRole === "student") {
      let resolvedGroupId = groupId || null;
      if (newGroupName && newGroupName.trim()) {
        const Group = (await import("../models/groupModel.js")).default;
        const group = new Group({
          name: newGroupName.trim(),
          educatorId: req.user._id,
          schoolId: finalSchoolId || null,
        });
        await group.save();
        resolvedGroupId = group._id;
      }
      if (resolvedGroupId) {
        newUser.groupId = resolvedGroupId;
        await newUser.save();
      }
    }

    /*
     * A failed send must not undo the account, which already exists — but it
     * must not be invisible either. The outcome is reported back so the UI can
     * say the credentials did not go out; swallowing it silently meant accounts
     * were created for people who never received a way to log in.
     */
    let emailSent = false;
    let emailError = null;
    try {
      await sendWelcomeEmail({ toEmail: email, name, password });
      emailSent = true;
      newUser.credentialsSentAt = new Date();
      await newUser.save();
    } catch (emailErr) {
      emailError =
        emailErr.code === "MAIL_NOT_CONFIGURED"
          ? "Email is not configured on the server, so no credentials were sent."
          : publicMessage(emailErr, "The welcome email could not be sent.");
      console.error("[USER] Failed to send welcome email for:", email, emailErr);
    }

    await invalidateUsersCache(finalSchoolId, [newUser.supervisor]);

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
      groupId: newUser.groupId,
    };
    res.status(201).json({ success: true, user: userResponse, emailSent, emailError });
  } catch (err) {
    if (err.name === "ValidationError")
      return res.status(400).json({ message: err.message });
    console.error("Server Error in POST /api/users:", err);
    res.status(500).json({ message: err.message });
  }
});

/*
 * RESEND CREDENTIALS
 *
 * Passwords are stored only as bcrypt hashes, so the original cannot be read
 * back and re-sent — there is no way to "email them the same password". A
 * resend therefore issues a fresh one and invalidates the old, which is also
 * the safer behaviour: a password that has been sitting unclaimed in an inbox
 * is exactly the one worth rotating. The response says so explicitly so the UI
 * can warn before doing it.
 */
router.post(
  "/:id/resend-invite",
  protect,
  checkAccess("manageUsers"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Same school boundary the update and delete handlers enforce, so a
      // school_admin cannot mail a new password to somebody else's user.
      if (
        req.scope.schoolId &&
        user.schoolId?.toString() !== req.scope.schoolId.toString()
      ) {
        return res.status(403).json({
          message: "Access denied: Cannot manage user from another school",
        });
      }
      if (
        req.scope.educatorId &&
        user.supervisor?.toString() !== req.scope.educatorId.toString()
      ) {
        return res.status(403).json({
          message: "Access denied: This user is not one of yours",
        });
      }

      const password = crypto.randomBytes(8).toString("hex");

      /*
       * Sent before the new password is persisted. If SES rejects it, the
       * account keeps the credentials it already had — whereas saving first
       * would leave the user locked out with a password that only ever existed
       * inside an email that never arrived.
       */
      try {
        await sendWelcomeEmail({ toEmail: user.email, name: user.name, password });
      } catch (emailErr) {
        console.error("[USER] Resend failed for:", user.email, emailErr);
        return res.status(502).json({
          success: false,
          message:
            emailErr.code === "MAIL_NOT_CONFIGURED"
              ? "Email is not configured on the server, so nothing was sent. The existing password is unchanged."
              : publicMessage(
                  emailErr,
                  "The email could not be sent. The existing password is unchanged.",
                ),
        });
      }

      user.password = password; // hashed by the pre-save hook
      user.credentialsSentAt = new Date();
      await user.save();

      await invalidateUsersCache(user.schoolId, [user.supervisor]);

      res.json({
        success: true,
        message: `New credentials sent to ${user.email}. Their previous password no longer works.`,
        credentialsSentAt: user.credentialsSentAt,
      });
    } catch (err) {
      console.error("Server Error in POST /api/users/:id/resend-invite:", err);
      res.status(500).json({ message: publicMessage(err, "Server error") });
    }
  },
);

// BULK CREATE USERS (STUDENTS OR EDUCATORS)
router.post("/bulk", protect, checkAccess("manageUsers"), async (req, res) => {
  const { users, role } = req.body;
  const creator = req.user;

  if (!users || !Array.isArray(users) || users.length === 0) {
    return res
      .status(400)
      .json({ message: "User data is missing or not an array." });
  }
  if (!role || !["student", "educator"].includes(role)) {
    return res
      .status(400)
      .json({
        message:
          "A valid role ('student' or 'educator') is required for bulk creation.",
      });
  }

  const results = { successCount: 0, failureCount: 0, errors: [] };

  const Group = (await import("../models/groupModel.js")).default;

  /*
   * Groups are matched by name and created on first sight, so a whole cohort can
   * be imported in one file without the educator creating the group by hand first.
   *
   * Cached by lowercased name for the length of the request: a 40-row file where
   * every student is in "Year 2 Group A" must end up in one group, not forty
   * groups with the same name. Scoped to the creator, because two educators are
   * entitled to their own "Group A".
   */
  const groupCache = new Map();
  const resolveGroup = async (rawName) => {
    const groupName = String(rawName).trim();
    const key = groupName.toLowerCase();
    if (groupCache.has(key)) return groupCache.get(key);

    let group = await Group.findOne({
      name: groupNameMatcher(groupName),
      educatorId: creator._id,
    });
    if (!group) {
      group = await Group.create({
        name: groupName,
        educatorId: creator._id,
        schoolId: creator.schoolId || null,
      });
      console.log(`[BULK] created group "${groupName}" for educator ${creator._id}`);
    }
    groupCache.set(key, group._id);
    return group._id;
  };

  for (const user of users) {
    try {
      const { name, email, department, group } = user;
      if (!name || !email) {
        results.failureCount++;
        results.errors.push({
          email: email || "N/A",
          reason: "Missing name or email.",
        });
        continue;
      }

      const lowerEmail = email.toLowerCase();
      const userExists = await User.findOne({ email: lowerEmail });
      if (userExists) {
        results.failureCount++;
        results.errors.push({ email, reason: "Email already exists." });
        continue;
      }

      const password = crypto.randomBytes(8).toString("hex");
      const newUserData = {
        name,
        email: lowerEmail,
        password,
        role,
        schoolId: creator.schoolId,
      };

      if (role === "student" && creator.role === "educator") {
        newUserData.supervisor = creator._id;
      }

      if (role === "educator") {
        /*
         * An unrecognised department is refused rather than quietly replaced with
         * Science, which is what this did before — an educator ended up filed
         * under a subject nobody had chosen and nothing said so. Blank still
         * defaults, because the column is optional.
         */
        const allowed = ["Science", "History", "English", "Mathematics"];
        if (department && !allowed.includes(department)) {
          results.failureCount++;
          results.errors.push({
            email,
            reason: `"${department}" is not a department. Use one of: ${allowed.join(", ")}.`,
          });
          continue;
        }
        newUserData.department = department || "Science";
      }

      // Resolved before the user is saved so a bad group name fails the row
      // rather than leaving an account behind with no group.
      if (role === "student" && group && String(group).trim()) {
        newUserData.groupId = await resolveGroup(group);
      }

      const newUser = new User(newUserData);
      await newUser.save();

      try {
        await sendWelcomeEmail({ toEmail: lowerEmail, name, password });
      } catch (emailErr) {
        console.error("[BULK] Failed to send welcome email for:", lowerEmail, emailErr);
      }
      results.successCount++;
    } catch (error) {
      results.failureCount++;
      results.errors.push({
        email: user.email,
        reason: error.message || "Server error during creation.",
      });
    }
  }

  await invalidateUsersCache(creator.schoolId, [creator._id]);

  return res
    .status(207)
    .json({
      message: `Bulk operation completed. Success: ${results.successCount}, Failures: ${results.failureCount}.`,
      ...results,
    });
});

// GET SINGLE USER BY ID
router.get("/:id", protect, checkAccess("manageUsers"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("schoolId");
    if (user) {
      if (
        req.scope.schoolId &&
        user.schoolId?._id.toString() !== req.scope.schoolId.toString()
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
    if (err.kind === "ObjectId")
      return res
        .status(404)
        .json({ message: "User not found (invalid ID format)" });
    res.status(500).json({ message: err.message });
  }
});

// UPDATE USER
router.put("/:id", protect, checkAccess("manageUsers"), async (req, res) => {
  const { id } = req.params;
  const { name, email, role, schoolId, department, groupId } = req.body;

  try {
    const user = await User.findById(id).populate("schoolId");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Captured before any mutation: if the supervisor changes below, the
    // previous educator's cached roster has to be purged too or it keeps
    // listing a student who has moved to someone else.
    const previousSupervisor = user.supervisor;
    const previousSchoolId = user.schoolId?._id || user.schoolId;

    if (
      req.scope.schoolId &&
      user.schoolId?._id.toString() !== req.scope.schoolId.toString()
    ) {
      return res
        .status(403)
        .json({
          message: "Access denied: Cannot manage user from another school",
        });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    if (department !== undefined) user.department = department;
    if (schoolId !== undefined) user.schoolId = schoolId;

    if (role) {
      user.role = role.toLowerCase();
    }

    // The student modal sends groupId on edit. Without this the selection was
    // accepted by the UI and then silently dropped here.
    if (groupId !== undefined) {
      if (!groupId) {
        user.groupId = null;
      } else {
        const Group = (await import("../models/groupModel.js")).default;
        const group = await Group.findById(groupId);
        if (!group) {
          return res.status(400).json({ message: "Invalid group." });
        }
        if (
          req.scope.schoolId &&
          group.schoolId?.toString() !== req.scope.schoolId.toString()
        ) {
          return res
            .status(403)
            .json({ message: "Access denied: group belongs to another school." });
        }
        user.groupId = group._id;
      }
    }

    const updatedUser = await user.save();
    await invalidateUsersCache(updatedUser.schoolId, [
      updatedUser.supervisor,
      previousSupervisor,
    ]);
    if (previousSchoolId?.toString() !== updatedUser.schoolId?.toString()) {
      await invalidateUsersCache(previousSchoolId, [previousSupervisor]);
    }
    res.status(200).json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE USER
router.delete("/:id", protect, checkAccess("manageUsers"), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      req.scope.schoolId &&
      user.schoolId?.toString() !== req.scope.schoolId.toString()
    ) {
      return res
        .status(403)
        .json({
          message: "Access denied: Cannot delete user from another school",
        });
    }

    if (user.role === "school_admin" && user.schoolId) {
      await School.findByIdAndUpdate(user.schoolId, {
        assignedAdmin: { id: null, name: "", email: "" },
      });
    }
    await User.findByIdAndDelete(id);
    await invalidateUsersCache(user.schoolId, [user.supervisor]);
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
