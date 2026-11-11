// Storing and rolling up the history-taking timeline (docs/HT_TIMELINE_PLAN.md §5).
// A port of ci/internal-shortlisting's finaliseScores (lib/interviews/session.ts).
import { HT_DIMENSIONS, isHtKink, rollupHt } from "../../src/lib/htRubric.js";

const KEYS = HT_DIMENSIONS.map((d) => d.key);
// What was said on the turn, stored with its scores as ci stores transcript + speak on each row.
const said = (t) => ({ transcript: String(t?.transcript || "").slice(0, 2000), speak: String(t?.speak || "").slice(0, 2000) });
const clamp = (n) => Math.max(0, Math.min(10, Math.round(n * 10) / 10));

/**
 * The room's per-turn packets, cleaned. An unknown kink type is cleared rather than kept,
 * which downgrades that entry to "no kink" instead of losing the turn. A turn with no
 * scorer output is `failed`, never a row of zeroes.
 */
export const cleanHtTurns = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((t, i) => {
    const turn = Number.isFinite(Number(t?.turn)) ? Number(t.turn) : i + 1;
    const at = Number.isFinite(Number(t?.at)) ? Math.max(0, Number(t.at)) : null;
    if (t?.status === "failed" || !t?.scores || typeof t.scores !== "object") return { turn, at, status: "failed", scores: null, ...said(t) };
    const scores = {};
    let kinks = 0;
    for (const k of KEYS) {
      const e = t.scores[k];
      if (!e || typeof e !== "object") continue;
      const type_ = isHtKink(e.type_) ? e.type_ : "";
      const score = Number.isFinite(Number(e.score)) ? clamp(Number(e.score)) : 0;
      if (type_) kinks += 1;
      scores[k] = { type_, score, description: type_ ? String(e.description || "").slice(0, 300) : "" };
    }
    return { turn, at, status: kinks ? "scored" : "empty", scores, ...said(t) };
  });
};

/** The roll-up lives in the shared rubric so the room and the server compute it the same way. */
export const finaliseHt = (turns) => rollupHt(turns);

/**
 * Stored turns plus incoming ones, by turn number. A real score always beats "failed" (the room
 * may have marked a turn failed before a late packet came in), otherwise the newer entry wins.
 */
export const mergeHtTurns = (stored, incoming) => {
  const by = new Map((stored || []).map((t) => [t.turn, t]));
  for (const t of incoming) {
    const old = by.get(t.turn);
    if (old && old.status !== "failed" && t.status === "failed") continue;
    by.set(t.turn, t);
  }
  return [...by.values()].sort((a, b) => a.turn - b.turn);
};
