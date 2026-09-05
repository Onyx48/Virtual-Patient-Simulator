/**
 * The single "currently live" scenario, served to the external simulator by
 * GET /api/scenarios/json.
 *
 * The simulator has no way to be told which scenario to run — it reads whatever
 * this slot holds. So it is deliberately ONE global value with last-write-wins
 * semantics: an educator pressing Test, or a student pressing Start, overwrites
 * whatever was there. Two people starting at once means the second one's
 * scenario is what the simulator loads, for both of them.
 *
 * Consequences worth knowing before you build on this:
 *   - In-memory. A restart reverts the endpoint to defaultScenarioJson.
 *   - Process-local. Under pm2 cluster mode the POST and the GET can land on
 *     different workers and the publish is invisible. Keep exec_mode: "fork".
 */
import { decodeScenarioText } from "../utils/richText.js";

let liveScenario = null;

export const setLiveScenario = (scenario) => {
  // Normalised once here rather than on every GET, since the simulator may poll
  // this endpoint far more often than a scenario is published.
  liveScenario = decodeScenarioText(scenario);
};

export const getLiveScenario = () => liveScenario;
