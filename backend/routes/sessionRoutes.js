import express from "express";
import mongoose from "mongoose";
import { jwtDecrypt } from "jose";
import { createSecretKey } from "crypto";
import { startTrace } from "../utils/routeTrace.js";
import {
  fetchSessionState,
  fetchRawSessionState,
  hasFeedback,
  latestReasoningReply,
  normaliseScore,
  parseStreamLines,
  summariseState,
  streamEndSession,
  streamReasoningTurn,
} from "../utils/voxioClient.js";
import { publicMessage } from "../utils/appEnv.js";
import { setLiveScenario } from "../state/liveScenario.js";
import Scenario from "../models/scenarioModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkAccess } from "../middleware/roleAccessMiddleware.js";
import { isAssignedToStudent } from "../utils/scenarioAssignment.js";
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
const normaliseTranscription = (history, sessionId) => {
  if (!Array.isArray(history)) {
    if (history != null) {
      console.warn(
        `[SESSION] transcript was ${typeof history}, not an array session=${sessionId} — storing none`,
      );
    }
    return [];
  }

  const normalised = history.reduce((acc, entry) => {
    if (!entry || typeof entry !== "object") return acc;

    const role = entry.role === "model" ? "assistant" : entry.role;
    const content = entry.content ?? entry.text;

    if (!["system", "user", "assistant"].includes(role)) return acc;
    if (content === undefined || content === null) return acc;

    acc.push({ role, content: String(content) });
    return acc;
  }, []);

  // Dropping entries is intentional (see above) but was completely silent, so a
  // transcript quietly losing half its turns to an unexpected role name looked
  // like the student barely spoke.
  const dropped = history.length - normalised.length;
  if (dropped > 0) {
    const roles = [...new Set(history.map((e) => e?.role))].join(",");
    console.warn(
      `[SESSION] dropped ${dropped}/${history.length} malformed transcript entries ` +
        `session=${sessionId} rolesSeen=${roles}`,
    );
  }

  return normalised;
};

/*
 * session_id -> promise that settles when the running /feedback call for that
 * session ends. Per process: fine for the single pm2 backend instance.
 */
const feedbackInFlight = new Map();

/**
 * Read a Voxio session's state, logging which phase it is in. The phase is
 * what decides where the next turn goes, so it is the first thing to look at
 * when one call works and the next does not.
 */
const readState = async (trace, label, sessionId) => {
  const state = await fetchRawSessionState(sessionId);
  trace.log(`Voxio state (${label})`, summariseState(state));
  return state;
};

/**
 * Send one turn and return its node outputs, logging every output and every
 * line that was not one — Voxio reports its own errors as such lines.
 */
const runTurn = async (trace, label, upstreamPromise) => {
  const { outputs, other, unparseable } = parseStreamLines(
    await trace.consume(await upstreamPromise),
  );
  trace.log(`${label}: ${outputs.length} node outputs`, outputs);
  if (other.length) trace.log(`${label}: non-output lines`, other);
  if (unparseable.length) trace.warn(`${label}: lines that were not JSON`, unparseable);
  const errors = other.filter((line) => line && (line.error || line.detail || line.status === "error"));
  if (errors.length) trace.warn(`${label}: Voxio reported an error`, errors);
  if (!outputs.length) trace.warn(`${label}: the turn produced NO node outputs`);
  return outputs;
};

