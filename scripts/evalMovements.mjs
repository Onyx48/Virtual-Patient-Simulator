// How reliably does the patient LLM pick the right movement label?
// Sends Mr Chen's real prompt (src/voxioRoom/patientPrompt.js) to the room's model via OpenRouter,
// once per test phrase x RUNS, and reports accuracy per group and every miss.
// This approximates the Voxio llm node (same system prompt + return schema, JSON reply);
// Voxio's own template wraps it slightly differently.
//
// Usage: node scripts/evalMovements.mjs [--runs 3] [--model google/gemini-3.1-flash-lite-preview] [--only clinical]
import "dotenv/config";
import { BRIEF, RETURN_TYPE, LABELS } from "../src/voxioRoom/patientPrompt.js";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const RUNS = Number(arg("runs", 3));
const MODEL = arg("model", "google/gemini-3.1-flash-lite-preview");
const ONLY = arg("only", null);

const F = "shoulder_flexion_left", AB = "shoulder_abduction_left", ER = "shoulder_external_rotation_left",
  IR = "shoulder_internal_rotation_left", HBB = "shoulder_hand_behind_back_left", HBN = "shoulder_hand_behind_neck_left",
  EXT = "shoulder_extension_left", HADD = "shoulder_horizontal_adduction_left", M = "main";

// [group, what the student says, acceptable labels]
const CASES = [
  // how students actually ask: clinical terms
  ["clinical", "Can you flex your left shoulder for me?", [F]],
  ["clinical", "Show me shoulder flexion on the left.", [F]],
  ["clinical", "Can you abduct your left arm?", [AB]],
  ["clinical", "Left shoulder abduction please.", [AB]],
  ["clinical", "Can you externally rotate your left shoulder with your elbow at your side?", [ER]],
  ["clinical", "Now internal rotation of the left shoulder please.", [IR]],
  ["clinical", "Can you extend your left shoulder?", [EXT]],
  ["clinical", "Horizontal adduction on the left please.", [HADD]],
  ["clinical", "Can you do functional internal rotation, hand behind back?", [HBB]],
  ["clinical", "Can you do hand behind neck for me?", [HBN]],
  ["clinical", "Let's check your active range of motion. Start with flexion.", [F]],
  ["clinical", "Next, abduction in the scapular plane is fine, just abduct.", [AB]],
  // clinician shorthand
  ["shorthand", "Can you show me ER on the left?", [ER]],
  ["shorthand", "Now IR please.", [IR]],
  ["shorthand", "Do HBB for me.", [HBB]],
  ["shorthand", "Can you do HBN?", [HBN]],
  ["shorthand", "Let me see your AROM, flex first.", [F]],
  ["shorthand", "Abd please, as far as you can.", [AB]],
  // layman (ROM table phrasings)
  ["layman", "Can you lift your arm forward and up as high as you can?", [F]],
  ["layman", "Can you raise your arm out to the side?", [AB]],
  ["layman", "Keep your elbow by your side and turn your hand outwards.", [ER]],
  ["layman", "Can you put your hand on your tummy?", [IR]],
  ["layman", "Reach up your back as high as you can.", [HBB]],
  ["layman", "Put your hand behind your head.", [HBN]],
  ["layman", "Bring your arm back, keeping the elbow straight.", [EXT]],
  ["layman", "Lift your arm and reach across to the other shoulder.", [HADD]],
  // ambiguous: flexion or abduction are both clinically reasonable
  ["ambiguous", "Can you lift your arm up for me?", [F, AB, M]],
  ["ambiguous", "Show me how high you can raise your arm.", [F, AB, M]],
  // must NOT move: history questions that mention a movement
  ["no-move", "Does it hurt when you lift your arm?", [M]],
  ["no-move", "Do you have pain reaching behind your back, like putting on a jacket?", [M]],
  ["no-move", "Is turning your arm outwards painful?", [M]],
  ["no-move", "When did the pain start?", [M]],
  ["no-move", "How does the shoulder affect your sleep?", [M]],
  ["no-move", "Have you tried any treatment, like massage or medication?", [M]],
  // must NOT move: movements we have no clip for
  ["no-clip", "Can you lift your RIGHT arm forward?", [M]],
  ["no-clip", "Turn your head to the left please.", [M]],
  ["no-clip", "Can you bend your left elbow?", [M]],
  ["no-clip", "Shrug your shoulders for me.", [M]],
];

const SYSTEM = `${BRIEF}

Reply with ONLY a JSON object with these keys:
${Object.entries(RETURN_TYPE).map(([k, v]) => `- "${k}" (${v.type}): ${v.description}`).join("\n")}`;

const HISTORY = [
  { role: "assistant", content: JSON.stringify({ speak: "Hi, good morning.", frame: "main" }) },
  { role: "user", content: "Good morning Mr Chen, I'm a physiotherapy student. I'll ask some questions and then look at your shoulder movements, is that okay?" },
  { role: "assistant", content: JSON.stringify({ speak: "Yes, that's fine.", frame: "main" }) },
];

async function ask(text) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM }, ...HISTORY, { role: "user", content: text }],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const raw = (await r.json()).choices?.[0]?.message?.content || "";
  try { return JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()); } catch { return { frame: `<unparsable: ${raw.slice(0, 60)}>` }; }
}

const cases = CASES.filter(([g]) => !ONLY || g === ONLY);
const jobs = cases.flatMap((c) => Array.from({ length: RUNS }, () => c));
const results = [];
const POOL = 6;
let next = 0;
await Promise.all(Array.from({ length: POOL }, async () => {
  while (next < jobs.length) {
    const [group, text, ok] = jobs[next++];
    try {
      const out = await ask(text);
      results.push({ group, text, ok, got: out.frame, speak: out.speak, pass: ok.includes(out.frame), valid: LABELS.includes(out.frame) });
    } catch (e) { results.push({ group, text, ok, got: `ERROR ${e.message}`, pass: false, valid: false }); }
  }
}));

console.log(`model ${MODEL} · ${RUNS} runs per phrase · ${jobs.length} calls\n`);
const groups = [...new Set(cases.map(([g]) => g))];
for (const g of groups) {
  const rs = results.filter((r) => r.group === g);
  console.log(`${g.padEnd(10)} ${String(rs.filter((r) => r.pass).length).padStart(3)}/${rs.length}`);
}
const all = results.filter((r) => r.pass).length;
console.log(`${"TOTAL".padEnd(10)} ${String(all).padStart(3)}/${results.length}  (${Math.round((100 * all) / results.length)}%)`);
console.log(`invalid labels: ${results.filter((r) => !r.valid).length}\n`);

// consistency: phrases whose runs disagreed with each other
for (const [g, text] of cases) {
  const rs = results.filter((r) => r.text === text);
  const got = rs.map((r) => r.got);
  if (rs.some((r) => !r.pass) || new Set(got).size > 1)
    console.log(`MISS [${g}] "${text}"\n   want ${rs[0].ok.join("|")}  got ${got.join(", ")}\n   said: ${rs.find((r) => !r.pass)?.speak || rs[0].speak}`);
}
