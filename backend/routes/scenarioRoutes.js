// WHOLE_PROJECT/routes/scenarioRoutes.js
import express from "express";
import { readFileSync } from "fs";
import { body, validationResult } from "express-validator";
import mongoose from "mongoose";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import defaultScenarioJson from "../data/defaultScenarioJson.js";
import { generateScenarioJson } from "../utils/geminiClient.js";
import { buildWorkflow, createFlow, updateFlow } from "../utils/voxioClient.js";
import { publicMessage } from "../utils/appEnv.js";

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

    const scenarios = await Scenario.find(query)
      .populate("educator", "name email")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

    // Attach session stats (avgScore, totalSessions) to each scenario
    const scenarioIdStrings = scenarios.map((s) => s._id.toString());
    const sessionStats = await Session.aggregate([
      { $match: { scenario_id: { $in: scenarioIdStrings } } },
      {
        $group: {
          _id: "$scenario_id",
          avgScore: { $avg: "$score" },
          totalSessions: { $sum: 1 },
        },
      },
    ]);
    const statsMap = {};
    sessionStats.forEach((s) => { statsMap[s._id] = s; });

    const scenariosWithStats = scenarios.map((s) => {
      const stat = statsMap[s._id.toString()];
      return {
        ...s.toObject(),
        avgScore: stat ? parseFloat((stat.avgScore * 100).toFixed(1)) : null,
        totalSessions: stat?.totalSessions ?? 0,
      };
    });

    res.json(scenariosWithStats);
  } catch (err) {
    console.error("Get Scenarios Error:", err);
    res.status(500).json({ message: "Server error fetching scenarios." });
  }
});

/*
 * ── AI scenario authoring ──────────────────────────────────────────────────────
 *
 * Ported from the standalone FastAPI service that used to run on :8888. Same
 * pipeline: Gemini turns a one-line brief into the structured scenario, the
 * result is injected into the Voxio workflow graph, and Voxio returns the
 * api_key that identifies the runnable flow.
 *
 * Difference from the Python original: nothing is written to a second database.
 * The generated fields come back to the form, and the existing POST/PUT
 * /api/scenarios routes persist them — including apiKey — so a scenario exists
 * in one place only.
 */

const readPrompt = (file) =>
  readFileSync(new URL(`../ai/prompts/${file}`, import.meta.url), "utf8");

// Read once at boot; these are static assets, not per-request data.
const CREATION_PROMPT = readPrompt("scenario-creation.md");
const EDITING_PROMPT = readPrompt("scenario-editing.md");

/**
 * Normalise what Gemini returns into the shape the form reads.
 *
 * `status` is deliberately not passed through: the Python service set it to
 * 'success' as a transport flag, and the form treated that as the scenario's
 * publication status, corrupting it. Draft/Published stays the user's choice.
 */
const shapeGenerated = (generated, apiKey) => ({
  scenario_name: generated.scenario_name || "",
  scenario_prompt: generated.scenario_prompt || "",
  questions_for_feedback: generated.questions_for_feedback || [],
  // The prompt asks for difficulty_level; difficulty_status is accepted because
  // the old service persisted it under that name.
  difficulty_level: generated.difficulty_level || generated.difficulty_status || "Medium",
  movements: generated.movements || { shoulder: {}, neck: {} },
  api_key: apiKey,
});

// Generate a brand new scenario and publish it as a Voxio flow.
router.post(
  "/ai/generate",
  protect,
  checkAccess("moderateScenarios"),
  async (req, res) => {
    const query = req.body?.scenario_prompt;
    if (!query || !String(query).trim()) {
      return res
        .status(400)
        .json({ message: "Missing 'scenario_prompt' in request body." });
    }

    try {
      const generated = await generateScenarioJson({
        systemPrompt: CREATION_PROMPT,
        userQuery: String(query),
      });

      const workflow = buildWorkflow({
        scenarioPrompt: generated.scenario_prompt,
        feedbackQuestions: generated.questions_for_feedback,
      });

      const apiKey = await createFlow({
        flowName: generated.scenario_name || "Untitled Scenario",
        workflow,
      });

      res.json({ response: shapeGenerated(generated, apiKey) });
    } catch (err) {
      console.error("[AI] generate failed:", err);
      res.status(503).json({
        message: publicMessage(err, "AI scenario generation is unavailable right now."),
      });
    }
  },
);

