// WHOLE_PROJECT/routes/schoolRoutes.js
import express from "express";
import { body, validationResult } from "express-validator";
import School from "../models/schoolModel.js"; // Adjust path
import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js"; // Adjust path

const router = express.Router();

// Helper to parse DD/MM/YYYY string to Date object
const parseDateString = (dateString) => {
  if (!dateString) return null;
  const [day, month, year] = dateString.split("/").map(Number);
  return new Date(year, month - 1, day); // Month is 0-indexed in Date constructor
};

// --- Validation Middleware ---
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
  body("duration", "Invalid Duration").optional().isIn(["1 Year", "6 Months"]), // Adjust based on your options
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
  // Custom validator to ensure expireDate is after startDate
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

// --- Routes ---

// @desc    Get all schools (with optional filters)
// @route   GET /api/schools
// @access  Private (Superadmin, Educator, School Admin)
router.get(
  "/",
  protect,
  authorize("superadmin", "educator", "school_admin"),
  async (req, res) => {
    try {
      let query = {};
      // Implement filters if passed in query params (e.g., /api/schools?status=Active)
      const {
        status,
        subscription,
        permissions,
        startDateAfter,
        expireDateBefore,
        searchTerm,
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
        const searchRegex = new RegExp(searchTerm, "i"); // Case-insensitive search
        query.$or = [
          { schoolName: searchRegex },
          { email: searchRegex },
          { description: searchRegex },
        ];
      }

      const schools = await School.find(query).sort({ schoolName: 1 }); // Sort by name by default
      res.json(schools);
    } catch (err) {
      console.error("Get Schools Error:", err);
      res.status(500).json({ message: "Server error fetching schools." });
    }
  }
);

// @desc    Get single school by ID
// @route   GET /api/schools/:id
// @access  Private (Superadmin, Educator, School Admin)
router.get(
  "/:id",
  protect,
  authorize("superadmin", "educator", "school_admin"),
  async (req, res) => {
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
  }
);

// @desc    Create a new school
// @route   POST /api/schools
// @access  Private (Superadmin only)
router.post(
  "/",
  protect,
  authorize("superadmin"),
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
        // Convert date strings to Date objects for storage
        startDate: parseDateString(startDate),
        expireDate: parseDateString(expireDate),
        status,
        permissions,
        subscription: duration ? `Subscription (${duration})` : "", // Ensure consistency with frontend format
        timeSpent: "0h", // Default value for new schools
      });

      await newSchool.save();
      res
        .status(201)
        .json({ message: "School added successfully.", school: newSchool });
    } catch (err) {
      console.error("Create School Error:", err);
      if (err.code === 11000) {
        // Duplicate key error (e.g., schoolName or email)
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
  }
);

// @desc    Update a school
// @route   PUT /api/schools/:id
// @access  Private (Superadmin only)
router.put(
  "/:id",
  protect,
  authorize("superadmin"),
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

      // Update fields
      school.schoolName = schoolName;
      school.description = description;
      school.email = email;
      school.subscriptionType = subscriptionType;
      school.duration = duration;
      school.startDate = parseDateString(startDate);
      school.expireDate = parseDateString(expireDate);
      school.status = status;
      school.permissions = permissions;
      school.subscription = duration ? `Subscription (${duration})` : ""; // Ensure consistency

      await school.save(); // save() will trigger Mongoose schema validation and pre/post hooks
      res
        .status(200)
        .json({ message: "School updated successfully.", school: school });
    } catch (err) {
      console.error("Update School Error:", err);
      if (err.code === 11000) {
        return res
          .status(400)
          .json({
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
  }
);

// @desc    Delete a school
// @route   DELETE /api/schools/:id
// @access  Private (Superadmin only)
router.delete("/:id", protect, authorize("superadmin"), async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.id);
    if (!school) {
      return res.status(404).json({ message: "School not found." });
    }
    res.status(200).json({ message: "School deleted successfully." });
  } catch (err) {
    console.error("Delete School Error:", err);
    if (err.kind === "ObjectId") {
      return res
        .status(404)
        .json({ message: "School not found (Invalid ID)." });
    }
    res.status(500).json({ message: "Server error deleting school." });
  }
});

export default router;
