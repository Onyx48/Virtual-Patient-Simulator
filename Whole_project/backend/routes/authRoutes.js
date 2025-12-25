// WHOLE_PROJECT/routes/authRoutes.js
import express from "express";
import { body, validationResult } from "express-validator";
import otpGenerator from "otp-generator";
import User from "../models/userModel.js"; // Path relative to routes folder
import { sendOTPEmail } from "../utils/emailService.js"; // Path relative to routes folder
import redisClient from "../utils/redisClient.js"; // Path relative to routes folder
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"; // <--- FIX: ADDED IMPORT

const router = express.Router();

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_SECONDS || "300", 10);
const MAX_LOGIN_FAIL_ATTEMPTS = parseInt(
  process.env.MAX_OTP_ATTEMPTS || "5",
  10
);
const LOCKOUT_DURATION_SECONDS =
  parseInt(process.env.LOCKOUT_DURATION_MINUTES || "20", 10) * 60;

console.log("authRoutes.js file is being loaded/executed");

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
    console.log(`OTP and attempts for ${lowerEmail} stored in Redis.`);
  } else {
    console.warn(
      `Redis not connected or not ready. OTP for ${lowerEmail}: ${otp} (In-memory/log fallback)`
    );
  }
};

// --- Verify OTP, Handle Attempts and Lockout ---
const verifyOTPAndHandleAttempts = async (email, providedOtp) => {
  const lowerEmail = email.toLowerCase();
  if (!redisClient || redisClient.status !== "ready") {
    console.warn(
      `Redis not connected or not ready. Verifying OTP for ${lowerEmail} via fallback (will fail).`
    );
    return {
      success: false,
      message: "OTP service temporarily unavailable. Please try again later.",
      attemptsLeft: MAX_LOGIN_FAIL_ATTEMPTS,
      lockoutUntil: null,
    };
  }

  const key = `otp:${lowerEmail}`;
  const dataString = await redisClient.get(key);

  if (!dataString) {
    return {
      success: false,
      message:
        "OTP expired, already used, or not found. Please request a new one.",
      attemptsLeft: MAX_LOGIN_FAIL_ATTEMPTS,
      lockoutUntil: null,
    };
  }

  let { otp: storedOtp, attempts } = JSON.parse(dataString);

  if (storedOtp === providedOtp) {
    await redisClient.del(key);
    console.log(
      `OTP for ${lowerEmail} verified successfully and deleted from Redis.`
    );
    return {
      success: true,
      message: "OTP verified successfully.",
      lockoutUntil: null,
    };
  } else {
    attempts += 1;
    let newLockoutUntilTimestamp = null;
    let message = "Invalid OTP.";
    let attemptsLeft = MAX_LOGIN_FAIL_ATTEMPTS - attempts;

    if (attempts >= MAX_LOGIN_FAIL_ATTEMPTS) {
      newLockoutUntilTimestamp =
        new Date().getTime() + LOCKOUT_DURATION_SECONDS * 1000;
      message = `Invalid OTP. Maximum attempts reached. Account locked for ${
        LOCKOUT_DURATION_SECONDS / 60
      } minutes.`;
      attemptsLeft = 0;
      await redisClient.del(key);
      const lockoutKey = `lockout:${lowerEmail}`;
      await redisClient.set(
        lockoutKey,
        newLockoutUntilTimestamp.toString(),
        "EX",
        LOCKOUT_DURATION_SECONDS
      );
      console.log(
        `Account for ${lowerEmail} locked out until ${new Date(
          newLockoutUntilTimestamp
        ).toISOString()}. Lockout key set in Redis.`
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
      } else {
        console.log(
          `OTP for ${lowerEmail} expired during attempt ${attempts}.`
        );
        return {
          success: false,
          message: "OTP expired during verification. Please request a new one.",
          attemptsLeft: MAX_LOGIN_FAIL_ATTEMPTS,
          lockoutUntil: null,
        };
      }
      console.log(
        `Invalid OTP for ${lowerEmail}. Attempt ${attempts} recorded.`
      );
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
// @route   POST /api/auth/register
router.post(
  "/register",
  [
    body("name", "Name is required").notEmpty().trim(),
    body("email", "Please include a valid email").isEmail().normalizeEmail(),
    body("password", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
    // Use the exact lowercase, underscore-separated roles from userModel.js enum
    body(
      "roleToCreate",
      "Role for the new user is required (student, educator, school_admin, or superadmin)"
    ).isIn([
      "student",
      "educator",
      "school_admin",
      "superadmin", // <<< UPDATED FOR VALIDATION
    ]),
  ],
  async (req, res) => {
    console.log(">>> REGISTER ATTEMPT RECEIVED <<<");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Registration validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, roleToCreate } = req.body;
    const { creatorRole } = req.body; // Optional: for admin creating users
    const lowerEmail = email.toLowerCase();
    const lowerRoleToCreate = roleToCreate.toLowerCase(); // Ensure consistency by lowercasing input
    const lowerCreatorRole = creatorRole ? creatorRole.toLowerCase() : null; // Ensure consistency

    try {
      // --- Simulated Authorization for Creation (based on creatorRole) ---
      if (creatorRole) {
        // Only apply this if a creatorRole is explicitly provided
        if (lowerCreatorRole === "superadmin") {
          if (
            lowerRoleToCreate !== "educator" &&
            lowerRoleToCreate !== "school_admin" &&
            lowerRoleToCreate !== "superadmin"
          ) {
            return res.status(403).json({
              message:
                "Superadmin can only create educator, school_admin, or other superadmin accounts.",
            });
          }
        } else if (lowerCreatorRole === "educator") {
          // Assuming 'educator' is what was 'teacher'
          if (lowerRoleToCreate !== "student") {
            return res
              .status(403)
              .json({ message: "Educator can only create student accounts." });
          }
        } else if (lowerCreatorRole === "student") {
          return res.status(403).json({
            message:
              "Students are not authorized to create accounts for others.",
          });
        } else {
          // Handle cases where creatorRole is provided but invalid (e.g., 'invalid_role')
          return res.status(400).json({
            message: `Invalid creator role provided: ${creatorRole}.`,
          });
        }
      } else {
        // No creatorRole provided - implies public registration, only for 'student'
        if (lowerRoleToCreate !== "student") {
          return res.status(403).json({
            message:
              "Public registration is only allowed for student accounts.",
          });
        }
      }
      // --- End Simulated Authorization ---

      const userExists = await User.findOne({ email: lowerEmail });
      if (userExists) {
        console.log(
          `Registration failed: Email "${lowerEmail}" already exists.`
        );
        return res
          .status(400)
          .json({ message: "Email address is already registered." });
      }

      console.log(
        `Registering new user: Name: ${name}, Email: ${lowerEmail}, Role: ${lowerRoleToCreate}`
      );
      const user = new User({
        name,
        email: lowerEmail,
        password, // Hashing occurs via the pre-save hook in userModel
        role: lowerRoleToCreate, // Store the consistent lowercase role
      });
      await user.save();
      console.log(
        `User ${lowerEmail} registered successfully with ID: ${user._id}`
      );

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role, // Return the actual stored role
        message: `User account with role '${user.role}' created successfully.`,
      });
    } catch (err) {
      console.error("Registration Error (Full Error Object):", err);
      if (err.name === "ValidationError") {
        return res
          .status(400)
          .json({ message: "Validation Error", errors: err.errors });
      }
      res.status(500).json({ message: "Server Error during registration" });
    }
  }
);

// @desc    Authenticate user & get user info (Login)
// @route   POST /api/auth/login
router.post(
  "/login",
  [
    body("email", "Please include a valid email").isEmail().normalizeEmail(),
    body("password", "Password is required").exists(),
  ],
  async (req, res) => {
    console.log(">>> LOGIN ATTEMPT RECEIVED <<<");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Login validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    console.log(
      `Attempting login for email: "${email}", password: "${password}" (this password is plain text from client)`
    );
    const lowerEmail = email.toLowerCase();

    try {
      const user = await User.findOne({ email: lowerEmail }).select(
        "+password"
      );

      if (!user) {
        console.log(`Login failed: User not found for email "${lowerEmail}"`);
        return res.status(401).json({ message: "Invalid credentials." });
      }

      console.log(
        `User found in DB: ${user.email}, ID: ${user._id}, Role: ${user.role}`
      );
      console.log(
        `Hashed password from DB for ${user.email}: ${
          user.password ? "Retrieved" : 'MISSING! Check .select("+password")'
        }`
      );
      if (!user.password) {
        console.error(
          "CRITICAL: Password field was not retrieved from the database for the user. Ensure .select('+password') is used and the field exists in the model."
        );
        return res
          .status(500)
          .json({ message: "Server configuration error during login." });
      }

      const isMatch = await user.matchPassword(password);
      console.log(`Plain password sent by client for login: "${password}"`);
      console.log(
        `Password comparison result (isMatch) for ${user.email}: ${isMatch}`
      );

      if (!isMatch) {
        console.log(`Login failed: Password mismatch for user ${user.email}`);
        return res.status(401).json({ message: "Invalid credentials." });
      }

      console.log(`Login successful for user: ${user.email}`);

      // --- FIX: IMPLEMENTED JWT GENERATION ---
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role, // Return the actual stored role (lowercase)
        token: token, // --- FIX: UNCOMMENTED TOKEN IN RESPONSE ---
      });
    } catch (err) {
      console.error("Login Route - Server Error (Full Error Object):", err);
      res.status(500).json({ message: "Server Error during login" });
    }
  }
);