/**
 * Ends a running Voxio session and streams its feedback/summary/score back
 * as they arrive, instead of waiting for the whole flow to finish and
 * polling for it afterward.
 *
 * Client sends only `session_id` — everything else (the flow's api_key,
 * conversation state) already lives on Voxio's side, keyed by that id.
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

  /*
   * Phases are tracked by Voxio, not here, so read its state first. Feedback
   * already produced means this is a repeat call: answering from the state,
   * rather than sending "end the session" again, keeps a second call from
   * landing in the reasoning phase and coming back as a reasoning reply.
   */
  const fromState = (state) => ({
    feedback: state.feedback,
    score: normaliseScore(state.score),
  });

  // Every feedback answer is logged in full (pm2 logs vps-backend), so a 0 or
  // odd score can be checked against the feedback text that came with it.
  const reply = (result) => {
    console.log(
      `[FEEDBACK] session=${sessionId} score=${JSON.stringify(result.score)}
` +
        `[FEEDBACK] text: ${JSON.stringify(result.feedback ?? "")}`,
    );
    // `sc` is a fixed constant the simulator expects on every feedback reply.
    return trace.send(res, 200, { ...result, sc: 1.5342 });
  };

  /*
   * A second /feedback for the same session while the first is still waiting
   * on the LLM (a game retry after its own timeout) would send another "end the
   * session" turn — which lands in the reasoning phase. It waits for the first
   * call instead and then answers from the state.
   */
  const running = feedbackInFlight.get(sessionId);
  if (running) {
    trace.warn("another /feedback for this session is still running — waiting for it instead of sending a second end turn");
    await running.catch(() => {});
    try {
      const state = await readState(trace, "after waiting for the concurrent call", sessionId);
      if (hasFeedback(state)) {
        trace.log("PATH: feedback from state, produced by the concurrent call");
        return reply(fromState(state));
      }
      return trace.send(res, 502, { message: "The simulator did not produce feedback for this session." });
    } catch (err) {
      trace.fail(err);
      return trace.send(res, err.statusCode || 502, { message: err.message || "Could not get feedback." });
    }
  }
  let finish;
  feedbackInFlight.set(sessionId, new Promise((resolve) => { finish = resolve; }));

  try {
    let state = await readState(trace, "before", sessionId);
    if (!state) {
      trace.warn("Voxio has no session with that id — wrong id, or the session expired on Voxio");
      return trace.send(res, 404, { message: "No simulator session with that session_id." });
    }
    if (hasFeedback(state)) {
      trace.log("PATH: feedback already generated — returning it from state without another turn");
      return reply(fromState(state));
    }
    if (state.reasoning_conversation_history?.length) {
      trace.warn("state has reasoning turns but no feedback — the flow is in an unexpected phase");
    }

    /*
     * One retry: the patient node decides end_diagnosis, and a stray "no" sends
     * the turn back to the consultation instead of to the feedback node.
     */
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      trace.log(`PATH: sending end-session turn (attempt ${attempt}/2)`, { sessionId });
      const outputs = await runTurn(trace, `end turn ${attempt}`, streamEndSession(sessionId));

      // Read the field by name — feedbacko emits { feedback, score }. Every
      // other output in this turn (the patient's goodbye, echoes) is ignored.
      const result = outputs.find((out) => "feedback" in out);
      const endDiagnosis = outputs.find((out) => "end_diagnosis" in out)?.end_diagnosis;
      trace.log(`end turn ${attempt}: decision inputs`, {
        end_diagnosis: endDiagnosis ?? "(not emitted)",
        feedbackOutput: result ? `${typeof result.feedback}, ${String(result.feedback ?? "").length} chars` : "(none)",
        scoreOutput: result ? result.score ?? "(none)" : "(none)",
      });
      if (result?.feedback) {
        if (normaliseScore(result.score) === null) {
          trace.warn("feedback arrived but score is missing or not a number", { score: result.score });
        }
        trace.log("PATH: feedback taken from the stream");
        return reply({
          feedback: String(result.feedback),
          score: normaliseScore(result.score),
        });
      }
      if (result) trace.warn("feedback output was present but EMPTY", result);

      state = await readState(trace, `after end turn ${attempt}`, sessionId);
      if (hasFeedback(state)) {
        trace.log("PATH: feedback not in the stream but found in state after the turn");
        return reply(fromState(state));
      }
      trace.warn(
        `no feedback after attempt ${attempt}: ` +
          (endDiagnosis === undefined
            ? "the patient node emitted no end_diagnosis (LLM output malformed or the turn failed)"
            : String(endDiagnosis).toLowerCase() === "yes"
              ? "end_diagnosis was yes, so the FEEDBACK node failed or returned nothing"
              : `the patient node said end_diagnosis=${JSON.stringify(endDiagnosis)}, so the flow stayed in the consultation`),
      );
    }

    trace.warn("giving up after 2 attempts", summariseState(state));
    return trace.send(res, 502, {
      message: "The simulator did not produce feedback for this session.",
    });
  } catch (err) {
    trace.fail(err);
    if (res.headersSent) return;
    trace.send(res, err.statusCode || 502, {
      message: err.message || "Could not get feedback.",
    });
  } finally {
    feedbackInFlight.delete(sessionId);
    finish();
  }
});

/**
 * One turn of clinical reasoning: student sends `session_id` + their `input`,
 * Voxio's `reasoning` node replies, and that reply is streamed back as it
 * arrives — same shape as /feedback, just with a caller-supplied message
 * instead of a fixed end-of-session one.
 */
