// Plays a scripted student against a generated Singapore case (standard + case), with the room's model.
// Costs one AI call per student line.
// Usage: node scripts/chatSgPatient.mjs case.json
import "dotenv/config";
import { readFileSync } from "fs";
import { renderSgCase, withSgStandard } from "../backend/utils/sgScenario.js";

const MODEL = process.env.SG_CHAT_MODEL || "google/gemini-3.1-flash-lite-preview";
const { raw } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const system = withSgStandard(renderSgCase(raw)) +
  '\n\n# OUTPUT\nReply with ONLY a JSON object: {"speak": "what you say out loud"}';

const STUDENT = [
  "Good morning.",
  "Hi, I'm Daniel, a student physiotherapist. Can I confirm your name please?",
  "Thank you. So what brings you in today?",
  "I see. When did this start?",
  "What are the aggravating factors and does it radiate?",
  "Sorry, I mean, what makes the pain worse? And does it travel down your arm?",
  "Does the pain wake you up at night?",
  "Do you have any problems passing urine or opening your bowels?",
  "Have you tried any treatment for it so far?",
  "Anything else you tried, maybe traditional massage or medicated oil?",
  "What do you think is causing it?",
  "Is there anything you are worried about?",
];

const messages = [{ role: "system", content: system }];
console.log(`patient: ${raw.patient?.full_name} · register ${raw.patient?.speech_register} · ${MODEL}\n`);
for (const line of STUDENT) {
  messages.push({ role: "user", content: line });
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" } }),
  });
  const text = (await r.json()).choices?.[0]?.message?.content || "";
  let speak;
  try { speak = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()).speak; } catch { speak = `<raw> ${text}`; }
  messages.push({ role: "assistant", content: JSON.stringify({ speak }) });
  console.log(`STUDENT: ${line}\nPATIENT: ${speak}\n`);
}
