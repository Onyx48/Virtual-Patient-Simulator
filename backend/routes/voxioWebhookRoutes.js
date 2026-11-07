/**
 * POST /api/voxio/webhook?token=<VOXIO_WEBHOOK_SECRET>
 *
 * Voxio posts here while each session runs ("started", "running" after every
 * turn) and once when it ends ("finished"). It matters for sessions that talk
 * to Voxio directly, such as voice through Voxio's voice service, which never
 * pass through /agents on this server: their transcript, feedback, score and
 * reflection still reach the dashboard.
 *
 * Every scenario's flow is given this URL by utils/voxioFlow.js when
 * PUBLIC_API_URL and VOXIO_WEBHOOK_SECRET are set. The token is the only
 * credential; Voxio sends no signature.
 */
import express from "express";
import { timingSafeEqual } from "crypto";
import { syncFromVoxio } from "../utils/voxioEngine.js";

const router = express.Router();

const tokenOk = (given) => {
  const secret = process.env.VOXIO_WEBHOOK_SECRET || "";
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(secret);
  return secret && a.length === b.length && timingSafeEqual(a, b);
};

router.post("/webhook", express.json({ limit: "5mb" }), (req, res) => {
  if (!tokenOk(req.query.token)) return res.sendStatus(401);
  const { status, session_id: sessionId } = req.body || {};
  // Answer at once; Voxio does not wait on us.
  res.sendStatus(200);
  if (!sessionId || status === "started") return;
  const state = req.body?.["session-data"]?.state;
  syncFromVoxio(String(sessionId), state)
    .then((found) => {
      if (found) console.log(`[VOXIO] webhook ${status} session=${sessionId} turns=${found.transcription.length} graded=${Boolean(found.grading)}`);
    })
    .catch((err) => console.error(`[VOXIO] webhook sync failed session=${sessionId}: ${err.message}`));
});

export default router;
