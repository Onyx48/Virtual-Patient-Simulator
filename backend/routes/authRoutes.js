import express from "express";
import { body, validationResult } from "express-validator";
import otpGenerator from "otp-generator";
import User from "../models/userModel.js";
import { sendOTPEmail } from "../utils/emailService.js";
import redisClient from "../utils/redisClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import { protect } from "../middleware/authMiddleware.js";
import { sendWelcomeEmail } from "../utils/emailService.js";
import { canonicalizeEmail, findUserByEmail } from "../utils/emailLookup.js";
import { capture } from "../utils/analytics.js";
import { passwordValidator } from "../utils/passwordPolicy.js";

/*
 * protect, but only when a token is sent: /register serves both anonymous
 * student signup and logged-in staff creating accounts. A token that is sent
 * but invalid is still rejected, so a bad token never downgrades to anonymous.
 */
const optionalProtect = (req, res, next) =>
  req.headers.authorization?.startsWith("Bearer") ? protect(req, res, next) : next();

// Who may create whom. The creator is always req.user, never the request body.
const ALLOWED_CREATIONS = {
  superadmin: ["school_admin", "educator", "student"],
  school_admin: ["educator", "student"],
  educator: ["student"],
};

// A short-lived, single-use password reset token, issued by /verify-otp.
// Signed with the user's current password hash, so it stops working the
// moment the password changes (i.e. after one successful reset).
const RESET_TOKEN_MINUTES = 10;
const resetSecret = (user) => `${process.env.JWT_SECRET}:reset:${user.password}`;

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: fileFilter,
});

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_SECONDS || "300", 10);
const MAX_LOGIN_FAIL_ATTEMPTS = parseInt(
  process.env.MAX_OTP_ATTEMPTS || "5",
  10,
);
const LOCKOUT_DURATION_SECONDS =
  parseInt(process.env.LOCKOUT_DURATION_MINUTES || "20", 10) * 60;

const generateOTP = () => {
  return otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
};

const storeOTPAndAttempts = async (email, otp) => {
  const lowerEmail = email.toLowerCase();
  if (redisClient && redisClient.status === "ready") {
    const key = `otp:${lowerEmail}`;
    await redisClient.set(
      key,
      JSON.stringify({ otp, attempts: 0 }),
      "EX",
      OTP_EXPIRY,
    );
  }
};

const verifyOTPAndHandleAttempts = async (email, providedOtp) => {
  const lowerEmail = email.toLowerCase();
  if (!redisClient || redisClient.status !== "ready") {
    return {
      success: false,
      message: "OTP service temporarily unavailable.",
      attemptsLeft: MAX_LOGIN_FAIL_ATTEMPTS,
      lockoutUntil: null,
    };
  }

  const key = `otp:${lowerEmail}`;
  const dataString = await redisClient.get(key);

  if (!dataString) {
    return {
      success: false,
      message: "OTP expired or invalid.",
      attemptsLeft: MAX_LOGIN_FAIL_ATTEMPTS,
      lockoutUntil: null,
    };
  }

  let { otp: storedOtp, attempts } = JSON.parse(dataString);

  if (storedOtp === providedOtp) {
    await redisClient.del(key);
    return { success: true, message: "OTP verified.", lockoutUntil: null };
  } else {
    attempts += 1;
    let newLockoutUntilTimestamp = null;
    let message = "Invalid OTP.";
    let attemptsLeft = MAX_LOGIN_FAIL_ATTEMPTS - attempts;

    if (attempts >= MAX_LOGIN_FAIL_ATTEMPTS) {
      newLockoutUntilTimestamp =
        new Date().getTime() + LOCKOUT_DURATION_SECONDS * 1000;
      message = `Account locked for ${LOCKOUT_DURATION_SECONDS / 60} minutes.`;
      attemptsLeft = 0;
      await redisClient.del(key);
      const lockoutKey = `lockout:${lowerEmail}`;
      await redisClient.set(
        lockoutKey,
        newLockoutUntilTimestamp.toString(),
        "EX",
        LOCKOUT_DURATION_SECONDS,
      );
    } else {
      const ttl = await redisClient.ttl(key);
      if (ttl > 0) {
        await redisClient.set(
          key,
          JSON.stringify({ otp: storedOtp, attempts }),
          "EX",
          ttl,
        );
      }
    }
    return {
      success: false,
      message,
      attemptsLeft,
      lockoutUntil: newLockoutUntilTimestamp,
    };
  }
};

