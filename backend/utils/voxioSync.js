/**
 * Keeps each scenario's Voxio flow in step with the scenario.
 *
 * Called after every scenario create or update. A scenario with no Voxio key
 * yet (none, or one of the sim_ keys our own engine minted) gets a new flow and
 * its key saved as Scenario.apiKey; one that has a key gets its flow updated
 * in place, so the key the game holds never changes. The outcome is recorded
 * on Scenario.voxioSync for the dashboard.
 *
 * Runs in the background: saving a scenario never waits on Voxio, and a Voxio
 * outage leaves the scenario saved with voxioSync.status "failed", to be
 * retried by the next save or scripts/syncVoxioFlows.mjs.
 */
import Scenario from "../models/scenarioModel.js";
import { forgetScenario, scenarioFor } from "./simEngine.js";
import { buildFlow } from "./voxioFlow.js";
import { createFlow, getFlow, isFlowKey, isVoxioConfigured, updateFlow } from "./voxioClient.js";

const running = new Map(); // scenarioId -> promise, so two saves do not race

const record = (scenarioId, voxioSync, extra = {}) =>
  Scenario.updateOne({ _id: scenarioId }, { $set: { voxioSync: { ...voxioSync, at: new Date() }, ...extra } });

/** Create or update the scenario's flow. Resolves to the flow key. */
export const syncScenarioFlow = async (scenarioId, { recreateMissing = true } = {}) => {
  const id = String(scenarioId);
  forgetScenario(id);
  const ctx = await scenarioFor(id);
  const flow = buildFlow(ctx);
  const key = ctx.scenario.apiKey ?? (await Scenario.findById(id).select("apiKey").lean())?.apiKey;

  if (isFlowKey(key)) {
    const exists = await getFlow(key, ["flow_name"]);
    if (exists) {
      await updateFlow(key, flow);
      await record(id, { status: "synced" });
      return key;
    }
    if (!recreateMissing) throw new Error("This scenario's Voxio flow no longer exists.");
    console.warn(`[VOXIO] flow for scenario ${id} is gone; creating a new one`);
  }

  const newKey = await createFlow(flow);
  await record(id, { status: "synced" }, { apiKey: newKey });
  return newKey;
};

/** Fire-and-forget sync after a save. Never throws. */
export const syncInBackground = (scenarioId) => {
  if (!isVoxioConfigured()) return;
  const id = String(scenarioId);
  const previous = running.get(id) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      await record(id, { status: "pending" });
      const key = await syncScenarioFlow(id);
      console.log(`[VOXIO] scenario ${id} synced to flow ${key.slice(0, 6)}…`);
    })
    .catch(async (err) => {
      console.error(`[VOXIO] sync failed for scenario ${id}: ${err.message}`);
      await record(id, { status: "failed", error: String(err.message).slice(0, 300) }).catch(() => {});
    })
    .finally(() => {
      if (running.get(id) === next) running.delete(id);
    });
  running.set(id, next);
  return next;
};

/**
 * The scenario's flow key, creating the flow first if it has none (a scenario
 * saved before this branch, or whose background sync failed). Used right
 * before a run starts, when the game needs a working key.
 */
export const ensureFlow = async (scenario) => {
  if (isFlowKey(scenario.apiKey) && scenario.voxioSync?.status === "synced") return scenario.apiKey;
  if (!isVoxioConfigured()) return scenario.apiKey;
  try {
    return await syncScenarioFlow(scenario._id);
  } catch (err) {
    console.error(`[VOXIO] could not prepare a flow for scenario ${scenario._id}: ${err.message}`);
    return scenario.apiKey;
  }
};

/*
 * The Test room. It always starts sessions on one fixed gpu flow (VITE_VOXIO_TEST_FLOW_KEY)
 * and sends this scenario's workflow and clips as session customs, so no per-scenario
 * flow has to be created in the gpu environment.
 */
export const roomCustoms = async (scenarioId) => {
  const id = String(scenarioId);
  forgetScenario(id);
  const flow = buildFlow(await scenarioFor(id));
  const variables = flow.workflow.variables;
  // Customs are stricter than a saved flow: a node not in the fixed flow must say `next`
  // ([] when it ends the turn, or when a conditional's mappings do the routing).
  // The room shows the feedback live, so send the feedback node's result to the browser.
  // Room only: the saved flow gets its feedback through the webhook and stays unchanged.
  const { nodes } = flow.workflow;
  if (nodes.feedback && !nodes.feedback.next) {
    nodes.feedback.next = "feedback_out";
    nodes.feedback_out = { type: "out", parameters: { variables: ["feedback", "score", "questions"] }, next: [] };
  }
  // The reflection's result is only saved to state; send it to the browser too, so the room
  // knows that turn has finished before it starts Clinical Reasoning (a line sent while a turn
  // is still running cuts it short and Voxio drops what it was writing).
  if (nodes.reflection_result) {
    nodes.reflection_out = { type: "out", parameters: { variables: ["self_rating", "summary", "status", "reflection_done"] }, next: nodes.reflection_result.next };
    nodes.reflection_result.next = "reflection_out";
  }
  // Likewise every node's parameters must list input_variables ({} for none).
  for (const node of Object.values(flow.workflow.nodes)) {
    node.next ??= [];
    node.parameters = { ...node.parameters, input_variables: node.parameters?.input_variables ?? {} };
  }
  return {
    "process-type": "stt-native",
    variables,
    faces: { expressions: flow.faces || [], transitions: flow.transitions || [] },
    agent_id: { workflow: flow.workflow },
  };
};
