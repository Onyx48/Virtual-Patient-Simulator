import express from "express";
import { body, validationResult } from "express-validator";
import Scenario from "../models/scenarioModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";

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

// @desc    Get all scenarios (Scoped by Role)
// @route   GET /api/scenarios
// @access  Private (All roles can view, but data is filtered)
router.get("/", protect, checkAccess("viewScenarios"), async (req, res) => {
  try {
    let query = {};

    // 1. Apply Query Params Filters (from URL)
    const { status, permissions, searchTerm } = req.query;

    if (status) query.status = status;
    if (permissions) query.permissions = permissions;

    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, "i"); // Case-insensitive search
      query.$or = [{ scenarioName: searchRegex }, { description: searchRegex }];
    }

    // 2. Apply Role-Based Scoping (CRITICAL FIX)
    // This merges the restrictions set by checkAccess middleware
    if (req.scope) {
      // If middleware sets 'educatorId', map it to the 'creator' field
      if (req.scope.educatorId) {
        query.creator = req.scope.educatorId;
      }

      // If middleware sets 'schoolId', merge it directly
      // (Note: Ensure your Scenario model has schoolId if you rely on this,
      // or filter creators by school in a pre-step if complex)
      if (req.scope.schoolId) {
        query.schoolId = req.scope.schoolId;
      }

      // For students, filter scenarios where assignedTo includes the user ID
      if (req.scope.userId) {
        query.assignedTo = { $in: [req.scope.userId] };
      }
    }

    const scenarios = await Scenario.find(query)
      .populate("creator", "name email")
      .sort({ createdAt: -1 }); // Sort by newest first

    res.json(scenarios);
  } catch (err) {
    console.error("Get Scenarios Error:", err);
    res.status(500).json({ message: "Server error fetching scenarios." });
  }
});

// @desc    Get single scenario by ID
// @route   GET /api/scenarios/:id
// @access  Private (All roles can view)
router.get("/:id", protect, checkAccess("viewScenarios"), async (req, res) => {
  try {
    // Note: You might want to apply scope here too if strict access is needed
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
});

// @desc    Create a new scenario
// @route   POST /api/scenarios
// @access  Private (Educator, School Admin, Superadmin)
router.post(
  "/",
  protect,
  checkAccess("manageScenarios"),
  scenarioValidationRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Destructure all possible fields
    const {
      scenarioName,
      description,
      status,
      permissions,
      assignedTo,
      template,
      scenarioPrompt,
      aiAvatarRole,
      aiInstructions,
      aiQuestions,
      difficulty,
      animationTriggers,
      apiKey,
    } = req.body;

    try {
      const newScenario = new Scenario({
        scenarioName,
        description,
        creator: req.user._id, // Set creator to current user
        // Ideally, save the schoolId here too if you want to filter by school later!
        schoolId: req.user.schoolId,
        status: status || "Draft",
        permissions: permissions || "Read Only",
        assignedTo: assignedTo || [],
        template,
        scenarioPrompt,
        aiAvatarRole,
        aiInstructions,
        aiQuestions,
        difficulty: difficulty || "Medium",
        animationTriggers: animationTriggers || { shoulder: [], neck: [] },
        apiKey: apiKey || "",
      });

      await newScenario.save();
      res.status(201).json({
        message: "Scenario added successfully.",
        scenario: newScenario,
      });
    } catch (err) {
      console.error("Create Scenario Error:", err);
      if (err.code === 11000) {
        return res
          .status(400)
          .json({ message: "Scenario with this name already exists." });
      }
      res.status(500).json({ message: "Server error creating scenario." });
    }
  }
);

// @desc    Update a scenario
// @route   PUT /api/scenarios/:id
// @access  Private (Educator, School Admin, Superadmin)
router.put(
  "/:id",
  protect,
  checkAccess("manageScenarios"),
  scenarioValidationRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      scenarioName,
      description,
      status,
      permissions,
      assignedTo,
      template,
      scenarioPrompt,
      aiAvatarRole,
      aiInstructions,
      aiQuestions,
      difficulty,
      animationTriggers,
      apiKey,
    } = req.body;

    try {
      // Optional: Check ownership or scope before finding
      const scenario = await Scenario.findById(req.params.id);

      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found." });
      }

      // Check if user has permission to edit this SPECIFIC scenario
      // (e.g. educator can only edit their own)
      if (
        req.user.role === "educator" &&
        scenario.creator.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to edit this scenario." });
      }

      // Update Fields
      scenario.scenarioName = scenarioName;
      scenario.description = description;
      scenario.status = status || scenario.status;
      scenario.permissions = permissions || scenario.permissions;
      scenario.assignedTo = assignedTo || scenario.assignedTo;

      // Update AI & Animation Fields
      scenario.template = template;
      scenario.scenarioPrompt = scenarioPrompt;
      scenario.aiAvatarRole = aiAvatarRole;
      scenario.aiInstructions = aiInstructions;
      scenario.aiQuestions = aiQuestions;
      scenario.difficulty = difficulty;
      scenario.animationTriggers =
        animationTriggers || scenario.animationTriggers;

      if (apiKey) scenario.apiKey = apiKey;

      await scenario.save();
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
      res.status(500).json({ message: "Server error updating scenario." });
    }
  }
);

// @desc    Delete a scenario
// @route   DELETE /api/scenarios/:id
// @access  Private (Educator, School Admin, Superadmin)
router.delete(
  "/:id",
  protect,
  checkAccess("manageScenarios"),
  async (req, res) => {
    try {
      const scenario = await Scenario.findById(req.params.id);
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found." });
      }

      // Check ownership
      if (
        req.user.role === "educator" &&
        scenario.creator.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this scenario." });
      }

      await scenario.deleteOne();
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
