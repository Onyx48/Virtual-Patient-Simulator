/**
 * Pushes the current backend/ai/voxioWorkflow.json (prompt, model, summariser
 * settings, ...) into every scenario's Voxio flow.
 *
 *   node scripts/rebuildVoxioFlows.mjs              dry run: lists what it would do
 *   node scripts/rebuildVoxioFlows.mjs --apply      does it
 *   node scripts/rebuildVoxioFlows.mjs --apply --only <scenarioId>[,<id>...]
 *
 * Flows are updated IN PLACE under their existing apiKey (the same /edit-flow
 * call the AI edit route uses), so keys never change: the simulator, the live
 * scenario behind /api/scenarios/json and anything else holding a key keep
 * working with no reload, and no orphaned flows pile up in Voxio. Voxio copies
 * the workflow into a session when it starts, so every session started after
 * the run uses the new workflow; one already running finishes on the old one.
 *
 * A scenario with no apiKey gets a new flow created and the key saved on it.
 * If an existing key no longer resolves in Voxio the scenario is reported as
 * FAIL and left alone; rerun with --recreate-missing to mint a new flow for it
 * instead (its old key is written to the backup file first).
 *
 * The flow is built from what is stored on the scenario (scenarioPrompt +
 * aiQuestions), the same inputs the AI create/edit routes use.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "dns";
import { writeFileSync, mkdirSync } from "fs";

dotenv.config();

// Same opt-in override as backend/db.js, for machines whose DNS refuses the
// mongodb+srv lookup.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
}

const { buildWorkflow, createFlow, updateFlow } = await import("../backend/utils/voxioClient.js");
const { htmlToText, questionsToArray } = await import("../backend/utils/bubbleScenario.js");
const Scenario = (await import("../backend/models/scenarioModel.js")).default;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const recreateMissing = args.includes("--recreate-missing");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? (args[onlyIdx + 1] || "").split(",").filter(Boolean) : null;

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`connected to ${mongoose.connection.name} — ${apply ? "APPLY" : "DRY RUN"}`);

  const filter = only ? { _id: { $in: only } } : {};
  const scenarios = await Scenario.find(filter)
    .select("_id scenarioName status scenarioPrompt aiQuestions apiKey")
    .lean();

  const backup = [];
  const results = { updated: 0, created: 0, skipped: 0, failed: 0 };

  for (const s of scenarios) {
    const label = `${s._id} [${s.status || "-"}] ${s.scenarioName || "(untitled)"}`;
    const prompt = htmlToText(s.scenarioPrompt);
    const questions = questionsToArray(s.aiQuestions);

    if (!prompt) {
      console.log(`SKIP   ${label} — no scenario prompt stored`);
      results.skipped += 1;
      continue;
    }

    const key = s.apiKey ? `…${s.apiKey.slice(-4)}` : "(none)";

    if (!apply) {
      console.log(
        `WOULD  ${label} — ${s.apiKey ? `update in place, key ${key}` : "create a flow (no key yet)"}, ` +
          `prompt ${prompt.length} chars, ${questions.length} questions`,
      );
      continue;
    }

    const workflow = buildWorkflow({ scenarioPrompt: prompt, feedbackQuestions: questions });
    const flowName = s.scenarioName || "Untitled Scenario";

    const create = async (why) => {
      const newKey = await createFlow({ flowName, workflow });
      await Scenario.updateOne({ _id: s._id }, { $set: { apiKey: newKey } });
      backup.push({ _id: String(s._id), name: s.scenarioName, oldApiKey: s.apiKey || "", newApiKey: newKey });
      console.log(`NEW    ${label} — ${why}, new key …${newKey.slice(-4)}`);
      results.created += 1;
    };

    try {
      if (!s.apiKey) {
        await create("had no flow");
        continue;
      }
      try {
        await updateFlow({ apiKey: s.apiKey, flowName, workflow });
        console.log(`DONE   ${label} — updated in place, key ${key} unchanged`);
        results.updated += 1;
      } catch (err) {
        if (!recreateMissing) throw err;
        await create(`key ${key} failed (${err.message})`);
      }
    } catch (err) {
      console.error(`FAIL   ${label} — key ${key}: ${err.message}`);
      results.failed += 1;
    }
  }

  if (apply && backup.length) {
    mkdirSync("backups", { recursive: true });
    const file = `backups/voxio-flow-keys-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\nkeys of newly created flows saved to ${file} (keep it private — these are flow credentials)`);
  }

  console.log(`\n${scenarios.length} scenario(s): ${JSON.stringify(results)}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
