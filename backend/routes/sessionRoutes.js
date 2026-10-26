import express from "express";
import mongoose from "mongoose";
import { jwtDecrypt } from "jose";
import { createSecretKey } from "crypto";
import { startTrace } from "../utils/routeTrace.js";
import { endAndGrade, reasoningTurn } from "../utils/simEngine.js";
import SimConversation from "../models/simConversationModel.js";
import { publicMessage } from "../utils/appEnv.js";
import { setLiveScenario } from "../state/liveScenario.js";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import { isAssignedToStudent } from "../utils/scenarioAssignment.js";
import { parsePagination, pageResponse } from "../utils/pagination.js";
// Where a student is sent to run a scenario. Shared with the educator's Test
// button so the two cannot point at different simulator builds.
import { roomUrlFor } from "../utils/roomUrl.js";
import {
  isScenarioTestable,
  NOT_TESTABLE_MESSAGE,
} from "../utils/testableScenarios.js";

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

      /*
       * Checked after assignment so the more specific error wins, and checked here
       * rather than only on the button because a start creates a Session row and
       * displaces the live scenario — both real effects a disabled button does not
       * prevent.
       */
      if (!isScenarioTestable(scenario._id)) {
        return res.status(403).json({ message: NOT_TESTABLE_MESSAGE });
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

      const redirectUrl = roomUrlFor(sessionId);
      console.log(
        `[SESSION] started session=${sessionId} student=${req.user._id} ` +
          `scenario=${scenario._id} room=${redirectUrl}`,
      );

      res.json({ session_id: sessionId, redirect_url: redirectUrl });
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
 * and the transcript, coach feedback and score are stored on the Session row.
 *
 * Ported from the standalone FastAPI "posta" service that ran on :8000.
 */

/*
 * The simulator gets a score out of 10. The grader returns the share of
 * questions met (0-1); every attempt starts from a base of 2, so that share is
 * mapped onto 2-10: a consultation that covers nothing scores 2 and a perfect
 * one scores 10. Rounded to one decimal. A missing score stays null rather than
 * being passed off as a base score. The logs keep the graded 0-1 value alongside.
 */
const BASE_SCORE = 2;
const MAX_SCORE = 10;
const withBaseScore = (score) =>
  score === null
    ? null
    : Math.round((BASE_SCORE + (MAX_SCORE - BASE_SCORE) * Math.min(Math.max(score, 0), 1)) * 10) / 10;

/**
 * Ends the consultation and returns the feedback and score.
 *
 * The game sends only `session_id`. A repeat call (a game retry) gets the
 * feedback already produced instead of a second grading.
 */
// Unauthenticated on purpose: the Unreal simulator calls this with no dashboard
// login token. Anyone holding a session_id can end that session and read its
// feedback.
router.post("/feedback", async (req, res) => {
  const trace = startTrace("feedback", req);
  const sessionId = String(req.body?.session_id || "").trim();
  if (!sessionId) {
    trace.warn("rejected: no session_id", { received: Object.keys(req.body || {}) });
    return trace.send(res, 400, { message: "session_id is required." });
  }

  try {
    const { feedback, score, repeated } = await endAndGrade(sessionId);
    const sent = withBaseScore(score);
    console.log(
      `[FEEDBACK] session=${sessionId} path=${repeated ? "already-graded" : "graded"} ` +
        `sent=${JSON.stringify(sent)} graded=${JSON.stringify(score)} chars=${feedback.length}`,
    );
    if (score === null || score < 0.1) {
      console.warn(`[FEEDBACK][LOW-SCORE] session=${sessionId} graded=${JSON.stringify(score)}`);
    }
    // `sc` is a fixed constant the simulator expects on every feedback reply.
    return trace.send(res, 200, { feedback, score: sent, sc: 1.5342 });
  } catch (err) {
    trace.fail(err);
    return trace.send(res, err.statusCode || 502, {
      message: publicMessage(err, "Could not get feedback."),
    });
  }
});

/**
 * One turn of clinical reasoning after feedback: `session_id` + the student's
 * `input` in, the tutor's reply out under `feedback` (the key the game already
 * reads from /feedback).
 */
// Unauthenticated on purpose, same as /feedback: called by the simulator.
router.post("/reasoning", async (req, res) => {
  const trace = startTrace("reasoning", req);
  const sessionId = String(req.body?.session_id || "").trim();
  const input = String(req.body?.input || "").trim();
  if (!sessionId || !input) {
    trace.warn("rejected: session_id or input missing", { received: Object.keys(req.body || {}) });
    return trace.send(res, 400, { message: "session_id and input are required." });
  }

  try {
    const { response } = await reasoningTurn(sessionId, input);
    return trace.send(res, 200, { feedback: response });
  } catch (err) {
    trace.fail(err);
    return trace.send(res, err.statusCode || 502, {
      message: publicMessage(err, "Could not get a reasoning reply."),
    });
  }
});

/**
 * The simulator's end-of-run callback, carrying the JWE token minted at start.
 * Results are already on the Session row (the engine writes them as they are
 * produced); this makes sure the row exists and holds the final state.
 */
router.post("/complete", async (req, res) => {
  const trace = startTrace("complete", req);
  // Header first (how the Python service received it); body is accepted too so
  // the simulator can post it either way.
  const token = req.get("token") || req.body?.token;
  if (!token) {
    trace.warn("rejected: no token in header or body");
    return trace.send(res, 401, { status: "error", message: "Missing token." });
  }

  let payload;
  try {
    // The JWE is the only credential here — there is no logged-in user on this
    // request. Decrypting it proves the caller holds a token this server minted.
    ({ payload } = await jwtDecrypt(token, getJweKey()));
  } catch (err) {
    trace.warn("rejected: token did not decrypt", err.message);
    return trace.send(res, 401, { status: "error", message: "Invalid or expired token." });
  }

  const { session_id, student_id, scenario_id } = payload;
  if (!session_id || !student_id || !scenario_id) {
    return trace.send(res, 400, {
      status: "error",
      message: "Token is missing session_id, student_id or scenario_id.",
    });
  }

  try {
    const conv = await SimConversation.findOne({ session_id }).lean();
    const result = {
      transcription: (conv?.diagnosis_history || []).map(({ role, content }) => ({ role, content })),
      feedback: conv?.feedback || "",
      score: Number.isFinite(conv?.score) ? conv.score : 0,
    };
    const session = await Session.findOneAndUpdate(
      { session_id },
      {
        $set: result,
        $setOnInsert: { student_id: String(student_id), scenario_id: String(scenario_id) },
      },
      { upsert: true, new: true },
    );
    trace.log(
      `recorded _id=${session._id} student=${student_id} scenario=${scenario_id} ` +
        `turns=${session.transcription.length} score=${session.score}`,
    );
    trace.send(res, 200, {
      status: "success",
      message: "Details updated succesfully at dashboard",
      session_id: session._id,
    });
  } catch (err) {
    trace.fail(err);
    trace.send(res, err.statusCode || 500, {
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

      // ?page= returns one page with counts; without it, the latest 20 as before.
      const paging = parsePagination(req.query, { createdAt: "createdAt", score: "score" });
      const sessionQuery = { student_id: studentId };
      const [sessions, total] = await Promise.all([
        paging
          ? Session.find(sessionQuery).sort(paging.sort).skip(paging.skip).limit(paging.limit)
          : Session.find(sessionQuery).sort({ createdAt: -1 }).limit(20),
        paging ? Session.countDocuments(sessionQuery) : null,
      ]);

      if (sessions.length === 0) {
        return res.json(paging ? pageResponse([], total, paging) : []);
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

      res.json(
        paging
          ? pageResponse(sessionsWithScenarioName, total, paging)
          : sessionsWithScenarioName,
      );
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
