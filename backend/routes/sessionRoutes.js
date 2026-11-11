import express from "express";
import { forStudent } from "../utils/reasoningScore.js";
import { writeReport } from "../utils/feedbackReport.js";
import Group from "../models/groupModel.js";
import mongoose from "mongoose";
import { jwtDecrypt } from "jose";
import { createSecretKey } from "crypto";
import { startTrace } from "../utils/routeTrace.js";
import { endAndGrade, reasoningTurn, syncFromVoxio } from "../utils/voxioEngine.js";
import { ensureFlow } from "../utils/voxioSync.js";
import SimConversation from "../models/simConversationModel.js";
import { publicMessage } from "../utils/appEnv.js";
import { setLiveScenario } from "../state/liveScenario.js";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import { isAssignedToStudent } from "../utils/scenarioAssignment.js";
import { TARGET, byCriterion, learnerCriteria } from "../utils/learning.js";
import { parsePagination, pageResponse } from "../utils/pagination.js";
// Where a student is sent to run a scenario. Shared with the educator's Test
// button so the two cannot point at different simulator builds.
import { roomUrlFor } from "../utils/roomUrl.js";
import { roomSessions, roomPageUrl } from "../state/roomSessions.js";
import { roomCustoms } from "../utils/voxioSync.js";
import { getVoxioState } from "../utils/voxioClient.js";
import { gradingOf, reflectionOf, reasoningOf, transcriptOf } from "../utils/voxioState.js";
import { reasoningRecord } from "../utils/reasoningScore.js";
import { scenarioFor } from "../utils/simEngine.js";
import { cleanHtTurns, finaliseHt, mergeHtTurns } from "../utils/htTimeline.js";
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
      const flowKey = await ensureFlow(scenario);
      setLiveScenario(flowKey === scenario.apiKey ? scenario : { ...(scenario.toObject?.() ?? scenario), apiKey: flowKey }, {
        userId: req.user._id,
        sessionId,
      });

      /*
       * STUDENT_ROOM_URL set (e.g. /room.html): the student goes to our Voxio WebRTC room, like an
       * educator's Test; the room reports results back (POST /:sessionId/room-results). Unset: the
       * StreamPixel simulator, as before.
       */
      const studentRoom = process.env.STUDENT_ROOM_URL;
      if (studentRoom) roomSessions.set(sessionId, { customs: await roomCustoms(scenario._id), userId: String(req.user._id) });
      const redirectUrl = studentRoom ? roomPageUrl(studentRoom, { sessionId, scenario }) : roomUrlFor(sessionId);
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
    // Pull Voxio's latest state first, so the record holds the final results.
    await syncFromVoxio(session_id).catch((err) => trace.warn("Voxio sync before complete failed", err.message));
    const conv = await SimConversation.findOne({ session_id }).lean();
    const result = {
      transcription: (conv?.diagnosis_history || []).map(({ role, content }) => ({ role, content })),
      feedback: conv?.feedback || "",
      score: Number.isFinite(conv?.score) ? conv.score : 0,
      question_results: conv?.question_results || [],
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

/* The signed-in student's own attempts, newest first (dashboard and cards). No grading detail. */
router.get("/mine", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Students only" });
    const rows = await Session.find({ student_id: String(req.user._id) })
      .select("scenario_id score createdAt student_flag reflection.summary").sort({ createdAt: -1 }).limit(200).lean();
    const ids = [...new Set(rows.map((r) => r.scenario_id))].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const names = new Map((await Scenario.find({ _id: { $in: ids } }).select("_id scenarioName").lean()).map((s) => [String(s._id), s.scenarioName]));
    res.json(rows.map((r) => ({
      _id: r._id, scenarioId: r.scenario_id, scenarioName: names.get(r.scenario_id) || "Scenario", score: r.score, createdAt: r.createdAt,
      flagged: !!r.student_flag, reflection: r.reflection?.summary || null,
    })));
  } catch (err) {
    console.error("My sessions error:", err);
    res.status(500).json({ message: "Server error fetching your sessions." });
  }
});

