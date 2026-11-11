/**
 * Live check that the patient returns one valid movement `action` per turn.
 * Runs each case in a fresh throwaway session (deleted afterwards).
 *   node scripts/testPatientActions.mjs
 */
import dotenv from "dotenv";
import dns from "dns";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
dotenv.config();
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));

const { startSession, patientTurn } = await import("../backend/utils/simEngine.js");
const Scenario = (await import("../backend/models/scenarioModel.js")).default;
const SimConversation = (await import("../backend/models/simConversationModel.js")).default;
await mongoose.connect(process.env.MONGODB_URI);

const CASES = [
  { scenario: /neck pain in an office/, turns: [
    ["What brings you in today?", null],
    ["Can you bend your head forward, chin to your chest?", "neck-flexion"],
    ["Now turn your head to the left as far as you can.", "left-neck-rotation"],
    ["Tilt your right ear down towards your right shoulder.", "right-neck-lateral-flexion"],
    ["Does it hurt when you look up?", null],
    ["Look up at the ceiling, then turn right.", "neck-extension"],
  ]},
  { scenario: /ankle sprain/, turns: [
    ["Point your toes down for me.", /-ankle-plantarflexion$/],
    ["Now pull your left foot up towards you.", "left-ankle-dorsiflexion"],
    ["Can you bend your elbow?", null],
  ]},
  { scenario: /健一/, turns: [
    ["前かがみになって、つま先に手を伸ばしてください。", "lower-back-flexion"],
    ["痛みはいつからですか？", null],
    ["体を右にひねってください。", "right-lower-back-rotation"],
  ]},
];

const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Free-tier Gemini allows only a few requests a minute: pace turns, retry 429s.
const turn = async (sid, input) => {
  for (let i = 0; ; i++) {
    try { return await patientTurn(sid, input); }
    catch (e) { if (e.status !== 429 || i >= 4) throw e; await wait(20000); }
  }
};
let pass = 0, total = 0;
for (const c of CASES) {
  if (only && !only.test(String(c.scenario))) continue;
  const s = await Scenario.findOne({ scenarioName: c.scenario }).select("+apiKey scenarioName apiKey").lean();
  if (!s?.apiKey) { console.log(`SKIP  ${c.scenario} (no scenario/api key)`); continue; }
  const sid = `test-${randomUUID()}`;
  await startSession(sid, s.apiKey);
  console.log(`\n=== ${s.scenarioName}`);
  try {
    for (const [input, want] of c.turns) {
      await wait(4000);
      const r = await turn(sid, input);
      const ok = want instanceof RegExp ? want.test(r.action ?? "") : r.action === want;
      total++; if (ok) pass++;
      console.log(`${ok ? "PASS" : "FAIL"}  "${input}"\n      action=${r.action}  (want ${want})\n      speak: ${r.speak.slice(0, 140)}`);
    }
  } finally {
    await SimConversation.deleteOne({ session_id: sid });
  }
}
console.log(`\n${pass}/${total} passed`);
await mongoose.disconnect();
