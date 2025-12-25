// WHOLE_PROJECT/routes/scenarioRoutes.js
import express from "express";
import { body, validationResult } from "express-validator";
import Scenario from "../models/scenarioModel.js"; // Adjust path
import { protect, authorize } from "../middleware/authMiddleware.js"; // Adjust path

const router = express.Router();

// --- Validation Middleware ---
const scenarioValidationRules = [
  body("scenarioName", "Scenario Name is required").notEmpty().trim(),
  body("description").optional().trim(),
  body("status", "Invalid Status")
    .optional()
    .isIn(["Draft", "Published", "Archived"]),
  body("permissions", "Invalid Permissions")
    .optional()
    .isIn(["Read Only", "Write Only", "Both"]),
];

// --- Routes ---

// @desc    Get all scenarios (with optional filters)
// @route   GET /api/scenarios
// @access  Private (Superadmin, Educator)
router.get(
  "/",
  protect,
  authorize("superadmin", "educator"),
  async (req, res) => {
    try {
      let query = {};
      // Implement filters if passed in query params (e.g., /api/scenarios?status=Published)
      const { status, permissions, searchTerm } = req.query;

      if (status) query.status = status;
      if (permissions) query.permissions = permissions;

      if (searchTerm) {
        const searchRegex = new RegExp(searchTerm, "i"); // Case-insensitive search
        query.$or = [
          { scenarioName: searchRegex },
          { description: searchRegex },
        ];
      }

      const scenarios = await Scenario.find(query)
        .populate("creator", "name email")
        .sort({ scenarioName: 1 }); // Sort by name by default
      res.json(scenarios);
    } catch (err) {
      console.error("Get Scenarios Error:", err);
      res.status(500).json({ message: "Server error fetching scenarios." });
    }
  }
);

// @desc    Get single scenario by ID
// @route   GET /api/scenarios/:id
// @access  Private (Superadmin, Educator)
router.get(
  "/:id",
  protect,
  authorize("superadmin", "educator"),
  async (req, res) => {
    try {
      const scenario = await Scenario.findById(req.params.id).populate(
        "creator",
        "name email"
      );
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found." });
      }
      res.json(scenario);
    } catch (err) {
      console.error("Get Scenario by ID Error:", err);
      if (err.kind === "ObjectId") {
        return res
          .status(404)
          .json({ message: "Scenario not found (Invalid ID)." });
      }
      res.status(500).json({ message: "Server error fetching scenario." });
    }
  }
);

// @desc    Create a new scenario
// @route   POST /api/scenarios
// @access  Private (Superadmin, Educator)
router.post(
  "/",
  protect,
  authorize("superadmin", "educator"),
  scenarioValidationRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { scenarioName, description, status, permissions, assignedTo } =
      req.body;

    try {
      const newScenario = new Scenario({
        scenarioName,
        description,
        creator: req.user._id, // Set creator to current user
        status: status || "Draft",
        permissions: permissions || "Read Only",
        assignedTo: assignedTo || [],
      });

      await newScenario.save();
      res.status(201).json({
        message: "Scenario added successfully.",
        scenario: newScenario,
      });
    } catch (err) {
      console.error("Create Scenario Error:", err);
      if (err.code === 11000) {
        // Duplicate key error (unlikely since no unique fields)
        return res
          .status(400)
          .json({ message: "Scenario with this name already exists." });
      }
      if (err.name === "ValidationError") {
        const validationMessages = Object.values(err.errors)
          .map((e) => e.message)
          .join("; ");
        return res.status(400).json({ message: validationMessages });
      }
      res.status(500).json({ message: "Server error creating scenario." });
    }
  }
);

// @desc    Update a scenario
// @route   PUT /api/scenarios/:id
// @access  Private (Superadmin, Educator)
router.put(
  "/:id",
  protect,
  authorize("superadmin", "educator"),
  scenarioValidationRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { scenarioName, description, status, permissions, assignedTo } =
      req.body;

    try {
      const scenario = await Scenario.findById(req.params.id);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found." });
      }

      // Update fields
      scenario.scenarioName = scenarioName;
      scenario.description = description;
      scenario.status = status || scenario.status;
      scenario.permissions = permissions || scenario.permissions;
      scenario.assignedTo = assignedTo || scenario.assignedTo;

      await scenario.save(); // save() will trigger Mongoose schema validation and pre/post hooks
      res.status(200).json({
        message: "Scenario updated successfully.",
        scenario: scenario,
      });
    } catch (err) {
      console.error("Update Scenario Error:", err);
      if (err.code === 11000) {
        return res.status(400).json({
          message: "Another scenario with this name already exists.",
        });
      }
      if (err.name === "ValidationError") {
        const validationMessages = Object.values(err.errors)
          .map((e) => e.message)
          .join("; ");
        return res.status(400).json({ message: validationMessages });
      }
      res.status(500).json({ message: "Server error updating scenario." });
    }
  }
);

// @desc    Delete a scenario
// @route   DELETE /api/scenarios/:id
// @access  Private (Superadmin, Educator)
router.delete(
  "/:id",
  protect,
  authorize("superadmin", "educator"),
  async (req, res) => {
    try {
      const scenario = await Scenario.findByIdAndDelete(req.params.id);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found." });
      }
      res.status(200).json({ message: "Scenario deleted successfully." });
    } catch (err) {
      console.error("Delete Scenario Error:", err);
      if (err.kind === "ObjectId") {
        return res
          .status(404)
          .json({ message: "Scenario not found (Invalid ID)." });
      }
      res.status(500).json({ message: "Server error deleting scenario." });
    }
  }
);

export default router;