/*
 * Readiness by area for the signed-in student: per grading criterion (e.g. "Red flags"), the share
 * of questions met on the latest attempt of each scenario. Only criterion names and percentages
 * leave the server, never the questions or evidence (mindsets/student.md, S8). An educator's
 * corrected verdict counts over the AI's.
 */
router.get("/mine/readiness", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Students only" });
    const rows = await Session.find({ student_id: String(req.user._id), "question_results.0": { $exists: true } })
      .select("+question_results scenario_id createdAt").sort({ createdAt: -1 }).limit(200).lean();
    const latest = new Map();
    rows.forEach((r) => { if (!latest.has(r.scenario_id)) latest.set(r.scenario_id, r); });
    const by = new Map();
    for (const r of latest.values()) {
      for (const q of r.question_results || []) {
        const key = q.criterion || "General";
        const v = q.review?.observed || q.observed;
        const c = by.get(key) || { criterion: key, n: 0, met: 0 };
        c.n += 1;
        c.met += v === "yes" ? 1 : v === "partly" ? 0.5 : 0;
        by.set(key, c);
      }
    }
    res.json({
      scenarios: latest.size,
      areas: [...by.values()].map((c) => ({ criterion: c.criterion, questions: c.n, met: Math.round((c.met / c.n) * 100) })).sort((a, b) => a.met - b.met),
    });
  } catch (err) {
    console.error("Readiness error:", err);
    res.status(500).json({ message: "Server error fetching readiness." });
  }
});

/*
 * The student's current learning focus: the criterion with most room to grow, its trend over repeat
 * attempts at one scenario (the comparable view), strengths and priorities, and the scenario where it
 * was weakest. Criterion names and percentages only, never questions or evidence (S8).
 */
router.get("/mine/focus", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Students only" });
    const rows = await Session.find({ student_id: String(req.user._id), "question_results.0": { $exists: true } })
      .select("+question_results scenario_id createdAt").sort({ createdAt: 1 }).limit(300).lean();
    const pooled = learnerCriteria(rows);
    if (!pooled.size) return res.json({ focus: null });
    const ranked = [...pooled].map(([criterion, pct]) => ({ criterion, pct })).sort((a, b) => a.pct - b.pct);
    const focus = ranked[0];

    // Trend on the focus criterion: the scenario with the most attempts that graded it.
    const perScenario = new Map();
    for (const s of rows) {
      const c = byCriterion(s.question_results).get(focus.criterion);
      if (!c) continue;
      const list = perScenario.get(s.scenario_id) || [];
      list.push({ at: s.createdAt, pct: Math.round((c.met / c.n) * 100) });
      perScenario.set(s.scenario_id, list);
    }
    const [trendScenario, trend] = [...perScenario].sort((a, b) => b[1].length - a[1].length)[0] || [null, []];
    const weakest = [...perScenario].map(([id, l]) => [id, l[l.length - 1].pct]).sort((a, b) => a[1] - b[1])[0];
    const ids = [trendScenario, weakest?.[0]].filter((id) => id && mongoose.Types.ObjectId.isValid(id));
    const names = new Map((await Scenario.find({ _id: { $in: ids } }).select("_id scenarioName").lean()).map((s) => [String(s._id), s.scenarioName]));

    res.json({
      target: TARGET,
      focus,
      strengths: ranked.filter((r) => r.pct >= TARGET).reverse().slice(0, 3),
      priorities: ranked.filter((r) => r.pct < TARGET).slice(0, 3),
      trend: { scenarioId: trendScenario, scenarioName: names.get(trendScenario) || null, points: trend.slice(-6) },
      weakestScenario: weakest ? { scenarioId: weakest[0], scenarioName: names.get(weakest[0]) || null, pct: weakest[1] } : null,
    });
  } catch (err) {
    console.error("Focus error:", err);
    res.status(500).json({ message: "Server error fetching your focus." });
  }
});

