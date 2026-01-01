// WHOLE_PROJECT/routes/scenarioRoutes.js
import express from "express";
import { body, validationResult } from "express-validator";
import mongoose from "mongoose"; // Required for ID validation
import Scenario from "../models/scenarioModel.js";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";

const router = express.Router();

// --- Validation Rules ---
const scenarioValidationRules = [
  body("scenarioName").optional().notEmpty().trim(),
  body("description").optional().trim(),
   body("status", "Invalid Status")
     .optional()
     .isIn(["Draft", "Published", "Archived", "success"]),
  body("permissions").optional().isIn(["Read Only", "Write Only", "Both"]),
];

// --- GET ALL SCENARIOS ---
// @desc    Get all scenarios with filtering and scoping
// @route   GET /api/scenarios
router.get("/", protect, checkAccess("viewScenarios"), async (req, res) => {
  try {
    let query = {};
    const { status, permissions, searchTerm } = req.query;

    // 1. General Filtering
    if (status) query.status = status;
    if (permissions) query.permissions = permissions;
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, "i");
      query.$or = [{ scenarioName: searchRegex }, { description: searchRegex }];
    }

    // 2. Role-based Scoping (Enforced by roleAccessMiddleware)
    if (req.scope) {
      if (req.scope.educatorId) {
        // Educator sees scenarios they created
        query.educator = req.scope.educatorId;
      } else if (req.scope.schoolId) {
        // School Admin sees scenarios in their school
        query.schoolId = req.scope.schoolId;
      } else if (req.scope.userId) {
        // Students see scenarios assigned to them
        query.assignedTo = { $in: [req.scope.userId] };
      }
    }

    console.log("Scope:", req.scope);
    console.log("Query:", query);

    const scenarios = await Scenario.find(query)
      .populate("educator", "name email")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

    console.log("Found scenarios count:", scenarios.length);
    console.log("Fetched scenarios with assignedTo:", scenarios.map(s => ({ id: s._id, assignedTo: s.assignedTo })));

    res.json(scenarios);
  } catch (err) {
    console.error("Get Scenarios Error:", err);
    res.status(500).json({ message: "Server error fetching scenarios." });
  }
});

// --- GET SINGLE SCENARIO ---
// @desc    Get a single scenario by ID
// @route   GET /api/scenarios/:id
router.get("/:id", protect, checkAccess("viewScenarios"), async (req, res) => {
  try {
    // Validate ID format before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(404)
        .json({ message: "Scenario not found (Invalid ID)." });
    }

    const scenario = await Scenario.findById(req.params.id).populate(
      "educator",
      "name email"
    );

    if (!scenario)
      return res.status(404).json({ message: "Scenario not found." });

    // Check scope for school_admin
    if (
      req.scope.schoolId &&
      scenario.schoolId &&
      scenario.schoolId.toString() !== req.scope.schoolId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Access denied: Scenario not in your school" });
    }

    res.json(scenario);
  } catch (err) {
    console.error("Get Single Scenario Error:", err);
    res.status(500).json({ message: "Server error fetching scenario." });
  }
});

// --- CREATE SCENARIO (Educators Only) ---
// @desc    Create a new scenario
// @route   POST /api/scenarios
router.post(
  "/",
  protect,
  checkAccess("manageScenarios"), // Locked to 'educator' via rolePermissions.js
  scenarioValidationRules,
  async (req, res) => {
    // 1. Validation Errors from express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation Failed:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      _id, // ID coming from AI (potentially)
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

    console.log("POST /scenarios - Received body:", req.body);
    console.log("User schoolId:", req.user.schoolId);

    // 2. Resolve assignedTo emails to user IDs
    let assignedUserIds = [];
    if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
      try {
        const users = await User.find({ email: { $in: assignedTo } });
        assignedUserIds = users.map((u) => u._id);
      } catch (err) {
        console.error("Error resolving assigned users:", err);
      }
    }

    try {
      // 3. ID Validation Logic (The Fix for 400 Bad Request)
      let customId = null;
      if (_id) {
        console.log("Checking _id from AI:", _id);
        if (mongoose.Types.ObjectId.isValid(_id)) {
          // It is a valid Mongo ID, check for duplicates
          const existingScenario = await Scenario.findById(_id);
          if (existingScenario) {
            console.log("Duplicate _id found:", _id);
            return res.status(400).json({
              message: "A scenario with this ID already exists.",
            });
          }
          customId = _id;
          console.log("Using custom _id:", _id);
        } else {
          // It is NOT a valid Mongo ID. Log it and ignore it.
          // This allows Mongo to generate a fresh, valid ID automatically.
          console.warn(`Ignoring invalid ObjectId provided by AI: ${_id}`);
        }
      }

      // 4. Safe School ID Extraction
      // authMiddleware populates 'schoolId', so it might be an object or a string.
      const userSchoolId = req.user.schoolId?._id || req.user.schoolId;

      if (!userSchoolId) {
        return res.status(400).json({
          message:
            "Account configuration error: You must belong to a school to create a scenario.",
        });
      }

      // 5. Construct the Scenario Object
      const scenarioData = {
        scenarioName,
        description,
        educator: req.user._id, // Enforce logged-in user as educator
        schoolId: userSchoolId, // Use extracted School ID
        status: status || "Draft",
        permissions: permissions || "Read Only",
        assignedTo: assignedUserIds,
        template,
        scenarioPrompt,
        aiAvatarRole,
        aiInstructions,
        aiQuestions,
        difficulty: difficulty || "Medium",
        animationTriggers: animationTriggers || { shoulder: [], neck: [] },
        apiKey: apiKey || "",
      };

      // Only attach _id if it was valid
      if (customId) {
        scenarioData._id = customId;
      }

      const newScenario = new Scenario(scenarioData);
      await newScenario.save();

      // Populate for immediate return
      await newScenario.populate("educator", "name email");
      await newScenario.populate("assignedTo", "name");

      res.status(201).json({
        message: "Scenario added successfully.",
        scenario: newScenario,
      });
    } catch (err) {
      console.error("Create Scenario Error:", err);
      console.log("Error details:", err);
      if (err.code === 11000) {
        console.log("Duplicate key error:", err.keyValue);
        return res.status(400).json({
          message: "Duplicate scenario ID or Name detected.",
        });
      }
      res
        .status(500)
        .json({ message: "Server error creating scenario: " + err.message });
    }
  }
);

