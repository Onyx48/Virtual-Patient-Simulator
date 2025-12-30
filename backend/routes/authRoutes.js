// WHOLE_PROJECT/routes/authRoutes.js
import express from "express";
import { body, validationResult } from "express-validator";
import otpGenerator from "otp-generator";
import User from "../models/userModel.js";
import { sendOTPEmail } from "../utils/emailService.js";
import redisClient from "../utils/redisClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_SECONDS || "300", 10);
const MAX_LOGIN_FAIL_ATTEMPTS = parseInt(
  process.env.MAX_OTP_ATTEMPTS || "5",
  10
);
const LOCKOUT_DURATION_SECONDS =
  parseInt(process.env.LOCKOUT_DURATION_MINUTES || "20", 10) * 60;

// --- Helper function to generate OTP ---
const generateOTP = () => {
  return otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
};

// --- Store OTP and Attempt Info in Redis ---
const storeOTPAndAttempts = async (email, otp) => {
  const lowerEmail = email.toLowerCase();
  if (redisClient && redisClient.status === "ready") {
    const key = `otp:${lowerEmail}`;
    await redisClient.set(
      key,
      JSON.stringify({ otp, attempts: 0 }),
      "EX",
      OTP_EXPIRY
    );
  }
};

// --- Verify OTP, Handle Attempts and Lockout ---
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
        LOCKOUT_DURATION_SECONDS
      );
    } else {
      const ttl = await redisClient.ttl(key);
      if (ttl > 0) {
        await redisClient.set(
          key,
          JSON.stringify({ otp: storedOtp, attempts }),
          "EX",
          ttl
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

// @desc    Register/Create a new user account
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
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { name, email, password, roleToCreate, creatorRole, schoolId } = req.body;
    const lowerEmail = email.toLowerCase();
    const lowerRoleToCreate = roleToCreate.toLowerCase();

    try {
      // Authorization Check
      if (creatorRole) {
        const lowerCreatorRole = creatorRole.toLowerCase();
        const allowedCreations = {
          superadmin: ["school_admin"],
          school_admin: ["educator", "student"],
          educator: ["student"]
        };

        if (!allowedCreations[lowerCreatorRole]?.includes(lowerRoleToCreate)) {
          return res.status(403).json({
            message: `${creatorRole} cannot create ${roleToCreate} role.`
          });
        }
      } else if (lowerRoleToCreate !== "student") {
        return res.status(403).json({
          message: "Public registration is only for students."
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
  }
);

// @desc    Authenticate user & get user info (Login)
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
        "+password"
      );

      if (!user)
        return res.status(401).json({ message: "Invalid credentials." });

      const isMatch = await user.matchPassword(password);
      if (!isMatch)
        return res.status(401).json({ message: "Invalid credentials." });

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        token: token,
      });
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ message: "Server Error" });
    }
  }
);

// @desc    Request Password Reset
router.post(
  "/forgot-password",
  [body("email").isEmail().normalizeEmail()],
  async (req, res) => {
    const { email } = req.body;
    const lowerEmail = email.toLowerCase();

    try {
      // Check Redis for lockout (omitted for brevity, assume similar logic to login)
      const user = await User.findOne({ email: lowerEmail });
      if (!user)
        return res
          .status(200)
          .json({ message: "If account exists, OTP sent." });

      const otp = generateOTP();
      await storeOTPAndAttempts(lowerEmail, otp);
      await sendOTPEmail(lowerEmail, otp);

      res.status(200).json({ message: "OTP sent." });
    } catch (error) {
      console.error("Forgot Password Error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  }
);

// @desc    Verify OTP
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
  }
);

// @desc    Reset Password
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
  }
);

export default router;
