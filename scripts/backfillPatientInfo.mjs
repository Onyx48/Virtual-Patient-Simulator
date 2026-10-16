/**
 * Fills patientName / patientGender / language on scenarios created before the
 * AI routes started returning them, by asking the AI to read them back out of
 * the stored scenario prompt.
 *
 *   node scripts/backfillPatientInfo.mjs              dry run: shows what it would set
 *   node scripts/backfillPatientInfo.mjs --apply      writes it
 *   node scripts/backfillPatientInfo.mjs --apply --all    also redo scenarios that already have all three
 *   node scripts/backfillPatientInfo.mjs --apply --only <scenarioId>[,<id>...]
 *
 * The dry run still calls the AI (that is the only way to show what it would
 * write), so it spends quota too. Only the three fields are touched — the Voxio
 * flow and apiKey are left alone.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "dns";

dotenv.config();

// Same opt-in override as backend/db.js, for machines whose DNS refuses the
// mongodb+srv lookup.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
}

const { generateJsonWithFallback } = await import("../backend/utils/aiText.js");
const { patientInfoFrom } = await import("../backend/utils/patientInfo.js");
const { htmlToText } = await import("../backend/utils/bubbleScenario.js");
const Scenario = (await import("../backend/models/scenarioModel.js")).default;

const EXTRACTION_PROMPT = `You read a medical simulation scenario and report who the simulated patient is.
Return only a JSON object with exactly these keys:
{"patient_name": "", "patient_gender": "", "language": ""}
- patient_name: the patient's name exactly as written in the scenario, or "" if none is given.
- patient_gender: exactly "Male" or "Female", from pronouns, name or stated sex; "" if it truly cannot be told.
- language: the English name of the language the scenario's prose is written in, e.g. "English", "Japanese".`;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const all = args.includes("--all");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? (args[onlyIdx + 1] || "").split(",").filter(Boolean) : null;

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`connected to ${mongoose.connection.name} — ${apply ? "APPLY" : "DRY RUN"}`);

  const filter = only ? { _id: { $in: only } } : {};
  if (!all && !only) {
    filter.$or = ["patientName", "patientGender", "language"].map((f) => ({
      [f]: { $in: [null, ""] },
    }));
  }
  const scenarios = await Scenario.find(filter)
    .select("_id scenarioName status scenarioPrompt patientName patientGender language")
    .lean();

  const results = { updated: 0, skipped: 0, failed: 0 };

  for (const s of scenarios) {
    const label = `${s._id} [${s.status || "-"}] ${s.scenarioName || "(untitled)"}`;
    const prompt = htmlToText(s.scenarioPrompt);
    if (!prompt) {
      console.log(`SKIP   ${label} — no scenario prompt stored`);
      results.skipped += 1;
      continue;
    }

    try {
      const { json } = await generateJsonWithFallback({
        systemPrompt: EXTRACTION_PROMPT,
        userQuery: prompt,
      });
      const info = patientInfoFrom(json);
      const update = {
        patientName: info.patient_name,
        patientGender: info.patient_gender,
        language: info.language,
      };
      const summary = `${update.patientName || "?"} / ${update.patientGender || "?"} / ${update.language || "?"}`;

      if (!apply) {
        console.log(`WOULD  ${label} — ${summary}`);
        continue;
      }
      await Scenario.updateOne({ _id: s._id }, { $set: update });
      console.log(`DONE   ${label} — ${summary}`);
      results.updated += 1;
    } catch (err) {
      console.error(`FAIL   ${label} — ${err.message}`);
      results.failed += 1;
    }
  }

  console.log(`\n${scenarios.length} scenario(s): ${JSON.stringify(results)}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
