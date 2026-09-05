// Throwaway probe: exercises the Voxio authoring leg against the real
// database.voxio.in. Delete after running.
import "dotenv/config";
import {
  buildWorkflow,
  createFlow,
  updateFlow,
} from "./backend/utils/voxioClient.js";

const wf = buildWorkflow({
  scenarioPrompt:
    "You are Robert Davis, 52, with right shoulder pain for 3 weeks. Answer as the patient.",
  feedbackQuestions: [
    "Did the student greet the patient?",
    "Did the student ask about onset?",
  ],
});

console.log(
  "workflow built: system_prompt len",
  wf.nodes.llm.parameters.system_prompt.length,
  "| feedback_questions:",
  JSON.stringify(wf.variables.feedback_questions.value),
);

const t0 = Date.now();
let key;
try {
  key = await createFlow({
    flowName: "vps-live-probe-" + Date.now(),
    workflow: wf,
  });
  console.log(
    "CREATE ok in",
    Date.now() - t0,
    "ms | api_key len",
    key.length,
    "| prefix",
    key.slice(0, 6),
  );
} catch (e) {
  console.log("CREATE FAILED:", e.message);
  process.exit(1);
}

const wf2 = buildWorkflow({
  scenarioPrompt: "You are Robert Davis, 52, with LEFT shoulder pain for 6 weeks.",
  feedbackQuestions: ["Did the student greet the patient?"],
});

const t1 = Date.now();
try {
  await updateFlow({
    apiKey: key,
    flowName: "vps-live-probe-edited",
    workflow: wf2,
  });
  console.log("EDIT ok in", Date.now() - t1, "ms (same key reused)");
} catch (e) {
  console.log("EDIT FAILED:", e.message);
}

try {
  await updateFlow({
    apiKey: "bogus-key-should-not-resolve",
    flowName: "x",
    workflow: wf2,
  });
  console.log("STALE-KEY GUARD: FAIL (accepted a bogus key)");
} catch (e) {
  console.log("STALE-KEY GUARD ok:", e.message.slice(0, 140));
}
