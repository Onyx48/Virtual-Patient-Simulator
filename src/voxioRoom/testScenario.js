// Test scenario: Mr Chen, left shoulder. Builds the Voxio session customs inline.
// The AI only picks a movement label (e.g. "shoulder_flexion_left"); WE decide the version
// (full / ltd / 90 / 120) per movement here and attach that clip's uuid under the plain label.
import FACES from "../../docs/avatar/faces.json";
import { SCENARIO, MOVE_WORDS, BRIEF, RETURN_TYPE } from "./patientPrompt.js";

export { SCENARIO };

const MODEL = { service: "openrouter", model: "google/gemini-3.1-flash-lite-preview", prompt_template: "base_llm" };

function faceFor(label, version) {
  const f = FACES[`${label}_${version}`];
  if (!f) { console.warn(`[room] no clip for ${label}_${version}; movement left out`); return null; }
  return { uuid: f.uuid, label, usage: MOVE_WORDS[label] };
}

export function buildFaces() {
  const expressions = [{ uuid: FACES.main.uuid, label: "main", usage: "idle, standing at rest" }];
  for (const [label, version] of Object.entries(SCENARIO.movements)) {
    const f = faceFor(label, version);
    if (f) expressions.push(f);
  }
  return { expressions, transitions: [] };
}

export function buildCustoms() {
  // every variable the nodes read or write must be declared (the server 422s otherwise)
  const variables = {
    user_input: { type: "str" },
    speak: { type: "str" },
    frame: { type: "str", default: "main" },
    conversation_history: { type: "list", default: [] },
  };
  return {
    "process-type": "stt-native",
    variables,
    faces: buildFaces(),
    // stt/tts come from the root flow (set in the Voxio dashboard), not customs
    agent_id: {
      workflow: {
        variables,
        start_node: "greeting",
        nodes: {
          greeting: {
            type: "out",
            parameters: { out_dict: { speak: "Hi, good morning.", frame: "main" }, interruption_type: "no", interruption_metadata: {} },
            next: "ask_for_input",
          },
          ask_for_input: { type: "input", parameters: { input_variables: { user_input: "str" } }, next: "transcription" },
          transcription: {
            type: "out",
            parameters: { variables: ["user_input"], interruption_type: "no", interruption_metadata: {} },
            next: "patient",
          },
          patient: {
            type: "llm",
            parameters: {
              ...MODEL,
              system_prompt: BRIEF,
              input_variables: { user_input: { type: "str", description: "What the student just said." } },
              history_key: "conversation_history",
              emotion: false,
              llm_return_type: RETURN_TYPE,
            },
            next: "response",
          },
          response: {
            type: "out",
            parameters: { variables: ["speak", "frame"], interruption_type: "no", interruption_metadata: {} },
            next: "reset_frame",
          },
          // after every patient reply: send the rest frame so the avatar settles back to idle
          reset_frame: {
            type: "out",
            parameters: { out_dict: { frame: "main" }, interruption_type: "no", interruption_metadata: {} },
            next: "ask_for_input",
          },
        },
      },
    },
  };
}
