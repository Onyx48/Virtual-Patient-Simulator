// WHOLE_PROJECT/routes/schoolRoutes.js
import express from "express";
import { body, validationResult } from "express-validator";
import School from "../models/schoolModel.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Session from "../models/sessionModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import { sendSchoolInviteEmail } from "../utils/emailService.js";
import { canonicalizeEmail, findUserByEmail } from "../utils/emailLookup.js";
import { isProd, publicMessage } from "../utils/appEnv.js";
import crypto from "crypto";

const router = express.Router();

const parseDateString = (dateString) => {
  if (!dateString) return null;
  const [day, month, year] = dateString.split("/").map(Number);
  return new Date(year, month - 1, day);
};

const schoolValidationRules = [
  body("schoolName", "School Name is required").notEmpty().trim(),
  body("email", "Please enter a valid email address")
    .isEmail()
    .normalizeEmail(),
  body("description", "Description is required").notEmpty().trim(),
  body("subscriptionType", "Invalid Subscription Type").isIn([
    "Premium",
    "Basic",
    "Free",
  ]),
  body("duration", "Invalid Duration").optional().isIn(["1 Year", "6 Months"]),
  body("startDate", "Start Date is required")
    .isString()
    .custom((value) => {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value))
        throw new Error("Start Date must be DD/MM/YYYY");
      if (!isNaN(parseDateString(value).getTime())) return true;
      throw new Error("Invalid Start Date");
    }),
  body("expireDate", "Expire Date is required")
    .isString()
    .custom((value) => {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value))
        throw new Error("Expire Date must be DD/MM/YYYY");
      if (!isNaN(parseDateString(value).getTime())) return true;
      throw new Error("Invalid Expire Date");
    }),
  body("expireDate").custom((expireDate, { req }) => {
    const startDate = parseDateString(req.body.startDate);
    const endDate = parseDateString(expireDate);
    if (startDate && endDate && endDate < startDate) {
      throw new Error("Expire Date must be on or after Start Date.");
    }
    return true;
  }),
  body("status", "Invalid Status").isIn(["Active", "Expired", "Pending"]),
  body("permissions", "Invalid Permissions").isIn([
    "Read Only",
    "Write Only",
    "Both",
  ]),
];

router.get("/", protect, checkAccess("viewSchools"), async (req, res) => {
  try {
    let query = {};
    const {
      status,
      subscription,
      permissions,
      startDateAfter,
      expireDateBefore,
      searchTerm,
      availableForSchoolAdmin,
    } = req.query;

    if (status) query.status = status;
    if (subscription) query.subscription = subscription;
    if (permissions) query.permissions = permissions;

    if (startDateAfter) {
      const date = parseDateString(startDateAfter);
      if (date) query.startDate = { $gte: date };
    }
    if (expireDateBefore) {
      const date = parseDateString(expireDateBefore);
      if (date) query.expireDate = { $lte: date };
    }

    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, "i");
      query.$or = [
        { schoolName: searchRegex },
        { email: searchRegex },
        { description: searchRegex },
      ];
    }

    if (availableForSchoolAdmin === "true") {
      query["assignedAdmin.id"] = null;
    }

    const schools = await School.find(query).sort({ schoolName: 1 });
    res.json(schools);
  } catch (err) {
    console.error("Get Schools Error:", err);
    res.status(500).json({ message: "Server error fetching schools." });
  }
});

router.get("/:id", protect, checkAccess("viewSchools"), async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).json({ message: "School not found." });
    }
    res.json(school);
  } catch (err) {
    console.error("Get School by ID Error:", err);
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ message: "School not found (Invalid ID)." });
    }
    res.status(500).json({ message: "Server error fetching school." });
  }
});

router.post(
  "/",
  protect,
  checkAccess("manageSchools"),
  schoolValidationRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      schoolName,
      description,
      email,
      subscriptionType,
      duration,
      startDate,
      expireDate,
      status,
      permissions,
    } = req.body;

    try {
      const newSchool = new School({
        schoolName,
        description,
        email,
        subscriptionType,
        duration,
        startDate: parseDateString(startDate),
        expireDate: parseDateString(expireDate),
        status,
        permissions,
        subscription: duration ? `Subscription (${duration})` : "",
        timeSpent: "0h",
      });

      await newSchool.save();
      res
        .status(201)
        .json({ message: "School added successfully.", school: newSchool });
    } catch (err) {
      console.error("Create School Error:", err);
      if (err.code === 11000) {
        return res
          .status(400)
          .json({ message: "School with this name or email already exists." });
      }
      if (err.name === "ValidationError") {
        const validationMessages = Object.values(err.errors)
          .map((e) => e.message)
          .join("; ");
        return res.status(400).json({ message: validationMessages });
      }
      res.status(500).json({ message: "Server error creating school." });
    }
  },
);