// Regenerate an existing scenario and overwrite the flow behind its api_key.
router.post(
  "/ai/edit",
  protect,
  checkAccess("moderateScenarios"),
  async (req, res) => {
    const query = req.body?.scenario_prompt;
    const apiKey = req.body?.api_key;

    if (!query || !String(query).trim()) {
      return res
        .status(400)
        .json({ message: "Missing 'scenario_prompt' in request body." });
    }
    if (!apiKey) {
      return res.status(400).json({
        message:
          "Missing 'api_key'. This scenario has no simulator flow yet — generate one first.",
      });
    }

    try {
      const generated = await generateScenarioJson({
        systemPrompt: EDITING_PROMPT,
        userQuery: String(query),
      });

      const workflow = buildWorkflow({
        scenarioPrompt: generated.scenario_prompt,
        feedbackQuestions: generated.questions_for_feedback,
      });

      await updateFlow({
        apiKey,
        flowName: generated.scenario_name || "Untitled Scenario",
        workflow,
      });

      res.json({ response: shapeGenerated(generated, apiKey) });
    } catch (err) {
      console.error("[AI] edit failed:", err);
      res.status(503).json({
        message: publicMessage(err, "AI scenario editing is unavailable right now."),
      });
    }
  },
);

let liveScenario = null;

router.post("/json", protect, async (req, res) => {
  try {
    const { scenarioId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(scenarioId)) {
      return res
        .status(404)
        .json({ message: "Scenario not found (Invalid ID)." });
    }

    const scenario = await Scenario.findById(scenarioId)
      .populate("educator", "name email")
      .lean();

    if (!scenario)
      return res.status(404).json({ message: "Scenario not found." });

    liveScenario = scenario;
    res.json({ message: "Scenario JSON set." });
  } catch (err) {
    console.error("Set Scenario JSON Error:", err);
    res.status(500).json({ message: "Server error setting scenario JSON." });
  }
});

router.get("/json", (req, res) => {
  if (!liveScenario) return res.json({ response: defaultScenarioJson });

  res.json({
    response: {
      cursor: 0,
      count: 1,
      remaining: 0,
      results: [liveScenario],
    },
  });
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
      html,
    } = req.body;


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
        html: html || "",
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

/**
 * A scenario may be changed by its author, or by the school_admin of the school
 * it belongs to. Everyone else is refused even though checkAccess let them in,
 * because the permission matrix is per-action and cannot express ownership.
 */
const canManageScenario = (scenario, req) => {
  if (scenario.educator?.toString() === req.user._id.toString()) return true;
  return Boolean(
    req.user.role === "school_admin" &&
      req.scope?.schoolId &&
      scenario.schoolId?.toString() === req.scope.schoolId.toString(),
  );
};

router.put(
  "/:id",
  protect,
  checkAccess("moderateScenarios"),
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
      html,
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

      if (!canManageScenario(scenario, req)) {
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
      if (html !== undefined) scenario.html = html;

      await scenario.save();
      await scenario.populate("educator", "name email");
      await scenario.populate("assignedTo", "name");

      // Attach session stats so Redux store keeps avgScore/totalSessions after update
      const sessionStat = await Session.aggregate([
        { $match: { scenario_id: scenario._id.toString() } },
        { $group: { _id: "$scenario_id", avgScore: { $avg: "$score" }, totalSessions: { $sum: 1 } } },
      ]);
      const stat = sessionStat[0];
      const scenarioObj = {
        ...scenario.toObject(),
        avgScore: stat ? parseFloat((stat.avgScore * 100).toFixed(1)) : null,
        totalSessions: stat?.totalSessions ?? 0,
      };

      res.status(200).json({
        message: "Scenario updated successfully.",
        scenario: scenarioObj,
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
  checkAccess("moderateScenarios"),
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

      if (!canManageScenario(scenario, req)) {
        return res
          .status(403)
          .json({ message: "You are not authorized to delete this scenario." });
      }

      if (
        req.scope.schoolId &&
        scenario.schoolId?.toString() !== req.scope.schoolId.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Access denied: Scenario not in your school" });
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
