/**
 * Which scenarios can actually be run in the simulator.
 *
 * Authoring is open — anyone with manageScenarios can write as many cases as they
 * like — but only the scenarios listed here can be opened in the simulator, by
 * either an educator's Test button or a student's Start. Everything else is
 * authorable and reviewable and simply not runnable.
 *
 * The reason is that the simulator is a single published StreamPixel build with
 * one live-scenario slot (see state/liveScenario.js): whoever presses Test last
 * wins, so an unrestricted button meant one person's run silently swapped another
 * person's patient. Restricting it to one known-good case keeps the runs
 * predictable while that handoff is still single-slot.
 *
 * TESTABLE_SCENARIO_IDS is a comma-separated list, so widening this is an env
 * change and a restart rather than a deploy. Setting it to `*` allows everything
 * again, which is how this gate gets removed once the handoff is per-session.
 */
const DEFAULT_TESTABLE_IDS = ["6a9c857f8df9099b1edea1cd"];

const configured = () => {
  const raw = process.env.TESTABLE_SCENARIO_IDS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_TESTABLE_IDS;
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
};

/** True when every scenario is runnable — `TESTABLE_SCENARIO_IDS=*`. */
export const allScenariosTestable = () => configured().includes("*");

/**
 * Whether this scenario may be opened in the simulator.
 *
 * Takes anything id-shaped (ObjectId or string) because callers hold a mixture of
 * both; comparison is on the string form for the same reason.
 */
export const isScenarioTestable = (scenarioId) => {
  if (allScenariosTestable()) return true;
  return configured().includes(String(scenarioId));
};

/**
 * Why a blocked run was blocked, for a person to read.
 *
 * Deliberately says the scenario is not enabled rather than implying the user
 * lacks permission — nobody has permission to run it, and "you can't" sends people
 * to an admin who cannot help them.
 */
export const NOT_TESTABLE_MESSAGE =
  "This scenario is not enabled for the simulator yet. Only the enabled demo scenario can be run.";