/* A student's private note and/or "something wrong" flag on their own attempt. Body: { note?, flag? }. */
router.patch("/:sessionId/mine", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Students only" });
    if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) return res.status(404).json({ message: "Session not found." });
    const s = await Session.findById(req.params.sessionId);
    if (!s || s.student_id !== String(req.user._id)) return res.status(404).json({ message: "Session not found." });
    const { note, flag, rating } = req.body || {};
    if (rating !== undefined) {
      const r = Number(rating);
      if (rating !== null && !(r >= 1 && r <= 5)) return res.status(400).json({ message: "Rating is 1 to 5." });
      s.student_rating = rating === null ? undefined : Math.round(r);
    }
    if (note !== undefined) s.student_note = String(note || "").slice(0, 2000) || undefined;
    if (flag !== undefined) {
      if (flag === null) s.student_flag = undefined;
      else {
        if (!["misheard", "feedback", "technical", "other"].includes(flag.reason)) return res.status(400).json({ message: "Pick what went wrong." });
        s.student_flag = { reason: flag.reason, text: String(flag.text || "").slice(0, 1000), at: new Date() };
      }
    }
    await s.save();
    res.json({ student_note: s.student_note || "", student_flag: s.student_flag || null, student_rating: s.student_rating ?? null });
  } catch (err) {
    console.error("Student session update error:", err);
    res.status(500).json({ message: "Server error saving that." });
  }
});

