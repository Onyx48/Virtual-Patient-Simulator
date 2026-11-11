/**
 * Sets languageCode ("en", "ja", "hi", ...) on scenarios saved before the field
 * existed, from the language name they already store. No AI calls.
 *
 *   node scripts/backfillLanguageCode.mjs           dry run
 *   node scripts/backfillLanguageCode.mjs --apply   writes it
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "dns";

dotenv.config();
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
}

const { languageCodeFor } = await import("../backend/utils/languageCode.js");
const Scenario = (await import("../backend/models/scenarioModel.js")).default;

const apply = process.argv.includes("--apply");
await mongoose.connect(process.env.MONGODB_URI);

const scenarios = await Scenario.find({}).select("_id scenarioName language languageCode").lean();
let changed = 0;
for (const s of scenarios) {
  const code = languageCodeFor(s.language);
  if (code === (s.languageCode || "")) continue;
  const label = `${s._id} "${s.scenarioName}" — ${s.language || "(no language)"} → ${code || "(none)"}`;
  if (apply) await Scenario.updateOne({ _id: s._id }, { $set: { languageCode: code } });
  console.log(`${apply ? "DONE " : "WOULD"}  ${label}`);
  changed += 1;
}
console.log(`\n${scenarios.length} scenario(s), ${changed} ${apply ? "updated" : "to update"}.`);
await mongoose.disconnect();