// @desc    Request Password Reset (Send OTP)
// @route   POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  [
    body("email", "Please enter a valid email address")
      .isEmail()
      .normalizeEmail(),
  ],
  async (req, res) => {
    console.log(">>> FORGOT-PASSWORD REQUEST RECEIVED <<<");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Forgot-password validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const lowerEmail = email.toLowerCase();
    console.log(`Forgot password request for email: "${lowerEmail}"`);

    try {
      if (redisClient && redisClient.status === "ready") {
        const lockoutKey = `lockout:${lowerEmail}`;
        const lockoutData = await redisClient.get(lockoutKey);
        if (lockoutData) {
          const lockoutEndTime = parseInt(lockoutData, 10);
          const remainingLockoutTime = Math.max(
            0,
            Math.ceil((lockoutEndTime - new Date().getTime()) / 1000)
          );
          if (remainingLockoutTime > 0) {
            console.log(
              `Account ${lowerEmail} is locked out. Remaining time: ${remainingLockoutTime}s`
            );
            return res.status(429).json({
              message: `Account is temporarily locked. Please try again in ${Math.ceil(
                remainingLockoutTime / 60
              )} minutes.`,
              lockoutUntil: lockoutEndTime,
            });
          } else {
            console.log(
              `Lockout for ${lowerEmail} expired. Removing lockout key.`
            );
            await redisClient.del(lockoutKey);
          }
        }
      } else {
        console.warn(
          "Redis not connected or not ready, cannot check for lockout status for forgot-password."
        );
      }

      const user = await User.findOne({ email: lowerEmail });
      if (!user) {
        console.log(
          `Forgot password attempt for non-existent email: ${lowerEmail}. Sending generic success message.`
        );
        return res.status(200).json({
          message: "If an account with this email exists, an OTP will be sent.",
        });
      }
      console.log(
        `User ${lowerEmail} found for forgot password. Generating OTP.`
      );

      const otp = generateOTP();
      await storeOTPAndAttempts(lowerEmail, otp);
      const emailSent = await sendOTPEmail(lowerEmail, otp);

      if (emailSent) {
        console.log(`OTP email successfully sent to ${lowerEmail}.`);
        res.status(200).json({
          message: `An OTP has been sent to ${email}. Please check your inbox.`,
        });
      } else {
        console.error(`Failed to send OTP email to ${lowerEmail}.`);
        res
          .status(500)
          .json({ message: "Failed to send OTP email. Please try again." });
      }
    } catch (error) {
      console.error(
        "Forgot Password Route - Server Error (Full Error Object):",
        error
      );
      res
        .status(500)
        .json({ message: "Server error during password reset request." });
    }
  }
);