router.put(
  "/:id",
  protect,
  checkAccess("manageSchools"),
  schoolValidationRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      schoolName,
      description,
      email,
      subscriptionType,
      duration,
      startDate,
      expireDate,
      status,
      permissions,
    } = req.body;

    try {
      const school = await School.findById(req.params.id);
      if (!school) {
        return res.status(404).json({ message: "School not found." });
      }

      school.schoolName = schoolName;
      school.description = description;
      school.email = email;
      school.subscriptionType = subscriptionType;
      school.duration = duration;
      school.startDate = parseDateString(startDate);
      school.expireDate = parseDateString(expireDate);
      school.status = status;
      school.permissions = permissions;
      school.subscription = duration ? `Subscription (${duration})` : "";

      await school.save();
      res
        .status(200)
        .json({ message: "School updated successfully.", school: school });
    } catch (err) {
      console.error("Update School Error:", err);
      if (err.code === 11000) {
        return res.status(400).json({
          message: "Another school with this name or email already exists.",
        });
      }
      if (err.name === "ValidationError") {
        const validationMessages = Object.values(err.errors)
          .map((e) => e.message)
          .join("; ");
        return res.status(400).json({ message: validationMessages });
      }
      res.status(500).json({ message: "Server error updating school." });
    }
  },
);

/**
 * Send (or re-send) the org admin's login credentials.
 *
 * Stored passwords are bcrypt hashes and cannot be read back, so there is no
 * existing password to re-send: every click generates a new one and replaces
 * the old. When the school has no admin yet, one is created from the school's
 * own email address.
 *
 * The mail goes out BEFORE anything is persisted, so a send failure (e.g. SES
 * not configured) leaves no rotated password and no half-created account.
 */
router.post(
  "/:id/invite",
  protect,
  checkAccess("manageSchools"),
  async (req, res) => {
    try {
      const school = await School.findById(req.params.id);
      if (!school) {
        return res.status(404).json({ message: "School not found." });
      }

      const newPassword = crypto.randomBytes(8).toString("hex");
      let adminUser = null;

      if (school.assignedAdmin?.id) {
        adminUser = await User.findById(school.assignedAdmin.id);
        if (!adminUser) {
          // The stored reference is dangling; fall through and re-create below.
          school.assignedAdmin = { id: null, name: "", email: "" };
        }
      }

      let recipient;
      let adminName;
      const isResend = Boolean(adminUser);

      if (adminUser) {
        recipient = adminUser.email;
        adminName = adminUser.name;
      } else {
        // No admin yet: the school's own address becomes the login id.
        recipient = canonicalizeEmail(school.email);
        adminName = `${school.schoolName} Admin`;

        const clash = await findUserByEmail(recipient);
        if (clash) {
          if (
            clash.role !== "school_admin" ||
            (clash.schoolId && String(clash.schoolId) !== String(school._id))
          ) {
            return res.status(409).json({
              message:
                `${recipient} already belongs to a ${clash.role} account. ` +
                `Assign a school admin to this school first.`,
            });
          }
          // An orphaned school_admin for this same school — adopt it.
          adminUser = clash;
          adminName = clash.name;
        }
      }

      // 1. Mail first. Throws if SES is unconfigured or the send is rejected.
      await sendSchoolInviteEmail({
        toEmail: recipient,
        adminName,
        schoolName: school.schoolName,
        password: newPassword,
        isResend,
      });

      // 2. Only now change state.
      if (adminUser) {
        adminUser.password = newPassword; // hashed by the pre-save hook
        await adminUser.save();
      } else {
        adminUser = await User.create({
          name: adminName,
          email: recipient,
          password: newPassword, // hashed by the pre-save hook
          role: "school_admin",
          schoolId: school._id,
        });
      }

      school.assignedAdmin = {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
      };
      school.inviteStatus = "invited";
      school.inviteSentAt = new Date();
      school.inviteSentTo = recipient;
      await school.save();

      res.status(200).json({
        message: isResend
          ? `New password sent to ${recipient}.`
          : `Invite sent to ${recipient}.`,
        school,
      });
    } catch (err) {
      if (err.code === "MAIL_NOT_CONFIGURED") {
        // Always logged in full; only echoed to the client outside production.
        console.error("Invite Error:", err.message);
        return res.status(503).json({
          message: publicMessage(
            err,
            "Email is not available right now. Please contact your administrator.",
          ),
        });
      }
      console.error("Invite Error:", err);
      if (err.kind === "ObjectId") {
        return res
          .status(404)
          .json({ message: "School not found (Invalid ID)." });
      }
      res.status(502).json({
        message: isProd
          ? "Could not send the email. Please try again later."
          : `Could not send the email: ${err.message}`,
      });
    }
  },
);

router.delete(
  "/:id",
  protect,
  checkAccess("manageSchools"),
  async (req, res) => {
    try {
      const school = await School.findById(req.params.id);
      if (!school) {
        return res.status(404).json({ message: "School not found." });
      }

      const schoolId = req.params.id;

      await User.deleteMany({
        schoolId: schoolId,
        role: { $ne: "superadmin" },
      });

      await Student.deleteMany({ schoolId: schoolId });

      await Session.deleteMany({ schoolId: schoolId });

      // Finally delete the school
      await School.findByIdAndDelete(schoolId);

      res
        .status(200)
        .json({ message: "School and all related data deleted successfully." });
    } catch (err) {
      console.error("Delete School Error:", err);
      if (err.kind === "ObjectId") {
        return res
          .status(404)
          .json({ message: "School not found (Invalid ID)." });
      }
      res.status(500).json({ message: "Server error deleting school." });
    }
  },
);

export default router;
