/**
 * Re-creates every scenario's Voxio flow from the current
 * backend/ai/voxioWorkflow.json (e.g. after a model change) and repoints the
 * scenario at it.
 *
 *   node scripts/rebuildVoxioFlows.mjs              dry run: lists what it would do
 *   node scripts/rebuildVoxioFlows.mjs --apply      does it
 *   node scripts/rebuildVoxioFlows.mjs --apply --only <scenarioId>[,<id>...]
 *
 * Scenarios themselves are untouched apart from `apiKey`: same _id, so
 * assignments, past sessions and dashboard history all stay linked.
 *
 * A flow's model is fixed when Voxio creates it, so editing the template does
 * nothing for existing scenarios until their flow is minted again. The flow is
 * built from what is stored on the scenario (scenarioPrompt + aiQuestions), the
 * same inputs the AI create/edit routes use.
 *
 * Voxio has no delete call in voxioClient, so the old flows are left orphaned
 * rather than removed. Their keys are written to a backup file first; restoring
 * one is just setting `apiKey` back.
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

const { buildWorkflow, createFlow } = await import("../backend/utils/voxioClient.js");
const { htmlToText, questionsToArray } = await import("../backend/utils/bubbleScenario.js");
const Scenario = (await import("../backend/models/scenarioModel.js")).default;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
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
  const results = { rebuilt: 0, skipped: 0, failed: 0 };

  for (const s of scenarios) {
    const label = `${s._id} [${s.status || "-"}] ${s.scenarioName || "(untitled)"}`;
    const prompt = htmlToText(s.scenarioPrompt);
    const questions = questionsToArray(s.aiQuestions);

    if (!prompt) {
      console.log(`SKIP   ${label} — no scenario prompt stored`);
      results.skipped += 1;
      continue;
    }

    if (!apply) {
      console.log(
        `WOULD  ${label} — prompt ${prompt.length} chars, ${questions.length} questions, ` +
          `old key ${s.apiKey ? `…${s.apiKey.slice(-4)}` : "(none)"}`,
      );
      continue;
    }

    try {
      const workflow = buildWorkflow({ scenarioPrompt: prompt, feedbackQuestions: questions });
      const newKey = await createFlow({
        flowName: s.scenarioName || "Untitled Scenario",
        workflow,
      });
      await Scenario.updateOne({ _id: s._id }, { $set: { apiKey: newKey } });
      backup.push({ _id: String(s._id), name: s.scenarioName, oldApiKey: s.apiKey || "", newApiKey: newKey });
      console.log(`DONE   ${label} — …${(s.apiKey || "----").slice(-4)} → …${newKey.slice(-4)}`);
      results.rebuilt += 1;
    } catch (err) {
      console.error(`FAIL   ${label} — ${err.message}`);
      results.failed += 1;
    }
  }

  if (apply && backup.length) {
    mkdirSync("backups", { recursive: true });
    const file = `backups/voxio-flow-keys-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\nold/new keys saved to ${file} (keep it private — these are flow credentials)`);
  }

  console.log(`\n${scenarios.length} scenario(s): ${JSON.stringify(results)}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
