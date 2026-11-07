// Checks that Voxio accepts a scenario's Test-room customs, without starting a session:
// posts them to the voice server's offer endpoint with a dummy SDP, so a 422 means the
// customs are wrong and any other answer means they passed validation.
// Usage: node scripts/checkRoomCustoms.mjs "<part of scenario name>"
import "../backend/loadEnv.js";
import dns from "dns";
import mongoose from "mongoose";
import Scenario from "../backend/models/scenarioModel.js";
import { roomCustoms } from "../backend/utils/voxioSync.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]); // same as backend/db.js
await mongoose.connect(process.env.MONGODB_URI);

const name = process.argv[2] || "";
const scenario = await Scenario.findOne({ scenarioName: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
  .sort({ updatedAt: -1 }).select("_id scenarioName").lean();
if (!scenario) throw new Error(`no scenario matching "${name}"`);

const customs = await roomCustoms(scenario._id);
const key = process.env.VITE_VOXIO_TEST_FLOW_KEY;
const r = await fetch("https://gpu.voice.voxio.in/rtc/offer/audio", {
  method: "POST",
  headers: { "Content-Type": "application/json", flow_api_key: key, api_key: key },
  body: JSON.stringify({ sdp: "v=0\r\n", type: "offer", customs }),
});
const body = await r.text();
console.log(`scenario: ${scenario.scenarioName}`);
console.log(`nodes: ${Object.keys(customs.agent_id.workflow.nodes).length}, faces: ${customs.faces.expressions.length}`);
console.log(`voxio: ${r.status} ${body.slice(0, 600)}`);
await mongoose.disconnect();
process.exit(0);
