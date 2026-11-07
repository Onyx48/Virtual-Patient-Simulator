// End-to-end check of the Test room, from Node, through the real voxioagent SDK:
// builds a scenario's customs exactly as the backend does, starts a gpu session on
// VITE_VOXIO_TEST_FLOW_KEY, types a few student lines and prints what comes back.
// Costs credits (one short session). Needs werift (WebRTC for Node) on NODE_PATH or installed.
// Usage: node scripts/testRoomSession.mjs "<part of scenario name>" ["line 1" "line 2" ...]
import "../backend/loadEnv.js";
import dns from "dns";
import { createRequire } from "module";
import mongoose from "mongoose";
import Scenario from "../backend/models/scenarioModel.js";
import { roomCustoms } from "../backend/utils/voxioSync.js";
import { createSession } from "voxioagent/client";

const require = createRequire(process.env.WERIFT_FROM || import.meta.url);
const { RTCPeerConnection, MediaStream, MediaStreamTrack } = require("werift");
globalThis.MediaStream ??= MediaStream;

const [name = "", ...lines] = process.argv.slice(2);
const STUDENT = lines.length ? lines : ["Good morning.", "What brings you in today?", "Can you bend forward for me?"];

dns.setServers(["8.8.8.8", "1.1.1.1"]); // same as backend/db.js
await mongoose.connect(process.env.MONGODB_URI);
const scenario = await Scenario.findOne({ scenarioName: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
  .sort({ updatedAt: -1 }).select("_id scenarioName").lean();
if (!scenario) throw new Error(`no scenario matching "${name}"`);
const customs = await roomCustoms(scenario._id);
await mongoose.disconnect();
console.log(`scenario: ${scenario.scenarioName} · ${Object.keys(customs.agent_id.workflow.nodes).length} nodes · ${customs.faces.expressions.length} clips\n`);

const s = createSession({
  flowKey: process.env.VITE_VOXIO_TEST_FLOW_KEY,
  environment: "gpu",
  media: { audio: true, video: false },
  customs,
  resume: false,
  env: {
    RTCPeerConnection,
    getUserMedia: async () => new MediaStream([new MediaStreamTrack({ kind: "audio" })]), // silent mic
  },
});

const short = (v) => (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 300);
const replies = [];
let replyWaiter = null;
s.on("state", (st) => console.log(`[state] ${short(st)}`));
s.on("error", (e) => console.log(`[error] ${e?.code || ""} ${e?.message || short(e)}`));
s.on("ended", (e) => console.log(`[ended] ${short(e ?? "")}`));
s.on("agent", (p) => {
  const d = p?.data ?? p;
  const keys = ["speak", "frame", "movement", "expression"].filter((k) => d?.[k] !== undefined && d[k] !== "");
  if (keys.length) console.log(`  [agent] ${keys.map((k) => `${k}=${short(d[k])}`).join(" · ")}`);
});
s.on("reply", (r) => {
  const text = typeof r === "string" ? r : r?.text ?? r?.speak ?? short(r);
  if (!text) return;
  replies.push(text);
  console.log(`PATIENT: ${text}`);
  replyWaiter?.();
});

const waitReply = (ms = 45000) => new Promise((res) => {
  const t = setTimeout(() => { replyWaiter = null; res(false); }, ms);
  replyWaiter = () => { clearTimeout(t); replyWaiter = null; setTimeout(() => res(true), 1500); };
});

let ok = false;
try {
  const greeted = waitReply();
  await s.start();
  if (!(await greeted)) throw new Error("no greeting from the patient within 45 s");
  for (const line of STUDENT) {
    console.log(`\nSTUDENT: ${line}`);
    const got = waitReply();
    s.sendText(line);
    if (!(await got)) throw new Error(`no reply to "${line}" within 45 s`);
  }
  ok = true;
} catch (e) {
  console.log(`\nFAILED: ${e?.code || ""} ${e?.message || e}`);
} finally {
  try { await s.stop(); } catch {}
  s.destroy?.();
}
console.log(ok ? `\nOK: session ran, ${replies.length} patient replies.` : "\nNOT OK");
process.exit(ok ? 0 : 1);
