// The history-taking timeline rubric, and the one place a dimension is named
// (docs/HT_TIMELINE_PLAN.md, after ci/internal-shortlisting's lib/interviews/rubric.ts).
//
// Read by the scorer node (backend/utils/voxioSync.js), the room (src/voxioRoom), the
// stored roll-up (backend/utils/htTimeline.js) and the graph. Plain JS with no imports so
// the backend can import it too. One list, every reader.

/**
 * `presence` comes only from the camera report. Without vision it is not scored at all, and
 * the graph hides it rather than drawing a 0 that would read as a finding about the student.
 */
export const HT_DIMENSIONS = [
  { key: "questioning", label: "Questioning", color: "#E0A100",
    blurb: "Opening broad and then narrowing, one question at a time, no leading or double questions." },
  { key: "coverage", label: "Coverage", color: "#4A90E2",
    blurb: "Moving the history into a new area: onset, pain behaviour, aggravating and easing, 24-hour pattern, past history, red flags, work and home, goals." },
  { key: "listening", label: "Listening", color: "#E8836B",
    blurb: "Picking up a cue the patient just gave, reflecting it, following it up, summarising." },
  { key: "rapport", label: "Patient-centred", color: "#2BB5A8",
    blurb: "Acknowledging pain or worry, plain language, checking understanding, explaining what comes next." },
  { key: "presence", label: "Presence", color: "#9C8FD6", visionOnly: true,
    blurb: "Facing the camera, clearly visible, not looking away or reading for most of the turn. From the camera only." },
];

export const htKeys = (vision = false) => HT_DIMENSIONS.filter((d) => vision || !d.visionOnly).map((d) => d.key);
export const htDimensions = (vision = false) => HT_DIMENSIONS.filter((d) => vision || !d.visionOnly);

/**
 * The kink types, a closed set. Our patient never coaches, so ci's interviewer-side types
 * (suggestion, repeated) have no evidence source here; only what the student did counts.
 *   demonstrated  did it well, a real assessor would have noticed   +2 / +3
 *   partial       a genuine but imperfect attempt                    +1 / +1.5
 *   slipped       the same weakness on a second separate turn       0 / -1
 */
export const HT_KINKS = ["demonstrated", "partial", "slipped"];
export const isHtKink = (v) => typeof v === "string" && HT_KINKS.includes(v);

export const HT_KINK_LABEL = { demonstrated: "Strength", partial: "Attempted", slipped: "Slipped" };
export const HT_KINK_COLOR = { demonstrated: "#1FA971", partial: "#D98A00", slipped: "#E5484D" };

/** Flat field names the scorer returns per dimension (flat, because dict outputs misbehave in Voxio). */
export const htFields = (key) => ({ type: `${key}_type`, score: `${key}_score`, note: `${key}_note` });

/**
 * The roll-up, shared by the server (backend/utils/htTimeline.js) and the room. "No kink, no
 * movement" enforced in code: a dimension's value is read only from turns where it carried a
 * kink, so a model that drifts and sends 0 cannot wipe a score the student earned.
 */
/**
 * The step rules, enforced in code because the model does not keep them (simulated runs pushed a
 * score to 21 and wrote "-1" as a total). Walking the turns in order: a kink-less entry keeps the
 * previous value; "demonstrated"/"partial" may rise by at most 3; "slipped" may fall by at most 1
 * and never rises; everything stays in 0-10. Stored turns stay as the model sent them; every
 * reader (roll-up, graph) goes through this, so they agree.
 */
export const steadyHt = (turns) => {
  const keys = HT_DIMENSIONS.map((d) => d.key);
  const prev = {};
  const slips = {};
  return [...(turns || [])].sort((a, b) => a.turn - b.turn).map((t) => {
    if (!t.scores) return t;
    const scores = {};
    for (const k of keys) {
      const e = t.scores[k];
      if (!e) continue;
      const p = prev[k] ?? 0;
      const raw = Number.isFinite(Number(e.score)) ? Number(e.score) : p;
      let score = p;
      if (e.type_ === "slipped") {
        // The first slip holds; from the second it is a pattern and costs a point. The model
        // labels the pattern but leaves the number (simulated runs: five slips, no drop).
        slips[k] = (slips[k] || 0) + 1;
        score = slips[k] >= 2 ? Math.max(0, p - 1) : Math.max(0, p - 1, Math.min(p, raw));
      } else if (e.type_ === "partial") {
        // "Not yet good practice" cannot carry a score past the middle on its own: a run of
        // rushed double questions marked partial reached 10 in simulation.
        score = Math.max(p, Math.min(10, p + 1.5, raw, 5));
      } else if (e.type_) score = Math.min(10, p + 3, Math.max(p, raw));
      score = Math.round(score * 10) / 10;
      prev[k] = score;
      scores[k] = { ...e, score };
    }
    return { ...t, scores };
  });
};

export const rollupHt = (rawTurns) => {
  const keys = HT_DIMENSIONS.map((d) => d.key);
  const final = {};
  const turns = steadyHt(rawTurns);
  for (const t of turns || []) {
    for (const k of keys) {
      const e = t.scores?.[k];
      if (e?.type_ && typeof e.score === "number") final[k] = e.score;
    }
  }
  for (const k of keys) if (!(k in final) && (turns || []).some((t) => t.scores?.[k])) final[k] = 0;
  const failed = (turns || []).filter((t) => t.status === "failed").length;
  const state = !turns?.length ? "unscored" : failed ? "partial" : "complete";
  return { final, state };
};