router.get("/by-student/:studentId/:scenarioId", protect, async (req, res) => {
  try {
    const { studentId, scenarioId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));

    // A student reads only their own attempts; an educator only their own students'.
    if (req.user.role === "student" && String(req.user._id) !== String(studentId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    if (req.user.role === "educator") {
      const owner = await User.findById(studentId).select("supervisor").lean();
      if (!owner || String(owner.supervisor) !== String(req.user._id)) return res.status(403).json({ message: "Access denied: Not your student" });
    }
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
        .select(`transcription feedback score createdAt student_flag student_rating reflection clinical_reasoning ht_turns ht_final ht_state${req.user.role === "student" ? " student_note" : ""}`),
      Session.countDocuments(query),
    ]);

    res.json({
      // Students get their own results without the educator-only markers (distress, missed red flag).
      sessions: req.user.role === "student" ? sessions.map(forStudent) : sessions,
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
          ? Session.find(sessionQuery).select("+question_results +educator_note").sort(paging.sort).skip(paging.skip).limit(paging.limit)
          : Session.find(sessionQuery).select("+question_results +educator_note").sort({ createdAt: -1 }).limit(20),
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

/*
 * Educator review of one session: override a question's verdict (with a note), clear an
 * override, or set the session note. Body: { number, observed, note } for a question
 * (observed: null clears it), or { sessionNote } for the session. Only for a student the
 * caller supervises (or in their school, for a school_admin). The AI's verdict is never lost.
 */
router.patch(
  "/:sessionId/review",
  protect,
  checkAccess("viewStudents"),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(sessionId)) return res.status(404).json({ message: "Session not found." });
      const session = await Session.findById(sessionId).select("+question_results +educator_note");
      if (!session) return res.status(404).json({ message: "Session not found." });

      const student = await User.findById(session.student_id).select("supervisor schoolId");
      if (!student) return res.status(404).json({ message: "Student not found." });
      if (req.scope.educatorId && student.supervisor?.toString() !== req.scope.educatorId.toString()) {
        return res.status(403).json({ message: "Access denied: Not your student" });
      }
      if (!req.scope.educatorId && req.scope.schoolId && student.schoolId?.toString() !== req.scope.schoolId.toString()) {
        return res.status(403).json({ message: "Access denied: Student not in your school" });
      }

      const stamp = { by: req.user._id, byName: req.user.name || "", at: new Date() };
      const { number, observed, note, sessionNote } = req.body || {};

      if (sessionNote !== undefined) {
        const text = String(sessionNote || "").trim().slice(0, 4000);
        session.educator_note = text ? { text, ...stamp } : undefined;
      }

      if (number !== undefined) {
        const q = (session.question_results || []).find((r) => r.number === Number(number));
        if (!q) return res.status(400).json({ message: `No grading question ${number} in this session.` });
        if (observed === null) {
          q.review = undefined;
        } else {
          if (observed !== undefined && !["yes", "partly", "no"].includes(observed)) {
            return res.status(400).json({ message: "observed must be yes, partly, no or null." });
          }
          q.review = {
            observed: observed ?? q.review?.observed ?? q.observed,
            note: String(note ?? q.review?.note ?? "").slice(0, 2000),
            ...stamp,
          };
        }
        session.markModified("question_results");
      }

      await session.save();
      res.json({ question_results: session.question_results, educator_note: session.educator_note || null });
    } catch (err) {
      console.error("Review session error:", err);
      res.status(500).json({ message: "Server error saving the review." });
    }
  },
);

/*
 * The History Taking Feedback Report as a PDF (utils/feedbackReport.js), built from the stored
 * session so educator corrections are included. ?download=1 saves it; otherwise it opens inline
 * (the app shows it in its own viewer). A student gets only their own; an educator their students';
 * a school admin their school's.
 */
/*
 * Results of a session run in our room (room.html). The room's sessions run on Voxio's gpu
 * environment, which does not call our webhook, so the room sends what it received: the
 * transcript, feedback, score, per-question verdicts, reflection and Clinical Reasoning.
 * Voxio's own state is used instead when the server can read it (it cannot be altered by the
 * browser). Only the student's own session, and only fields that came back are written.
 */
/*
 * One history-taking turn's scores, stored the moment the room receives them, as ci's webhook
 * stores a row per turn. A tab closed mid-case keeps every turn scored so far. Student-owned
 * sessions only; an educator's Test run has no record and gets 404.
 */
router.post("/:sessionId/ht-turn", protect, async (req, res) => {
  try {
    const session = await Session.findOne({ session_id: String(req.params.sessionId), student_id: String(req.user._id) }).select("_id ht_turns").lean();
    if (!session) return res.status(404).json({ message: "Session not found" });
    const incoming = cleanHtTurns([req.body || {}]);
    if (!incoming.length) return res.status(400).json({ message: "No turn." });
    const turns = mergeHtTurns(session.ht_turns, incoming);
    const { final, state } = finaliseHt(turns);
    await Session.updateOne({ _id: session._id }, { $set: { ht_turns: turns, ht_final: final, ht_state: state } });
    res.json({ ok: true, turns: turns.length });
  } catch (err) {
    console.error("HT turn save error:", err);
    res.status(500).json({ message: "Could not save the turn." });
  }
});

router.post("/:sessionId/room-results", protect, async (req, res) => {
  try {
    const session = await Session.findOne({ session_id: String(req.params.sessionId), student_id: String(req.user._id) }).select("_id scenario_id createdAt").lean();
    if (!session) return res.status(404).json({ message: "Session not found" }); // e.g. an educator's Test run
    const b = req.body || {};
    let state = null, source = "room";
    if (b.voxioSessionId) {
      state = await getVoxioState(String(b.voxioSessionId)).catch(() => null);
      if (state) source = "voxio";
    }
    if (!state) {
      const turns = Array.isArray(b.transcript) ? b.transcript.slice(0, 400) : [];
      state = {
        feedback: typeof b.feedback === "string" ? b.feedback.slice(0, 20000) : "",
        score: b.score,
        questions: b.questions,
        ...(b.reflection && { reflection_done: "yes", ...b.reflection }),
        ...(b.cr && { cr_feedback: b.cr.feedback, cr_status: b.cr.status }),
        diagnosis_conversation_history: turns.map((t) => ({ role: t.who === "you" ? "user" : "assistant", content: String(t.text || "").slice(0, 4000) })),
      };
    }
    const { questionList } = await scenarioFor(session.scenario_id);
    const grading = gradingOf(state, questionList);
    const reflection = reflectionOf(state);
    const cr = reasoningOf(state);
    const transcription = transcriptOf(state);
    // Each turn was already stored as it happened (POST /:sessionId/ht-turn); merge, never replace.
    const incomingHt = cleanHtTurns(b.htTurns);
    const storedHt = incomingHt.length ? (await Session.findById(session._id).select("ht_turns").lean())?.ht_turns : null;
    const htTurns = incomingHt.length ? mergeHtTurns(storedHt, incomingHt) : [];
    const ht = htTurns.length ? finaliseHt(htTurns) : null;
    const set = {
      ...(ht && { ht_turns: htTurns, ht_final: ht.final, ht_state: ht.state }),
      ...(transcription.length && { transcription }),
      ...(grading && { feedback: grading.feedback, score: Number.isFinite(grading.score) ? grading.score : 0, question_results: grading.question_results }),
      ...(reflection && { reflection: { ...reflection, completed_at: new Date() } }),
      ...(cr && { clinical_reasoning: { ...reasoningRecord(cr.feedback, cr.status), completed_at: new Date(), source } }),
    };
    if (Object.keys(set).length) await Session.updateOne({ _id: session._id }, { $set: set });

    /*
     * What the room shows next to the feedback (mindsets/student.md S4, S5): the skill names with a
     * percentage (never the questions), the previous attempt's score on this case, and the attempt
     * number. The record id lets the room save the learner's note and flag (PATCH /:id/mine).
     */
    const results = grading?.question_results
      || (await Session.findById(session._id).select("+question_results").lean())?.question_results || [];
    const skills = [...byCriterion(results)].filter(([name]) => name !== "General")
      .map(([name, c]) => ({ name, pct: c.n ? Math.round((c.met / c.n) * 100) : 0 }));
    const earlier = await Session.find({ student_id: String(req.user._id), scenario_id: session.scenario_id, createdAt: { $lt: session.createdAt } })
      .select("score").sort({ createdAt: -1 }).lean();
    const prev = earlier.find((x) => x.score > 0);
    const pct = (v) => (v == null ? null : Math.round(v <= 1 ? v * 100 : v));
    res.json({ ok: true, source, saved: Object.keys(set), recordId: session._id, attempt: earlier.length + 1,
      previous: prev ? pct(prev.score) : null, skills });
  } catch (err) {
    console.error("Room results error:", err);
    res.status(500).json({ message: "Could not save the results." });
  }
});

router.get("/:sessionId/report.pdf", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    // The app passes the record id; the patient room only knows the simulator's session_id.
    const session = await Session.findOne(mongoose.Types.ObjectId.isValid(sessionId) ? { _id: sessionId } : { session_id: String(sessionId) })
      .select("+question_results").lean();
    if (!session) return res.status(404).json({ message: "Session not found" });
    const learner = await User.findById(session.student_id).select("name supervisor schoolId groupId").lean();
    const role = req.user.role, me = String(req.user._id);
    const allowed =
      role === "superadmin" ||
      (role === "student" && String(session.student_id) === me) ||
      (role === "educator" && learner && String(learner.supervisor) === me) ||
      (role === "school_admin" && learner && String(learner.schoolId) === String(req.user.schoolId?._id || req.user.schoolId));
    if (!allowed) return res.status(404).json({ message: "Session not found" });

    const [scenario, group, attempt] = await Promise.all([
      mongoose.Types.ObjectId.isValid(session.scenario_id) ? Scenario.findById(session.scenario_id).select("scenarioName profession").lean() : null,
      learner?.groupId ? Group.findById(learner.groupId).select("name").lean() : null,
      Session.countDocuments({ student_id: session.student_id, scenario_id: session.scenario_id, createdAt: { $lte: session.createdAt } }),
    ]);
    const safe = (t) => String(t || "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "report";
    const file = `${safe(learner?.name)}-${safe(scenario?.scenarioName)}-attempt-${attempt}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${file}"`);
    res.setHeader("Cache-Control", "private, no-store");
    writeReport(res, {
      session: role === "student" ? forStudent(session) : session,
      learner: learner?.name, cohort: group?.name, scenario, attempt,
    });
  } catch (err) {
    console.error("Report error:", err);
    if (!res.headersSent) res.status(500).json({ message: "Could not build the report." });
  }
});

router.get("/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    // Per-question results and the distress flag are for educators and admins,
    // not the student.
    const session = await Session.findById(sessionId).select(
      req.user?.role === "student" ? "-reflection.distress_flag" : "+question_results",
    );

    // A student may only open their own session (it was readable by id before).
    if (!session || (req.user?.role === "student" && String(session.student_id) !== String(req.user._id))) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json(req.user?.role === "student" ? forStudent(session) : session);
  } catch (err) {
    console.error("Get Session By ID Error:", err);
    res.status(500).json({ message: "Server error fetching session." });
  }
});

export default router;
