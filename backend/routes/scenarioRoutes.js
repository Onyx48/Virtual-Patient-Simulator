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
import { generateJsonWithFallback } from "../utils/aiText.js";
import { emptyMovements, emptyTriggers } from "../utils/bodyRegions.js";
import { withStudentScope } from "../utils/scenarioAssignment.js";
import Group from "../models/groupModel.js";
import { buildWorkflow, createFlow, updateFlow } from "../utils/voxioClient.js";
import { publicMessage } from "../utils/appEnv.js";
import {
  setLiveScenario,
  getLiveScenario,
  getLiveMeta,
} from "../state/liveScenario.js";
import { toBubbleScenarioJson } from "../utils/bubbleScenario.js";
import { startTrace } from "../utils/routeTrace.js";

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
        // Individually assigned OR a member of an assigned group. Merged as $and
        // so it cannot clobber the searchTerm $or set above.
        query = withStudentScope(query, req.user);
      }
    }

    const scenarios = await Scenario.find(query)
      .populate("educator", "name email")
      .populate("assignedTo", "name")
      .populate("assignedGroups", "name")
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
  movements: generated.movements || emptyMovements(),
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
      const { json: generated, provider, model } = await generateJsonWithFallback({
        systemPrompt: CREATION_PROMPT,
        userQuery: String(query),
      });
      console.log(`[AI] scenario generated by ${provider} (${model})`);

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
      const { json: generated, provider, model } = await generateJsonWithFallback({
        systemPrompt: EDITING_PROMPT,
        userQuery: String(query),
      });
      console.log(`[AI] scenario edited by ${provider} (${model})`);

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

    // Educator pressing Test: no student and no session, so Id is the educator's
    // own id and StreamSessionId stays empty.
    setLiveScenario(scenario, { userId: req.user._id });
    res.json({ message: "Scenario JSON set." });
  } catch (err) {
    console.error("Set Scenario JSON Error:", err);
    res.status(500).json({ message: "Server error setting scenario JSON." });
  }
});

