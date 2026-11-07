// Creates (or updates) a standalone Voxio test flow: history taking only, voice back and forth,
// no faces, no feedback/reflection. Touches no real scenario.
// Usage: node scripts/createTestFlow.mjs
// The flow key is written to .env as VITE_VOXIO_TEST_FLOW_KEY (flow keys are browser-safe)
// and the room at /room.html picks it up.
import "dotenv/config";
import fs from "node:fs";
import { Voxio } from "voxioagent/server";

const voxio = new Voxio({
  secretKey: process.env.VOXIO_USER_API_KEY,
  environment: process.env.VOXIO_ENVIRONMENT || "gpu",
});

const BRIEF = `You are Mr Chen Wei-Ming, a 52-year-old office manager in Taipei. You are the PATIENT at a physiotherapy clinic, talking to a physiotherapy student who is taking your history.

# YOUR CASE (only reveal what you are asked)
- Main problem: pain in the front and side of your LEFT shoulder for about 6 weeks.
- Started after repainting your living-room ceiling one weekend. No fall, no injury.
- Pain is a dull ache, 4/10 at rest, sharp 7/10 when you reach overhead or behind your back (putting on a jacket, reaching a high shelf).
- Worse at night when you lie on your left side; it wakes you 2-3 times a night.
- No pins and needles, no numbness, no neck pain, no weakness you have noticed apart from pain.
- Tried paracetamol and a heat pack; helps a little.
- Health: mild high blood pressure (amlodipine 5 mg daily). No diabetes, no heart problems, no surgery. Non-smoker, drinks tea, occasional beer.
- Right-handed. Works at a computer all day. Used to play badminton on weekends, stopped because of the shoulder.
- Worry: you are afraid it is a torn tendon and you will need an operation. You only say this if the student asks what worries you or what you expect.
- Goal: sleep through the night and get back to badminton.

# HOW YOU TALK
- Short, natural spoken answers, 1-3 sentences. You are a polite, slightly reserved man.
- Answer only what was asked. Do not volunteer the whole history.
- If asked something medical you would not know, say you don't know.
- Never give advice, never act as the clinician, never mention that you are an AI or a simulation.
- Plain text only, no lists, no stage directions, write numbers as words.`;

const llm = {
  service: process.env.VOXIO_LLM_SERVICE || "groq",
  model: process.env.VOXIO_LLM_MODEL || "openai/gpt-oss-120b",
  prompt_template: "base_llm",
};

const workflow = {
  variables: {
    user_input: { type: "str" },
    speak: { type: "str" },
    history: { type: "list", default: [] },
  },
  start_node: "greeting",
  nodes: {
    greeting: { type: "out", parameters: { out_dict: { speak: "Hi, good morning." } }, next: "input" },
    input: { type: "input", parameters: { input_variables: { user_input: "str" } }, next: ["patient", "transcription"] },
    transcription: { type: "out", parameters: { variables: ["user_input"] } },
    patient: {
      type: "llm",
      parameters: {
        ...llm,
        system_prompt: BRIEF,
        input_variables: { user_input: { type: "str", description: "What the student said." } },
        history_key: "history",
        summariser: false,
        llm_return_type: { speak: { type: "str", description: "What Mr Chen says out loud." } },
      },
      next: "response",
    },
    response: { type: "out", parameters: { variables: ["speak"] }, next: "input" },
  },
};

const settings = {
  name: "VPS test - history taking (Mr Chen)",
  workflow,
  stt: { service: "soniox", model: "stt-rt-v4", language: ["en"], "max-speakers": 1 },
  processType: process.env.VOXIO_PROCESS_TYPE || "speech-native",
};

const existing = process.env.VITE_VOXIO_TEST_FLOW_KEY;
if (existing) {
  await voxio.flows.update(existing, settings);
  console.log("Updated the existing test flow.");
} else {
  const { flowKey } = await voxio.flows.create(settings);
  fs.appendFileSync(".env", `\nVITE_VOXIO_TEST_FLOW_KEY=${flowKey}\n`);
  console.log("Created the test flow; key saved to .env as VITE_VOXIO_TEST_FLOW_KEY.");
}