router.post(
  "/register",
  optionalProtect,
  [
    body("name", "Name is required").notEmpty().trim(),
    body("email", "Please include a valid email").isEmail().trim(),
    body("password").custom(passwordValidator("email")),
    body("roleToCreate").isIn([
      "student",
      "educator",
      "school_admin",
      "superadmin",
    ]),
    body("schoolId")
      .if(body("roleToCreate").isIn(["educator", "school_admin"]))
      .notEmpty()
      .withMessage("School ID is required for educators and school admins")
      .isMongoId()
      .withMessage("Invalid School ID"),
  ],
  async (req, res) => {
    // Never log the body: it carries the plaintext password.
    console.log("[REGISTER] Route hit for role:", req.body?.roleToCreate);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[REGISTER] Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    // creatorRole in the body is ignored: it used to be trusted, which let an
    // anonymous caller create a superadmin.
    const { name, email, password, roleToCreate } = req.body;
    let { schoolId } = req.body;
    const creator = req.user || null;
    const creatorRole = creator?.role || null;
    const lowerEmail = canonicalizeEmail(email);
    const lowerRoleToCreate = roleToCreate.toLowerCase();

    try {
      // Authorization Check
      if (creatorRole) {
        if (!ALLOWED_CREATIONS[creatorRole]?.includes(lowerRoleToCreate)) {
          return res.status(403).json({
            message: `${creatorRole} cannot create ${roleToCreate} role.`,
          });
        }
        // Below superadmin, accounts land in the creator's own school only.
        if (creatorRole !== "superadmin") {
          schoolId = creator.schoolId?._id || creator.schoolId || undefined;
        }
      } else {
        if (lowerRoleToCreate !== "student") {
          return res.status(403).json({
            message: "Public registration is only for students.",
          });
        }
        // An anonymous signup cannot attach itself to a school.
        schoolId = undefined;
      }

      const userExists = await User.findOne({ email: lowerEmail });
      if (userExists) {
        return res.status(400).json({ message: "Email already exists." });
      }

      const user = new User({
        name,
        email: lowerEmail,
        password,
        role: lowerRoleToCreate,
        ...(schoolId && { schoolId }),
      });
      await user.save();
      if (creatorRole) {
        try {
          await sendWelcomeEmail({ toEmail: lowerEmail, name, password });
        } catch (emailErr) {
          console.error("[AUTH] Failed to send welcome email for:", lowerEmail, emailErr);
        }
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        message: "User created successfully.",
      });
    } catch (err) {
      console.error("Registration Error:", err);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.post(
  "/login",
  [
    body("email", "Please include a valid email").isEmail().trim(),
    body("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = await findUserByEmail(email, "+password");

      if (!user)
        return res.status(401).json({ message: "Invalid credentials." });

      const isMatch = await user.matchPassword(password);
      if (!isMatch)
        return res.status(401).json({ message: "Invalid credentials." });

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      );

      /*
       * Stamped without awaiting and without failing the login: this only feeds
       * the roster's invite status, and a write error here must not stop someone
       * with correct credentials from getting in.
       */
      User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } })
        .catch((err) => console.error("[AUTH] lastLoginAt update failed:", err.message));
      capture(user._id, "user_logged_in", { role: user.role });

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        // Needed by the student UI to recognise a scenario assigned to their
        // group rather than to them individually (src/lib/assignment.js).
        groupId: user.groupId,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
        token: token,
      });
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.post(
  "/forgot-password",
  [body("email").isEmail().trim()],
  async (req, res) => {
    const { email } = req.body;

    try {
      const user = await findUserByEmail(email);
      if (!user)
        return res
          .status(200)
          .json({ message: "If account exists, OTP sent." });

      // Key the OTP on the address as stored, not as typed, so verify-otp can
      // arrive at the same key from a differently-cased/dotted spelling.
      const otp = generateOTP();
      await storeOTPAndAttempts(user.email, otp);
      console.log("[AUTH] OTP email skipped (temporarily disabled). OTP:", otp);

      res.status(200).json({ message: "OTP sent." });
    } catch (error) {
      console.error("Forgot Password Error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.post(
  "/verify-otp",
  [
    body("email").isEmail().trim(),
    body("otp").isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  async (req, res) => {
    const { email, otp } = req.body;
    try {
      const user = await findUserByEmail(email);
      if (!user) return res.status(400).json({ message: "Invalid OTP." });

      const result = await verifyOTPAndHandleAttempts(user.email, otp);
      if (result.success) {
        const resetToken = jwt.sign(
          { id: String(user._id), purpose: "password-reset" },
          resetSecret(await findUserByEmail(email, "+password")),
          { expiresIn: `${RESET_TOKEN_MINUTES}m` },
        );
        res
          .status(200)
          .json({ message: result.message, canResetPassword: true, resetToken });
      } else {
        res.status(result.lockoutUntil ? 429 : 400).json(result);
      }
    } catch (error) {
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.post(
  "/reset-password",
  [
    body("email").isEmail().trim(),
    body("newPassword").custom(passwordValidator("email")),
    body("resetToken", "Reset token is required").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const { email, newPassword, resetToken } = req.body;
    // One answer for every failure, so this cannot be used to probe accounts.
    const invalid = () =>
      res.status(400).json({ message: "This reset link is invalid or has expired. Request a new code." });
    try {
      // Used to accept any email with no proof of the OTP: an account takeover.
      const user = await findUserByEmail(email, "+password");
      if (!user) return invalid();
      try {
        const claims = jwt.verify(String(resetToken), resetSecret(user));
        if (claims.purpose !== "password-reset" || claims.id !== String(user._id)) return invalid();
      } catch {
        return invalid();
      }

      user.password = newPassword;
      await user.save();
      res.status(200).json({ message: "Password reset successfully." });
    } catch (error) {
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.put(
  "/profile",
  protect,
  [body("phoneNumber").optional().trim()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    /*
     * `name` is deliberately not read from the body. Nobody renames themselves:
     * the name is what identifies a student on an educator's roster and what a
     * recorded session is attributed to, so a self-service rename silently
     * breaks the link a human uses to find their own students. An administrator
     * renames an account through PUT /api/users/:id, which is scope-checked.
     * A body carrying `name` is ignored rather than rejected, so an older
     * frontend build still saves its phone number.
     */
    const { phoneNumber } = req.body;
    const userId = req.user.id;

    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

      await user.save();

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.put(
  "/change-email",
  protect,
  [
    body("newEmail", "Valid email is required").isEmail().trim(),
    body("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { newEmail, password } = req.body;
    const userId = req.user.id;
    const lowerNewEmail = newEmail.toLowerCase();

    try {
      const user = await User.findById(userId).select("+password");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: "Incorrect password" });
      }

      // Check if new email is already taken
      const existingUser = await User.findOne({ email: lowerNewEmail });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({ message: "Email already in use" });
      }

      user.email = lowerNewEmail;
      await user.save();

      res.json({
        message: "Email updated successfully",
        email: user.email,
      });
    } catch (error) {
      console.error("Change email error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.put(
  "/change-password",
  protect,
  [
    body("currentPassword", "Current password is required").exists(),
    body("newPassword").custom(passwordValidator("email")),
    body("confirmPassword", "Confirm password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    try {
      const user = await User.findById(userId).select("+password");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: "Incorrect current password" });
      }

      user.password = newPassword;
      await user.save();

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.post(
  "/upload-profile-picture",
  protect,
  upload.single("profilePicture"),
  async (req, res) => {
    const userId = req.user.id;

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.profilePicture = `/uploads/${req.file.filename}`;
      await user.save();

      res.json({
        message: "Profile picture updated successfully",
        profilePicture: user.profilePicture,
      });
    } catch (error) {
      console.error("Upload profile picture error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.delete("/profile-picture", protect, async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.profilePicture = null;
    await user.save();

    res.json({
      message: "Profile picture removed successfully",
    });
  } catch (error) {
    console.error("Remove profile picture error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;
