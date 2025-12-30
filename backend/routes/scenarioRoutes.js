import express from "express";
import { body, validationResult } from "express-validator";
import Scenario from "../models/scenarioModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";

const router = express.Router();

// --- Validation ---
const scenarioValidationRules = [
  body("scenarioName", "Scenario Name is required").notEmpty().trim(),
  body("description").optional().trim(),
  body("status", "Invalid Status")
    .optional()
    .isIn(["Draft", "Published", "Archived"]),
  body("permissions").optional().isIn(["Read Only", "Write Only", "Both"]),
];

// --- GET ALL ---
router.get("/", protect, checkAccess("viewScenarios"), async (req, res) => {
  try {
    let query = {};
    const { status, permissions, searchTerm } = req.query;

    if (status) query.status = status;
    if (permissions) query.permissions = permissions;
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, "i");
      query.$or = [{ scenarioName: searchRegex }, { description: searchRegex }];
    }

    if (req.scope) {
      if (req.scope.educatorId) query.creator = req.scope.educatorId;
      if (req.scope.schoolId) query.schoolId = req.scope.schoolId;
      if (req.scope.userId) query.assignedTo = { $in: [req.scope.userId] };
    }

    const scenarios = await Scenario.find(query)
      .populate("creator", "name email")
      .sort({ createdAt: -1 });
    res.json(scenarios);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching scenarios." });
  }
});

// --- GET SINGLE ---
router.get("/:id", protect, checkAccess("viewScenarios"), async (req, res) => {
  try {
    const scenario = await Scenario.findById(req.params.id).populate(
      "creator",
      "name email"
    );
    if (!scenario)
      return res.status(404).json({ message: "Scenario not found." });
    res.json(scenario);
  } catch (err) {
    if (err.kind === "ObjectId")
      return res
        .status(404)
        .json({ message: "Scenario not found (Invalid ID)." });
    res.status(500).json({ message: "Server error fetching scenario." });
  }
});

// --- CREATE ---
router.post(
  "/",
  protect,
  checkAccess("manageScenarios"),
  scenarioValidationRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const {
      _id,
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
      // Check for duplicate _id if provided
      if (_id) {
        const existingScenario = await Scenario.findById(_id);
        if (existingScenario) {
          return res.status(400).json({ message: "A scenario with this AI-generated ID already exists. Please regenerate via AI." });
        }
      }

      const scenarioData = {
        scenarioName,
        description,
        creator: req.user._id,
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
      };

      if (_id) scenarioData._id = _id;

      const newScenario = new Scenario(scenarioData);
      await newScenario.save();
      res
        .status(201)
        .json({
          message: "Scenario added successfully.",
          scenario: newScenario,
        });
    } catch (err) {
      console.error("Create Scenario Error:", err);
      if (err.code === 11000)
        return res
          .status(400)
          .json({ message: "Duplicate scenario ID or Name detected during save." });
      res.status(500).json({ message: "Server error creating scenario." });
    }
  }
);

// --- UPDATE ---
router.put(
  "/:id",
  protect,
  checkAccess("manageScenarios"),
  scenarioValidationRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

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
      const scenario = await Scenario.findById(req.params.id);
      if (!scenario)
        return res.status(404).json({ message: "Scenario not found." });

      if (
        req.user.role === "educator" &&
        scenario.creator.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to edit this scenario." });
      }

      scenario.scenarioName = scenarioName;
      scenario.description = description;
      scenario.status = status || scenario.status;
      scenario.permissions = permissions || scenario.permissions;
      scenario.assignedTo = assignedTo || scenario.assignedTo;
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
      res
        .status(200)
        .json({
          message: "Scenario updated successfully.",
          scenario: scenario,
        });
    } catch (err) {
      console.error("Update Scenario Error:", err);
      if (err.code === 11000)
        return res
          .status(400)
          .json({ message: "Another scenario with this name already exists." });
      res.status(500).json({ message: "Server error updating scenario." });
    }
  }
);

// --- DELETE ---
router.delete(
  "/:id",
  protect,
  checkAccess("manageScenarios"),
  async (req, res) => {
    try {
      const scenario = await Scenario.findById(req.params.id);
      if (!scenario)
        return res.status(404).json({ message: "Scenario not found." });

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
      if (err.kind === "ObjectId")
        return res
          .status(404)
          .json({ message: "Scenario not found (Invalid ID)." });
      res.status(500).json({ message: "Server error deleting scenario." });
    }
  }
);

export default router;
