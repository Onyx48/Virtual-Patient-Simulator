// Generates one Singapore case from a short brief, exactly as the form does (costs one AI call).
// Usage: node scripts/generateSgCase.mjs "50s hawker, shoulder" out.json
import "dotenv/config";
import { writeFileSync } from "fs";
const root = "../backend/utils/";
const { generateJsonWithFallback } = await import(root + "aiText.js");
const { sgGeneratorPrompt, sgCaseToGenerated } = await import(root + "sgScenario.js");
const query = process.argv[2];
const t = Date.now();
const { json, provider, model } = await generateJsonWithFallback({ systemPrompt: sgGeneratorPrompt(), userQuery: query });
const out = sgCaseToGenerated(json);
writeFileSync(process.argv[3], JSON.stringify({ raw: json, form: out }, null, 2));
console.log(`${provider} ${model} ${((Date.now() - t) / 1000).toFixed(1)}s`);
console.log("name:", out.scenario_name, "|", out.patient_name, out.patient_gender, out.difficulty_level);
console.log("questions:", out.questions_for_feedback.length, "objectives:", out.learning_objectives.length);
const lim = Object.entries(out.movements).flatMap(([r, m]) => Object.entries(m || {}).filter(([, v]) => v !== "Full").map(([k, v]) => `${r}.${k}=${v}`));
console.log("limited movements:", lim.join(", ") || "none");
console.log("\n" + out.scenario_prompt);
console.log("\nCASE-SPECIFIC:\n" + out.questions_for_feedback.slice(24).join("\n"));