// Unauthenticated on purpose, same as /feedback: called by the simulator.
router.post("/reasoning", async (req, res) => {
  const trace = startTrace("reasoning", req);
  const sessionId = String(req.body?.session_id || "").trim();
  const input = String(req.body?.input || "").trim();
  if (!sessionId || !input) {
    trace.warn("rejected: session_id or input missing", {
      hasSessionId: !!sessionId,
      hasInput: !!input,
      received: Object.keys(req.body || {}),
    });
    return trace.send(res, 400, {
      message: "session_id and input are required.",
    });
  }

  try {
    const state = await readState(trace, "before", sessionId);
    if (!state) {
      trace.warn("Voxio has no session with that id — wrong id, or the session expired on Voxio");
      return trace.send(res, 404, { message: "No simulator session with that session_id." });
    }
    /*
     * Until feedback exists the flow is still in the consultation, so this
     * input would be answered by the patient, not the reasoning coach.
     */
    if (!hasFeedback(state)) {
      trace.warn("rejected: reasoning before feedback (the game must call /feedback first and wait for it)");
      return trace.send(res, 409, {
        message: "Call /api/sessions/feedback for this session before clinical reasoning.",
      });
    }

    trace.log("PATH: sending reasoning turn", { sessionId, input });
    const outputs = await runTurn(trace, "reasoning turn", streamReasoningTurn(sessionId, input));

    /*
     * response2 emits { response }; transcription2 only echoes { user_input }.
     * A flow published before the rename still emits { speak } from the
     * reasoning node — accepted until every scenario has been rebuilt.
     */
    const replies = outputs.filter(
      (out) => typeof (out.response ?? out.speak) === "string" && (out.response ?? out.speak).trim(),
    );
    if (replies.length > 1) trace.warn(`${replies.length} reply outputs in one turn — using the last`);
    if (outputs.some((out) => "feedback" in out || "score" in out || "end_diagnosis" in out)) {
      trace.warn("reasoning turn emitted feedback/score/end_diagnosis — the flow is not in the reasoning phase");
    }
    const last = replies[replies.length - 1];
    let reply = last ? String(last.response ?? last.speak) : "";
    if (last) {
      trace.log(`PATH: reply taken from the stream's "${"response" in last ? "response" : "speak"}" field`, `${reply.length} chars`);
      if (!("response" in last)) {
        trace.warn("this scenario's flow still uses the old `speak` field — rebuild it (scripts/rebuildVoxioFlows.mjs)");
      }
    }
    /*
     * response2 emits the `response` variable, not the node's fresh output. When
     * the model answers under another key (it has drifted to the patient's
     * `speak`), `response` is never overwritten and the previous turn's reply is
     * emitted again. The node's real output is the last assistant entry in the
     * reasoning history.
     */
    if (reply && "response" in last && typeof state.response === "string" && reply === state.response) {
      trace.warn("stream repeated the previous turn's reply — the model answered under another key; reading this turn's reply from the reasoning history");
      const fresh = latestReasoningReply(await readState(trace, "after stale reasoning turn", sessionId));
      if (fresh && fresh !== reply) {
        trace.log("PATH: reply taken from the reasoning history", `${fresh.length} chars`);
        reply = fresh;
      } else {
        trace.warn("the reasoning history has no newer reply either");
      }
    }
    if (!reply) {
      const after = await readState(trace, "after reasoning turn", sessionId);
      reply = latestReasoningReply(after);
      trace.warn("no response in the stream — read the reply from state", { found: !!reply });
    }

    if (!reply) {
      return trace.send(res, 502, { message: "The reasoning coach returned no reply." });
    }
    /*
     * Returned to the simulator under `feedback`, the same key /feedback uses,
     * so the game reads both endpoints the same way. Inside Voxio the node
     * still writes `response`: writing `feedback` there would overwrite the
     * session's real feedback in the shared state.
     */
    return trace.send(res, 200, { feedback: reply });
  } catch (err) {
    trace.fail(err);
    if (res.headersSent) return;
    trace.send(res, err.statusCode || 502, {
      message: err.message || "Could not get a reasoning reply.",
    });
  }
});

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
    return trace.send(res, 401, {
      status: "error",
      message: "Invalid or expired token.",
    });
  }

  trace.log("token decrypted", payload);
  const { session_id, student_id, scenario_id } = payload;

  if (!session_id || !student_id || !scenario_id) {
    return trace.send(res, 400, {
      status: "error",
      message: "Token is missing session_id, student_id or scenario_id.",
    });
  }

  try {
    // A replayed callback returns the stored result instead of duplicating it.
    const existing = await Session.findOne({ session_id });
    if (existing) {
      trace.log("already recorded — replayed callback", { _id: existing._id });
      return trace.send(res, 200, {
        status: "success",
        message: "Session was already recorded.",
        session_id: existing._id,
      });
    }

    trace.log("fetching session state from Voxio", { session_id });
    const state = await fetchSessionState(session_id);
    trace.log("Voxio session state", state);
    const { transcription, feedback, score } = state;

    if (!Number.isFinite(Number(score))) {
      trace.warn(
        `score was ${JSON.stringify(score)} — storing 0, ` +
          "which is indistinguishable from a genuinely bad consultation on the dashboard",
      );
    }

    const session = await Session.create({
      session_id,
      student_id: String(student_id),
      scenario_id: String(scenario_id),
      transcription: normaliseTranscription(transcription, session_id),
      feedback: feedback ?? "",
      score: Number.isFinite(Number(score)) ? Number(score) : 0,
    });

    trace.log(
      `recorded _id=${session._id} student=${student_id} scenario=${scenario_id} ` +
        `turns=${session.transcription.length} score=${session.score}`,
    );

    trace.send(res, 201, {
      status: "success",
      message: "Details updated succesfully at dashboard",
      session_id: session._id,
    });
  } catch (err) {
    // A racing duplicate loses to the unique index rather than double-inserting.
    if (err.code === 11000) {
      trace.warn("duplicate insert lost the race — returning the stored session");
      const existing = await Session.findOne({ session_id });
      return trace.send(res, 200, {
        status: "success",
        message: "Session was already recorded.",
        session_id: existing?._id,
      });
    }

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