// --- UPDATE SCENARIO (Educator & Owner Only) ---
// @desc    Update an existing scenario
// @route   PUT /api/scenarios/:id
router.put(
  "/:id",
  protect,
  checkAccess("manageScenarios"),
  scenarioValidationRules,
  async (req, res) => {
    // 1. Validation Errors
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

    // 2. Validate Assigned User IDs
    let assignedUserIds = [];
    if (assignedTo && Array.isArray(assignedTo)) {
      const invalidIds = assignedTo.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ message: "Invalid user IDs in assignedTo" });
      }
      assignedUserIds = assignedTo;
    }

    try {
      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res
          .status(404)
          .json({ message: "Scenario not found (Invalid ID)." });
      }

      const scenario = await Scenario.findById(req.params.id);
      if (!scenario)
        return res.status(404).json({ message: "Scenario not found." });

      // 3. Ownership Check
      // Ensure the logged-in user is the educator
      if (scenario.educator.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "You are not authorized to edit this scenario." });
      }

      // Check scope for school_admin safety (double check)
      if (
        req.scope.schoolId &&
        scenario.schoolId.toString() !== req.scope.schoolId.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Access denied: Scenario not in your school" });
      }

      // 4. Update Fields (only if provided)
      if (scenarioName !== undefined) scenario.scenarioName = scenarioName;
      if (description !== undefined) scenario.description = description;
      if (status !== undefined) scenario.status = status;
      if (permissions !== undefined) scenario.permissions = permissions;
      if (assignedTo !== undefined) scenario.assignedTo = assignedUserIds;
      if (template !== undefined) scenario.template = template;
      if (scenarioPrompt !== undefined) scenario.scenarioPrompt = scenarioPrompt;
      if (aiAvatarRole !== undefined) scenario.aiAvatarRole = aiAvatarRole;
      if (aiInstructions !== undefined) scenario.aiInstructions = aiInstructions;
      if (aiQuestions !== undefined) scenario.aiQuestions = aiQuestions;
      if (difficulty !== undefined) scenario.difficulty = difficulty;
      if (animationTriggers !== undefined) scenario.animationTriggers = animationTriggers;
      if (apiKey !== undefined) scenario.apiKey = apiKey;

      await scenario.save();
      console.log("Updated scenario assignedTo:", scenario.assignedTo);
      await scenario.populate("educator", "name email");
      await scenario.populate("assignedTo", "name");

      res.status(200).json({
        message: "Scenario updated successfully.",
        scenario: scenario,
      });
    } catch (err) {
      console.error("Update Scenario Error:", err);
      if (err.code === 11000)
        return res
          .status(400)
          .json({ message: "Scenario name already exists." });
      res.status(500).json({ message: "Server error updating scenario." });
    }
  }
);

// --- DELETE SCENARIO (Educator & Owner Only) ---
// @desc    Delete a scenario
// @route   DELETE /api/scenarios/:id
router.delete(
  "/:id",
  protect,
  checkAccess("manageScenarios"),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res
          .status(404)
          .json({ message: "Scenario not found (Invalid ID)." });
      }

      const scenario = await Scenario.findById(req.params.id);
      if (!scenario)
        return res.status(404).json({ message: "Scenario not found." });

      // Ownership Check
      if (scenario.educator.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "You are not authorized to delete this scenario." });
      }

      await scenario.deleteOne();
      res.status(200).json({ message: "Scenario deleted successfully." });
    } catch (err) {
      console.error("Delete Scenario Error:", err);
      res.status(500).json({ message: "Server error deleting scenario." });
    }
  }
);

export default router;