// @desc    Verify OTP for Password Reset
// @route   POST /api/auth/verify-otp
router.post(
  "/verify-otp",
  [
    body("email", "Email is required").isEmail().normalizeEmail(),
    body("otp", "OTP must be a 6-digit number")
      .isLength({ min: 6, max: 6 })
      .isNumeric(),
  ],
  async (req, res) => {
    console.log(">>> VERIFY-OTP REQUEST RECEIVED <<<");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Verify-OTP validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, otp } = req.body;
    const lowerEmail = email.toLowerCase();
    console.log(`Verifying OTP for email: "${lowerEmail}", OTP: "${otp}"`);

    try {
      if (redisClient && redisClient.status === "ready") {
        const lockoutKey = `lockout:${lowerEmail}`;
        const lockoutData = await redisClient.get(lockoutKey);
        if (lockoutData) {
          const lockoutEndTime = parseInt(lockoutData, 10);
          const remainingLockoutTime = Math.max(
            0,
            Math.ceil((lockoutEndTime - new Date().getTime()) / 1000)
          );
          if (remainingLockoutTime > 0) {
            console.log(
              `Account ${lowerEmail} is locked out during OTP verification. Remaining time: ${remainingLockoutTime}s`
            );
            return res.status(429).json({
              message: `Account is temporarily locked. Please try again in ${Math.ceil(
                remainingLockoutTime / 60
              )} minutes.`,
              lockoutUntil: lockoutEndTime,
              canResetPassword: false,
            });
          } else {
            console.log(
              `Lockout for ${lowerEmail} expired before OTP verification. Removing lockout key.`
            );
            await redisClient.del(lockoutKey);
          }
        }
      } else {
        console.warn(
          "Redis not connected or not ready, cannot check for lockout status for verify-otp."
        );
      }

      const verificationResult = await verifyOTPAndHandleAttempts(
        lowerEmail,
        otp
      );
      console.log(
        `OTP verification result for ${lowerEmail}:`,
        verificationResult
      );

      if (verificationResult.success) {
        res.status(200).json({
          message: verificationResult.message,
          canResetPassword: true,
        });
      } else {
        const statusCode = verificationResult.lockoutUntil ? 429 : 400;
        res.status(statusCode).json({
          message: verificationResult.message,
          attemptsLeft: verificationResult.attemptsLeft,
          canResetPassword: false,
          lockoutUntil: verificationResult.lockoutUntil,
        });
      }
    } catch (error) {
      console.error(
        "Verify OTP Route - Server Error (Full Error Object):",
        error
      );
      res
        .status(500)
        .json({ message: "Server error during OTP verification." });
    }
  }
);

