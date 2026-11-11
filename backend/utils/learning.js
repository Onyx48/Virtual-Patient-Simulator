/*
 * Shared learning measures (docs/DEFINITIONS in the app, /definitions). One place for the rules so the
 * educator, admin and student views agree:
 *   - target: a score of 75% or higher
 *   - active: last scored session within 14 days; at risk 15-30 days; inactive over 30 days
 *   - a criterion is "below standard" when under 75% of its checklist is met (partly = half)
 * An educator's corrected verdict counts over the AI's.
 */
export const TARGET = 75;
export const ACTIVE_DAYS = 14;
export const RISK_DAYS = 30;
const DAY = 86400000;

export const scorePct = (v) => {
  const n = Number(v);
  if (!(n > 0)) return 0;
  return Math.round(n <= 1 ? n * 100 : n <= 10 ? n * 10 : n);
};

export const activity = (lastAt, now = Date.now()) => {
  if (!lastAt) return "new";
  const days = (now - new Date(lastAt).getTime()) / DAY;
  return days <= ACTIVE_DAYS ? "active" : days <= RISK_DAYS ? "atrisk" : "inactive";
};

const verdictValue = (q) => {
  const v = q.review?.observed || q.observed;
  return v === "yes" ? 1 : v === "partly" ? 0.5 : 0;
};

/** One session's checklist rolled up per criterion: Map(criterion -> { met, n }). */
export const byCriterion = (results = []) => {
  const m = new Map();
  for (const q of results) {
    const key = q.criterion || "General";
    const c = m.get(key) || { met: 0, n: 0 };
    c.met += verdictValue(q);
    c.n += 1;
    m.set(key, c);
  }
  return m;
};

/** Latest session per scenario, from sessions sorted oldest first. */
export const latestPerScenario = (sessions) => {
  const m = new Map();
  for (const s of sessions) m.set(s.scenario_id, s);
  return [...m.values()];
};

/** Per criterion % for a learner, pooled over the latest attempt at each scenario. */
export const learnerCriteria = (sessions) => {
  const pool = new Map();
  for (const s of latestPerScenario(sessions.filter((x) => x.question_results?.length))) {
    for (const [k, c] of byCriterion(s.question_results)) {
      const p = pool.get(k) || { met: 0, n: 0 };
      p.met += c.met;
      p.n += c.n;
      pool.set(k, p);
    }
  }
  return new Map([...pool].map(([k, c]) => [k, Math.round((c.met / c.n) * 100)]));
};
