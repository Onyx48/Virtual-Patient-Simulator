// The learner's own view of one attempt, beyond the history-taking feedback: what they said in the
// reflection, and their Clinical Reasoning result. Same order as the patient room. Never shown here:
// checklist questions, evidence, or the educator-only markers (the API strips those for students).
import React, { useState } from "react";
import { MessageCircleHeart, Brain, ChevronDown, Target } from "lucide-react";
import { cn, toScorePercent } from "../../../lib/utils.js";

const muted = "text-[rgb(var(--vx-muted))]";
const card = "rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5";

const INDEPENDENCE_LABEL = { independent: "On your own", prompted: "With a prompt", step_by_step: "Step by step", not_reached: "Not reached yet", not_covered: "Not covered" };
const LEVEL = { 4: "Highly proficient", 3: "Proficient", 2: "Developing", 1: "Needs development" };
const CASE_FIELDS = [["diagnosis", "Diagnosis"], ["alternatives", "Alternatives to consider"], ["key_findings", "Key findings"], ["red_flags", "Red flags"], ["examination", "Examination"], ["not_uncovered", "What was not uncovered"], ["expert_reasoning", "How an expert would reason"]];

export function AttemptReflection({ reflection, score }) {
  if (!reflection?.summary && reflection?.self_rating == null) return null;
  const pct = score > 0 ? toScorePercent(score) : null;
  const gap = reflection.self_rating != null && pct != null ? reflection.self_rating * 10 - pct : null;
  return (
    <section className={card}>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><MessageCircleHeart size={18} /> Your reflection</h2>
      <p className={cn("mb-2 text-sm", muted)}>What you said before you saw any score.</p>
      {reflection.summary && <blockquote className="border-l-4 border-[rgb(var(--vx-accent))] pl-3 text-base italic">“{reflection.summary}”</blockquote>}
      {reflection.self_rating != null && (
        <p className="mt-2 text-base">
          You rated yourself <b className="tabular-nums">{reflection.self_rating}/10</b>
          {gap != null && <span className={muted}> · {Math.abs(gap) <= 15 ? "close to how it went" : gap > 0 ? "a little higher than the feedback; look at what was missed" : "lower than the feedback; trust what worked"}</span>}
        </p>
      )}
    </section>
  );
}

export function AttemptReasoning({ cr }) {
  const [showCase, setShowCase] = useState(false);
  if (!cr) return null;
  return (
    <section className={card}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Brain size={20} /> Clinical reasoning</h2>
        {cr.percent != null && <span className="text-base font-semibold tabular-nums">{cr.percent}%</span>}
      </div>
      {cr.summary && <p className="text-base leading-relaxed">{cr.summary}</p>}
      {cr.focus_next_time && (
        <div className="mt-3 rounded-xl bg-[rgb(var(--vx-accent)/0.1)] p-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><Target size={16} /> Focus for next time</p>
          <p className="text-base">{cr.focus_next_time}</p>
        </div>
      )}
      {cr.criteria?.length > 0 && (
        <ul className="mt-3 divide-y divide-[rgb(var(--vx-line)/0.7)]">
          {cr.criteria.map((r) => (
            <li key={r.n} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
              <span className="min-w-0 flex-1 text-base">{r.name}</span>
              <span className={cn("rounded-full bg-[rgb(var(--vx-cell))] px-2.5 py-0.5 text-sm", muted)}>{INDEPENDENCE_LABEL[r.independence] || r.independence}</span>
              <span className="flex items-center gap-2">
                <span className="flex gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1.5 w-5 rounded-full", i <= r.final ? "bg-[rgb(var(--vx-accent))]" : "bg-[rgb(var(--vx-cell))]")} />)}</span>
                <span className={cn("w-32 text-right text-sm", muted)}>{LEVEL[r.final]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {(cr.went_well?.length > 0 || cr.work_on?.length > 0) && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[["What went well", cr.went_well], ["What to work on", cr.work_on]].map(([t, items]) => items?.length ? (
            <div key={t}>
              <h3 className="mb-1 text-base font-semibold">{t}</h3>
              <ul className="list-disc space-y-1 pl-5 text-base">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          ) : null)}
        </div>
      )}
      {cr.case_reveal && (
        <div className="mt-3 border-t border-[rgb(var(--vx-line)/0.7)] pt-3">
          <button type="button" onClick={() => setShowCase((v) => !v)} aria-expanded={showCase} className="flex w-full items-center justify-between text-left text-base font-semibold">
            The case, revealed <ChevronDown size={18} className={cn("transition-transform", muted, showCase && "rotate-180")} />
          </button>
          {showCase && (
            <dl className="mt-2 flex flex-col gap-2">
              {CASE_FIELDS.filter(([k]) => cr.case_reveal[k]).map(([k, l]) => <div key={k}><dt className={cn("text-sm", muted)}>{l}</dt><dd className="text-base">{String(cr.case_reveal[k])}</dd></div>)}
            </dl>
          )}
        </div>
      )}
    </section>
  );
}
