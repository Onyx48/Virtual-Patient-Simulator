import express from "express";
import mongoose from "mongoose";
import { jwtDecrypt } from "jose";
import { createSecretKey } from "crypto";
import { fetchSessionState } from "../utils/voxioClient.js";
import { publicMessage } from "../utils/appEnv.js";
import { setLiveScenario } from "../state/liveScenario.js";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import { isAssignedToStudent } from "../utils/scenarioAssignment.js";

const router = express.Router();

const getJweKey = () => {
  const rawSecret = process.env.JWE_SECRET;
  if (!rawSecret)
    throw Object.assign(new Error("JWE_SECRET is not set."), {
      statusCode: 500,
    });

  const keyBytes = Buffer.from(rawSecret, "base64");

  if (keyBytes.length !== 32) {
    throw Object.assign(
      new Error(
        `JWE_SECRET must decode to exactly 32 bytes. Got ${keyBytes.length} bytes. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
      ),
      { statusCode: 500 },
    );
  }

  return createSecretKey(keyBytes);
};

/*
 * Where a student is sent to run a scenario.
 *
 * The simulator is told which scenario to run by GET /api/scenarios/json, not
 * by anything in this URL, so there is nothing to sign or encrypt here — the
 * link is the same for everyone. This deliberately mirrors the educator Test
 * button, which opens VITE_SIMULATOR_URL after publishing to the same slot.
 *
 * SIMULATOR_URL is read first so the API can be pointed somewhere else without
 * touching the frontend build; VITE_SIMULATOR_URL is the shared default.
 */
const getSimulatorUrl = () =>
  process.env.SIMULATOR_URL ||
  process.env.VITE_SIMULATOR_URL ||
  "https://share.streampixel.io/6aa14ef480d62d728d8ba6e8";

router.post(
  "/start",
  protect,
  checkAccess("viewScenarios"),
  async (req, res) => {
    try {
      if (req.user?.role !== "student") {
        return res
          .status(403)
          .json({ message: "Only students can start sessions." });
      }

      const { scenario_id } = req.body;
      if (!scenario_id || !mongoose.Types.ObjectId.isValid(scenario_id)) {
        return res
          .status(400)
          .json({ message: "Valid scenario_id is required." });
      }

      // Fetched whole (not .select'd) because the same document is published to
      // GET /api/scenarios/json below, and the simulator needs the prompt and
      // movements, not just the key.
      const scenario = await Scenario.findById(scenario_id)
        .populate("educator", "name email")
        .lean();
      if (!scenario) {
        return res.status(404).json({ message: "Scenario not found." });
      }

      // Counts a group assignment too, or a student assigned only via their
      // group would be refused the scenario their dashboard just offered them.
      if (!isAssignedToStudent(scenario, req.user)) {
        return res
          .status(403)
          .json({ message: "Scenario not assigned to this student." });
      }

      const sessionId = new mongoose.Types.ObjectId().toString();

      /*
       * The session row is created here, empty, rather than by the callback.
       *
       * posta's _persist_to_session does update_one({session_id}) with no
       * upsert, so without a row already carrying this session_id the assessed
       * score is computed and then dropped. Creating it up front also means an
       * abandoned run still leaves a record, so the dashboards can show attempts
       * and not just completions.
       */
      await Session.create({
        session_id: sessionId,
        student_id: String(req.user._id),
        scenario_id: String(scenario._id),
        transcription: [],
        feedback: "",
        score: 0,
      });

      // Hand this scenario to the external simulator, which reads it from
      // GET /api/scenarios/json. Last-write-wins by design: whoever pressed
      // Start most recently is the scenario the simulator will load. Done after
      // every check above so a rejected start cannot displace a live run.
      //
      // The student and session ids travel with it as `Id` / `StreamSessionId`,
      // which is how they come back to posta's /get-results as user_id and
      // session_id.
      setLiveScenario(scenario, { userId: req.user._id, sessionId });

      res.json({ session_id: sessionId, redirect_url: getSimulatorUrl() });
    } catch (err) {
      console.error("Start Session Error:", err);
      res
        .status(err.statusCode || 500)
        .json({ message: err.message || "Server error starting session." });
    }
  },
);

/*
 * ── Session completion callback ────────────────────────────────────────────────
 *
 * The return leg of the handoff that POST /start begins. When a student finishes
 * in the simulator, the simulator calls back here with the same JWE token,
 * and the transcript, coach feedback and score are pulled from Voxio and stored.
 *
 * Ported from the standalone FastAPI "posta" service that ran on :8000.
 */

/**
 * Turn Voxio's conversation history into what sessionModel accepts.
 *
 * The schema requires role + content on every entry and allows only
 * system/user/assistant, so anything malformed is dropped rather than failing
 * the whole save — losing one line beats losing the session and its score.
 */
const normaliseTranscription = (history) => {
  if (!Array.isArray(history)) return [];

  return history.reduce((acc, entry) => {
    if (!entry || typeof entry !== "object") return acc;

    const role = entry.role === "model" ? "assistant" : entry.role;
    const content = entry.content ?? entry.text;

    if (!["system", "user", "assistant"].includes(role)) return acc;
    if (content === undefined || content === null) return acc;

    acc.push({ role, content: String(content) });
    return acc;
  }, []);
};

router.post("/complete", async (req, res) => {
  // Header first (how the Python service received it); body is accepted too so
  // the simulator can post it either way.
  const token = req.get("token") || req.body?.token;

  if (!token) {
    return res.status(401).json({ status: "error", message: "Missing token." });
  }

  let payload;
  try {
    // The JWE is the only credential here — there is no logged-in user on this
    // request. Decrypting it proves the caller holds a token this server minted.
    ({ payload } = await jwtDecrypt(token, getJweKey()));
  } catch (err) {
    console.error("[SESSION] Rejected callback token:", err.message);
    return res
      .status(401)
      .json({ status: "error", message: "Invalid or expired token." });
  }

  const { session_id, student_id, scenario_id } = payload;

  if (!session_id || !student_id || !scenario_id) {
    return res.status(400).json({
      status: "error",
      message: "Token is missing session_id, student_id or scenario_id.",
    });
  }

  try {
    // A replayed callback returns the stored result instead of duplicating it.
    const existing = await Session.findOne({ session_id });
    if (existing) {
      return res.json({
        status: "success",
        message: "Session was already recorded.",
        session_id: existing._id,
      });
    }

    const { transcription, feedback, score } = await fetchSessionState(session_id);

    const session = await Session.create({
      session_id,
      student_id: String(student_id),
      scenario_id: String(scenario_id),
      transcription: normaliseTranscription(transcription),
      feedback: feedback ?? "",
      score: Number.isFinite(Number(score)) ? Number(score) : 0,
    });

    res.status(201).json({
      status: "success",
      message: "Details updated succesfully at dashboard",
      session_id: session._id,
    });
  } catch (err) {
    // A racing duplicate loses to the unique index rather than double-inserting.
    if (err.code === 11000) {
      const existing = await Session.findOne({ session_id });
      return res.json({
        status: "success",
        message: "Session was already recorded.",
        session_id: existing?._id,
      });
    }

    console.error("[SESSION] complete failed:", err);
    res.status(err.statusCode || 500).json({
      status: "error",
      message: publicMessage(err, "Could not record this session."),
    });
  }
});

router.get("/by-student/:studentId/:scenarioId", protect, async (req, res) => {
  try {
    const { studentId, scenarioId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    if (!studentId || !scenarioId) {
      return res
        .status(400)
        .json({ message: "Student ID and Scenario ID are required" });
    }

    const query = {
      student_id: studentId,
      scenario_id: scenarioId,
    };

    const [sessions, total] = await Promise.all([
      Session.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("transcription feedback score createdAt"),
      Session.countDocuments(query),
    ]);

    res.json({
      sessions,
      totalCount: total,
      hasMore: skip + sessions.length < total,
      currentPage: page,
    });
  } catch (err) {
    console.error("Get Sessions Error:", err);
    res.status(500).json({ message: "Server error fetching sessions." });
  }
});

router.get(
  "/student/:studentId",
  protect,
  checkAccess("viewStudents"),
  async (req, res) => {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({ message: "Student ID is required" });
      }

      if (req.scope.educatorId) {
        const student = await User.findById(studentId);
        if (
          !student ||
          student.supervisor?.toString() !== req.scope.educatorId.toString()
        ) {
          return res
            .status(403)
            .json({ message: "Access denied: Not your student" });
        }
      }

      const sessions = await Session.find({ student_id: studentId })
        .sort({ createdAt: -1 })
        .limit(20);

      if (sessions.length === 0) {
        return res.json([]);
      }

      const scenarioIds = [...new Set(sessions.map((s) => s.scenario_id))];
      const scenarios = await Scenario.find({
        _id: { $in: scenarioIds },
      }).select("_id scenarioName");
      const scenarioMap = scenarios.reduce((acc, s) => {
        acc[s._id.toString()] = s.scenarioName;
        return acc;
      }, {});

      const sessionsWithScenarioName = sessions.map((session) => ({
        ...session.toObject(),
        scenario_id: {
          _id: session.scenario_id,
          scenarioName: scenarioMap[session.scenario_id] || "Unknown Scenario",
        },
      }));

      res.json(sessionsWithScenarioName);
    } catch (err) {
      console.error("Get Student Sessions Error:", err);
      res
        .status(500)
        .json({ message: "Server error fetching student sessions." });
    }
  },
);

router.get("/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json(session);
  } catch (err) {
    console.error("Get Session By ID Error:", err);
    res.status(500).json({ message: "Server error fetching session." });
  }
});

export default router;