// @desc    Reset Password after OTP verification
// @route   POST /api/auth/reset-password
router.post(
  "/reset-password",
  [
    body("email", "Email is required").isEmail().normalizeEmail(),
    body("newPassword", "New password must be at least 6 characters").isLength({
      min: 6,
    }),
  ],
  async (req, res) => {
    console.log(">>> RESET-PASSWORD REQUEST RECEIVED <<<");
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Reset-password validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, newPassword } = req.body;
    const lowerEmail = email.toLowerCase();
    console.log(`Reset password attempt for email: "${lowerEmail}"`);

    try {
      const user = await User.findOne({ email: lowerEmail });
      if (!user) {
        console.log(
          `Reset password failed: User not found for email "${lowerEmail}"`
        );
        return res
          .status(404)
          .json({ message: "User not found. Cannot reset password." });
      }

      if (redisClient && redisClient.status === "ready") {
        const lockoutKey = `lockout:${lowerEmail}`;
        if (await redisClient.get(lockoutKey)) {
          console.log(
            `Attempt to reset password while account ${lowerEmail} is locked out.`
          );
          return res.status(429).json({
            message: "Account is locked. Cannot reset password at this time.",
          });
        }
      }

      user.password = newPassword;
      await user.save();
      console.log(
        `Password for ${lowerEmail} has been successfully reset and saved.`
      );

      res.status(200).json({
        message:
          "Password has been reset successfully. You can now log in with your new password.",
      });
    } catch (error) {
      console.error(
        "Reset Password Route - Server Error (Full Error Object):",
        error
      );
      res.status(500).json({ message: "Server error during password reset." });
    }
  }
);

export default router;
