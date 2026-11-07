#!/usr/bin/env node
/**
 * Brings every scenario's Voxio flow in line with the scenario, the same way
 * saving a scenario does (utils/voxioSync.js). For scenarios saved before the
 * Voxio branch, or whose background sync failed.
 *
 *   node scripts/syncVoxioFlows.mjs                 dry run: lists what it would do
 *   node scripts/syncVoxioFlows.mjs --apply         does it
 *   node scripts/syncVoxioFlows.mjs --apply --only <scenarioId>[,<id>...]
 *
 * A scenario with a Voxio key keeps it (the flow is updated in place); one with
 * no key, or one of our sim_ keys, gets a new flow and its key saved.
 */
import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";

if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;

const Scenario = (await import("../backend/models/scenarioModel.js")).default;
const { syncScenarioFlow } = await import("../backend/utils/voxioSync.js");
const { isFlowKey } = await import("../backend/utils/voxioClient.js");

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const scenarios = await Scenario.find(only ? { _id: { $in: only } } : {})
  .select("scenarioName apiKey profession language voxioSync")
  .lean();

let ok = 0;
let failed = 0;
for (const s of scenarios) {
  const action = isFlowKey(s.apiKey) ? "update" : "create";
  const label = `${String(s._id)}  ${action.padEnd(6)} ${(s.profession || "physiotherapy").padEnd(20)} ${s.scenarioName}`;
  if (!apply) {
    console.log(`would ${label}`);
    continue;
  }
  try {
    await syncScenarioFlow(s._id);
    ok++;
    console.log(`ok    ${label}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${label}: ${err.message}`);
  }
}
console.log(apply ? `\n${ok} synced, ${failed} failed.` : `\n${scenarios.length} scenario(s). Rerun with --apply to sync.`);
await mongoose.disconnect();
process.exit(failed ? 1 : 0);
