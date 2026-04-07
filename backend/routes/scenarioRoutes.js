// WHOLE_PROJECT/routes/scenarioRoutes.js
import express from "express";
import { body, validationResult } from "express-validator";
import mongoose from "mongoose"; // Required for ID validation
import Scenario from "../models/scenarioModel.js";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";

const router = express.Router();

const scenarioValidationRules = [
  body("scenarioName").optional().notEmpty().trim(),
  body("description").optional().trim(),
  body("status", "Invalid Status")
    .optional()
    .isIn(["Draft", "Published", "Archived", "success"]),
  body("permissions").optional().isIn(["Read Only", "Write Only", "Both"]),
];

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
      if (req.scope.educatorId) {
        query.educator = req.scope.educatorId;
      } else if (req.scope.schoolId) {
        query.schoolId = req.scope.schoolId;
      } else if (req.scope.userId) {
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
    console.log(
      "Fetched scenarios with assignedTo:",
      scenarios.map((s) => ({ id: s._id, assignedTo: s.assignedTo })),
    );

    res.json(scenarios);
  } catch (err) {
    console.error("Get Scenarios Error:", err);
    res.status(500).json({ message: "Server error fetching scenarios." });
  }
});

router.get("/:id", protect, checkAccess("viewScenarios"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(404)
        .json({ message: "Scenario not found (Invalid ID)." });
    }

    const scenario = await Scenario.findById(req.params.id).populate(
      "educator",
      "name email",
    );

    if (!scenario)
      return res.status(404).json({ message: "Scenario not found." });

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

router.post(
  "/",
  protect,
  checkAccess("manageScenarios"),
  scenarioValidationRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation Failed:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

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

    console.log("POST /scenarios - Received body:", req.body);
    console.log("User schoolId:", req.user.schoolId);

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
      let customId = null;
      if (_id) {
        console.log("Checking _id from AI:", _id);
        if (mongoose.Types.ObjectId.isValid(_id)) {
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
          console.warn(`Ignoring invalid ObjectId provided by AI: ${_id}`);
        }
      }

      const userSchoolId = req.user.schoolId?._id || req.user.schoolId;

      if (!userSchoolId) {
        return res.status(400).json({
          message:
            "Account configuration error: You must belong to a school to create a scenario.",
        });
      }

      const scenarioData = {
        scenarioName,
        description,
        educator: req.user._id,
        schoolId: userSchoolId,
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

      if (customId) {
        scenarioData._id = customId;
      }

      const newScenario = new Scenario(scenarioData);
      await newScenario.save();

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
  },
);

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

    let assignedUserIds = [];
    if (assignedTo && Array.isArray(assignedTo)) {
      const invalidIds = assignedTo.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id),
      );
      if (invalidIds.length > 0) {
        return res
          .status(400)
          .json({ message: "Invalid user IDs in assignedTo" });
      }
      assignedUserIds = assignedTo;
    }

    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res
          .status(404)
          .json({ message: "Scenario not found (Invalid ID)." });
      }

      const scenario = await Scenario.findById(req.params.id);
      if (!scenario)
        return res.status(404).json({ message: "Scenario not found." });

      if (scenario.educator.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "You are not authorized to edit this scenario." });
      }

      if (
        req.scope.schoolId &&
        scenario.schoolId.toString() !== req.scope.schoolId.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Access denied: Scenario not in your school" });
      }

      if (scenarioName !== undefined) scenario.scenarioName = scenarioName;
      if (description !== undefined) scenario.description = description;
      if (status !== undefined) scenario.status = status;
      if (permissions !== undefined) scenario.permissions = permissions;
      if (assignedTo !== undefined) scenario.assignedTo = assignedUserIds;
      if (template !== undefined) scenario.template = template;
      if (scenarioPrompt !== undefined)
        scenario.scenarioPrompt = scenarioPrompt;
      if (aiAvatarRole !== undefined) scenario.aiAvatarRole = aiAvatarRole;
      if (aiInstructions !== undefined)
        scenario.aiInstructions = aiInstructions;
      if (aiQuestions !== undefined) scenario.aiQuestions = aiQuestions;
      if (difficulty !== undefined) scenario.difficulty = difficulty;
      if (animationTriggers !== undefined)
        scenario.animationTriggers = animationTriggers;
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
  },
);

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
  },
);

export default router;
