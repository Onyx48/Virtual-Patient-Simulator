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
  [
    body("name", "Name is required").notEmpty().trim(),
    body("email", "Please include a valid email").isEmail().normalizeEmail(),
    body("password", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
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
    console.log("[REGISTER] Route hit. Body:", req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[REGISTER] Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, roleToCreate, creatorRole, schoolId } =
      req.body;
    const lowerEmail = email.toLowerCase();
    const lowerRoleToCreate = roleToCreate.toLowerCase();

    try {
      // Authorization Check
      if (creatorRole) {
        const lowerCreatorRole = creatorRole.toLowerCase();
        const allowedCreations = {
          superadmin: ["school_admin"],
          school_admin: ["educator", "student"],
          educator: ["student"],
        };

        if (!allowedCreations[lowerCreatorRole]?.includes(lowerRoleToCreate)) {
          return res.status(403).json({
            message: `${creatorRole} cannot create ${roleToCreate} role.`,
          });
        }
      } else if (lowerRoleToCreate !== "student") {
        return res.status(403).json({
          message: "Public registration is only for students.",
        });
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
        console.log("[AUTH] Welcome email skipped (temporarily disabled)");
      }

      console.log("[AUTH] Welcome email skipped (temporarily disabled)");

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
    body("email", "Please include a valid email").isEmail().normalizeEmail(),
    body("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const lowerEmail = email.toLowerCase();

    try {
      const user = await User.findOne({ email: lowerEmail }).select(
        "+password",
      );

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

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
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
  [body("email").isEmail().normalizeEmail()],
  async (req, res) => {
    const { email } = req.body;
    const lowerEmail = email.toLowerCase();

    try {
      const user = await User.findOne({ email: lowerEmail });
      if (!user)
        return res
          .status(200)
          .json({ message: "If account exists, OTP sent." });

      const otp = generateOTP();
      await storeOTPAndAttempts(lowerEmail, otp);
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
    body("email").isEmail().normalizeEmail(),
    body("otp").isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  async (req, res) => {
    const { email, otp } = req.body;
    try {
      const result = await verifyOTPAndHandleAttempts(email, otp);
      if (result.success) {
        res
          .status(200)
          .json({ message: result.message, canResetPassword: true });
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
    body("email").isEmail().normalizeEmail(),
    body("newPassword").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const { email, newPassword } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found." });

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
  [
    body("name", "Name is required").optional().notEmpty().trim(),
    body("phoneNumber").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phoneNumber } = req.body;
    const userId = req.user.id;

    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (name !== undefined) user.name = name;
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
    body("newEmail", "Valid email is required").isEmail().normalizeEmail(),
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
    body("newPassword", "New password must be at least 6 characters").isLength({
      min: 6,
    }),
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