router.get("/json", (req, res) => {
  const liveScenario = getLiveScenario();
  if (!liveScenario) return res.json({ response: defaultScenarioJson });

  // Reshaped into the same Bubble payload the fallback above serves. Serving the
  // raw document here is what made the simulator read missing keys and post
  // empty ids to posta.
  res.json({ response: toBubbleScenarioJson(liveScenario, getLiveMeta()) });
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
    const trace = startTrace("add-scenario", req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      trace.warn("express-validator rejected the body", errors.array());
      return trace.send(res, 400, { errors: errors.array() });
    }
    trace.log("validation passed");

    const {
      _id,
      scenarioName,
      description,
      status,
      permissions,
      assignedTo,
      assignedGroups,
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


    /*
     * assignedTo arrives here as email addresses (the edit route takes ids), so
     * both what was asked for and what resolved are logged — an address with no
     * account resolves to nothing and the scenario is silently created assigned
     * to fewer students than the educator selected.
     */
    let assignedUserIds = [];
    if (assignedTo && Array.isArray(assignedTo) && assignedTo.length > 0) {
      try {
        const users = await User.find({ email: { $in: assignedTo } });
        assignedUserIds = users.map((u) => u._id);
        trace.log("resolved assignedTo emails → user ids", {
          requested: assignedTo,
          resolved: users.map((u) => ({ _id: u._id, email: u.email })),
          unmatched: assignedTo.filter(
            (email) => !users.some((u) => u.email === String(email).toLowerCase()),
          ),
        });
      } catch (err) {
        trace.warn(`resolving assignedTo failed, continuing unassigned: ${err.message}`);
      }
    } else {
      trace.log("no assignedTo in the request", { assignedTo });
    }

    try {
      let customId = null;
      if (_id) {
        if (mongoose.Types.ObjectId.isValid(_id)) {
          const existingScenario = await Scenario.findById(_id);
          if (existingScenario) {
            trace.warn("client-supplied _id already exists", { _id });
            return trace.send(res, 400, {
              message: "A scenario with this ID already exists.",
            });
          }
          customId = _id;
          trace.log("using the client-supplied _id", { _id });
        } else {
          trace.warn("ignoring an invalid client-supplied _id", { _id });
        }
      }

      const userSchoolId = req.user.schoolId?._id || req.user.schoolId;

      if (!userSchoolId) {
        trace.warn("creator has no schoolId, cannot create", {
          user: req.user._id,
          role: req.user.role,
        });
        return trace.send(res, 400, {
          message:
            "Account configuration error: You must belong to a school to create a scenario.",
        });
      }
      trace.log("resolved the owning school", { schoolId: userSchoolId });

      const createGroups = await resolveAssignedGroups(assignedGroups, req);
      if (createGroups.error) {
        trace.warn("assignedGroups rejected", {
          assignedGroups,
          reason: createGroups.error,
        });
        return trace.send(res, 400, { message: createGroups.error });
      }
      trace.log("resolved assignedGroups", {
        requested: assignedGroups,
        resolved: createGroups.ids,
      });

      const scenarioData = {
        scenarioName,
        description,
        educator: req.user._id,
        schoolId: userSchoolId,
        status: status || "Draft",
        permissions: permissions || "Read Only",
        assignedTo: assignedUserIds,
        assignedGroups: createGroups.ids || [],
        template,
        scenarioPrompt,
        aiAvatarRole,
        aiInstructions,
        aiQuestions,
        difficulty: difficulty || "Medium",
        animationTriggers: animationTriggers || emptyTriggers(),
        apiKey: apiKey || "",
        html: html || "",
      };

      if (customId) {
        scenarioData._id = customId;
      }

      // The document as it will be written, after every default and fallback in
      // this handler has been applied — which is what the request body alone does
      // not tell you.
      trace.log("saving scenario document", scenarioData);

      const newScenario = new Scenario(scenarioData);
      await newScenario.save();
      trace.log("saved", {
        _id: newScenario._id,
        status: newScenario.status,
        hasApiKey: Boolean(newScenario.apiKey),
      });

      await newScenario.populate("educator", "name email");
      await newScenario.populate("assignedTo", "name");
      await newScenario.populate("assignedGroups", "name");
      trace.log("populated educator, assignedTo, assignedGroups");

      return trace.send(res, 201, {
        message: "Scenario added successfully.",
        scenario: newScenario,
      });
    } catch (err) {
      trace.fail(err);
      if (err.code === 11000) {
        return trace.send(res, 400, {
          message: "Duplicate scenario ID or Name detected.",
        });
      }
      return trace.send(res, 500, {
        message: "Server error creating scenario: " + err.message,
      });
    }
  },
);

/**
 * A scenario may be changed by its author, or by the school_admin of the school
 * it belongs to. Everyone else is refused even though checkAccess let them in,
 * because the permission matrix is per-action and cannot express ownership.
 */
/**
 * Validate an incoming assignedGroups list against what the caller may assign.
 *
 * Checked against the database rather than taken on trust: without this an
 * educator could assign another educator's group by id and hand its students a
 * scenario they were never meant to see.
 *
 * @returns {Promise<{error?: string, ids?: string[]}>}
 */
const resolveAssignedGroups = async (assignedGroups, req) => {
  if (assignedGroups === undefined) return {};
  if (!Array.isArray(assignedGroups)) {
    return { error: "'assignedGroups' must be an array of group ids." };
  }
  if (assignedGroups.length === 0) return { ids: [] };

  if (assignedGroups.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return { error: "Invalid group IDs in assignedGroups" };
  }

  // An educator may only assign their own groups; a school_admin any group in
  // their school. A superadmin is unrestricted, matching checkAccess's scoping.
  const scopeFilter =
    req.user.role === "educator"
      ? { educatorId: req.user._id }
      : req.scope?.schoolId
        ? { schoolId: req.scope.schoolId }
        : {};

  const found = await Group.find({
    _id: { $in: assignedGroups },
    ...scopeFilter,
  })
    .select("_id")
    .lean();

  if (found.length !== new Set(assignedGroups.map(String)).size) {
    return { error: "One or more groups do not exist or are not yours to assign." };
  }

  return { ids: found.map((g) => g._id) };
};

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
    const trace = startTrace("edit-scenario", req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      trace.warn("express-validator rejected the body", errors.array());
      return trace.send(res, 400, { errors: errors.array() });
    }
    trace.log("validation passed");

    const {
      scenarioName,
      description,
      status,
      permissions,
      assignedTo,
      assignedGroups,
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
        trace.warn("assignedTo holds non-ObjectId values", { invalidIds });
        return trace.send(res, 400, { message: "Invalid user IDs in assignedTo" });
      }
      assignedUserIds = assignedTo;
    }

    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        trace.warn("the :id in the path is not an ObjectId", { id: req.params.id });
        return trace.send(res, 404, {
          message: "Scenario not found (Invalid ID).",
        });
      }

      const scenario = await Scenario.findById(req.params.id);
      if (!scenario) {
        trace.warn("no scenario with that _id", { id: req.params.id });
        return trace.send(res, 404, { message: "Scenario not found." });
      }

      /*
       * The document before any field is applied. This is the half of an edit the
       * request body cannot show you: with a partial update, a field that looks
       * wrong afterwards was either changed by this request or was already wrong,
       * and only the before-state distinguishes the two.
       */
      trace.log("loaded the existing scenario", scenario);

      if (!canManageScenario(scenario, req)) {
        trace.warn("caller does not own this scenario and is not its school_admin", {
          scenarioEducator: scenario.educator,
          scenarioSchool: scenario.schoolId,
          caller: req.user._id,
          callerRole: req.user.role,
          callerScope: req.scope,
        });
        return trace.send(res, 403, {
          message: "You are not authorized to edit this scenario.",
        });
      }

      if (
        req.scope.schoolId &&
        scenario.schoolId.toString() !== req.scope.schoolId.toString()
      ) {
        trace.warn("scenario belongs to another school", {
          scenarioSchool: scenario.schoolId,
          callerSchool: req.scope.schoolId,
        });
        return trace.send(res, 403, {
          message: "Access denied: Scenario not in your school",
        });
      }
      trace.log("authorised to edit");

      /*
       * Which fields this request actually changes. A partial update is defined by
       * what is absent, so the absent list is the useful half: "the educator says
       * the prompt did not save" is answered by seeing scenarioPrompt in `absent`.
       */
      const incoming = {
        scenarioName, description, status, permissions, assignedTo, assignedGroups,
        template, scenarioPrompt, aiAvatarRole, aiInstructions, aiQuestions,
        difficulty, animationTriggers, apiKey, html,
      };
      trace.log("fields in this update", {
        present: Object.keys(incoming).filter((k) => incoming[k] !== undefined),
        absent: Object.keys(incoming).filter((k) => incoming[k] === undefined),
      });

      if (scenarioName !== undefined) scenario.scenarioName = scenarioName;
      if (description !== undefined) scenario.description = description;
      if (status !== undefined) scenario.status = status;
      if (permissions !== undefined) scenario.permissions = permissions;
      if (assignedTo !== undefined) scenario.assignedTo = assignedUserIds;

      const groups = await resolveAssignedGroups(assignedGroups, req);
      if (groups.error) {
        trace.warn("assignedGroups rejected", {
          assignedGroups,
          reason: groups.error,
        });
        return trace.send(res, 400, { message: groups.error });
      }
      if (groups.ids !== undefined) scenario.assignedGroups = groups.ids;

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

      /*
       * Mongoose tracks which paths were actually mutated, so this distinguishes a
       * field the request sent from a field the request *changed* — a re-save of
       * identical values reports nothing modified, which is the answer to "I
       * saved it and nothing happened".
       */
      trace.log("modified paths", scenario.modifiedPaths());

      await scenario.save();
      trace.log("saved");

      await scenario.populate("educator", "name email");
      await scenario.populate("assignedTo", "name");
      await scenario.populate("assignedGroups", "name");
      trace.log("populated educator, assignedTo, assignedGroups");

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

      trace.log("attached session stats", {
        avgScore: scenarioObj.avgScore,
        totalSessions: scenarioObj.totalSessions,
      });

      return trace.send(res, 200, {
        message: "Scenario updated successfully.",
        scenario: scenarioObj,
      });
    } catch (err) {
      trace.fail(err);
      if (err.code === 11000) {
        return trace.send(res, 400, {
          message: "Scenario name already exists.",
        });
      }
      return trace.send(res, 500, {
        message: "Server error updating scenario.",
      });
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
