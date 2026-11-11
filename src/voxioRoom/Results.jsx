// One results view for the whole visit, in the order the learner lived it:
//   Your reflection -> History taking -> Clinical reasoning
// A step strip on top shows what is done, preparing, or next, and doubles as the tabs, so the
// learner can go back to history-taking feedback after Clinical Reasoning. What is NOT here, on
// purpose: checklist questions and evidence (we teach the skill, not the list), distress and
// missed-red-flag markers (educator only), and the case itself until Clinical Reasoning is over.
import React, { useEffect, useRef, useState } from "react";
import { Brain, Check, LogOut, X, MessageCircleHeart, Stethoscope, ChevronDown, Target, ThumbsUp, Wrench, FileText, TrendingUp, TrendingDown, Lock, NotebookPen, Flag, RotateCcw } from "lucide-react";
import { Button, ButtonGroup } from "../components/vx/ui.jsx";
import HtTimelinePanel from "../components/feedback/HtTimelinePanel.jsx";
import { INDEPENDENCE_LABEL, LEVEL } from "../../backend/utils/reasoningScore.js";

const pct = (score) => (score == null ? null : Math.round(score <= 1 ? score * 100 : score));

/** Counts from 0 to `to` once it is known (ease-out, about 1 second). */
function useCountUp(to, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (to == null) return undefined;
    let raf; const t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return to == null ? null : v;
}

// Entrance motion for panels and bars (no animation library in the room).
const MOTION = `
@keyframes vr-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes vr-grow { from { transform: scaleX(0) } to { transform: scaleX(1) } }
.vr-rise { animation: vr-rise .45s cubic-bezier(.2,.7,.2,1) both }
.vr-grow { transform-origin: left; animation: vr-grow .9s cubic-bezier(.2,.7,.2,1) both }
@media (prefers-reduced-motion: reduce) { .vr-rise, .vr-grow { animation: none } }`;

function Ring({ value: target, size = 188, label }) {
  const value = useCountUp(target);
  const r = 52, c = 2 * Math.PI * r, frac = value == null ? 0 : Math.max(0, Math.min(1, value / 100));
  const tone = value == null ? "text-white" : value >= 75 ? "text-emerald-400" : value >= 50 ? "text-[rgb(var(--vx-accent))]" : "text-amber-400";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={label ? `${label}: ${value ?? "no score"} out of 100` : undefined}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-white/10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} className={`${tone} transition-[stroke-dashoffset] duration-700`} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-5xl font-semibold tabular-nums">{value == null ? "–" : value}</span>
        {value != null && <span className="mt-1 text-base text-[rgb(var(--vx-muted))]">out of 100</span>}
      </span>
    </div>
  );
}

const Spinner = ({ children }) => (
  <div className="flex flex-col items-center gap-3 py-12 text-sm text-neutral-400">
    <span className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" /> {children}
  </div>
);

function StepChip({ active, state, icon: Icon, title, value, onClick }) {
  // state: done | preparing | next | locked
  return (
    <Button size="lg" variant={active ? "default" : "secondary"} onClick={onClick} disabled={state === "locked"} aria-current={active ? "step" : undefined}
      className="h-auto min-w-0 flex-1 justify-start gap-3 px-5 py-3 text-left">
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${active ? "bg-black/15" : "bg-white/10"}`}>
        {state === "done" ? <Check /> : state === "preparing" ? <span className="size-4 rounded-full border-2 border-current/30 border-t-current animate-spin" /> : <Icon />}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{title}</span>
        <span className={`block truncate text-sm ${active ? "opacity-75" : "text-[rgb(var(--vx-muted))]"}`}>{value}</span>
      </span>
    </Button>
  );
}

/** Four segments, filled up to the final rating. */
const Segments = ({ final }) => (
  <span className="flex gap-1" aria-hidden>
    {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 w-6 rounded-full ${i <= final ? "bg-white" : "bg-white/15"}`} />)}
  </span>
);

const List = ({ icon: Icon, title, items }) => items?.length ? (
  <div className="rounded-xl border border-white/10 p-4">
    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Icon className="h-4 w-4" /> {title}</h4>
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-neutral-300">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
  </div>
) : null;

/** The change from the last attempt on this case (mindsets/student.md S4). */
function Change({ now, before, attempt }) {
  if (now == null) return null;
  if (before == null) return <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-neutral-300">{attempt > 1 ? `Attempt ${attempt}` : "First attempt on this case"}</span>;
  const d = now - before;
  const Icon = d >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`vr-rise inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${d > 0 ? "bg-emerald-400/15 text-emerald-300" : d < 0 ? "bg-white/10 text-neutral-300" : "bg-white/10 text-neutral-300"}`}>
      <Icon className="h-3.5 w-3.5" /> {d > 0 ? `+${d}` : d} since last time ({before}/100)
    </span>
  );
}

/** Skill by skill, names only (never the checklist): the weakest is what to practise next (S5, S2). */
function Skills({ skills }) {
  if (!skills?.length) return null;
  const sorted = [...skills].sort((a, b) => b.pct - a.pct);
  const weakest = sorted[sorted.length - 1]?.name;
  return (
    <div className="vr-rise rounded-xl border border-white/10 p-4" style={{ animationDelay: ".15s" }}>
      <h4 className="mb-3 text-sm font-semibold text-white">Your skills this attempt</h4>
      <ul className="space-y-2.5">
        {sorted.map((sk, i) => (
          <li key={sk.name}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className={sk.name === weakest ? "font-semibold text-white" : "text-neutral-300"}>
                {sk.name}{sk.name === weakest && <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-300">Practise next</span>}
              </span>
              <span className="tabular-nums text-neutral-400">{sk.pct}/100</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className={`vr-grow h-full rounded-full ${sk.pct >= 75 ? "bg-emerald-400" : sk.pct >= 50 ? "bg-white" : "bg-amber-400"}`}
                style={{ width: `${Math.max(3, sk.pct)}%`, animationDelay: `${0.25 + i * 0.07}s` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FLAGS = [["misheard", "It misheard me"], ["feedback", "Feedback seems wrong"], ["technical", "Technical problem"]];

/** One next step before leaving: what to change next time (S10), and "something wrong?" (S5, S6). */
function BeforeYouGo({ onSaveMine }) {
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState("");
  const [flag, setFlag] = useState(null);
  const saved = useRef("");
  if (!onSaveMine) return null;
  const saveNote = async () => {
    if (note.trim() === saved.current) return;
    setNoteState("saving");
    const ok = await onSaveMine({ note: note.trim() });
    if (ok) { saved.current = note.trim(); setNoteState("saved"); } else setNoteState("error");
  };
  const report = async (reason) => {
    const next = flag === reason ? null : reason;
    if (await onSaveMine({ flag: next ? { reason: next } : null })) setFlag(next);
  };
  return (
    <div className="vr-rise grid gap-0.5 overflow-hidden rounded-3xl md:grid-cols-[1.5fr_1fr]" style={{ animationDelay: ".3s" }}>
      <label className="flex flex-col gap-3 bg-[rgb(var(--vx-cell)/0.6)] p-5">
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 font-semibold"><span className="grid size-9 place-items-center rounded-xl bg-[rgb(var(--vx-accent)/0.15)] text-[rgb(var(--vx-accent))]"><NotebookPen className="size-[18px]" /></span> Next time I will…</span>
          <span className={`text-sm ${noteState === "saved" ? "text-emerald-300" : noteState === "error" ? "text-[rgb(var(--vx-danger))]" : "text-[rgb(var(--vx-muted))]"}`}>
            {noteState === "saving" ? "Saving…" : noteState === "saved" ? "Saved ✓" : noteState === "error" ? "Not saved" : "Only you see this"}
          </span>
        </span>
        <textarea value={note} onChange={(e) => { setNote(e.target.value); setNoteState(""); }} onBlur={saveNote} rows={2} maxLength={2000}
          placeholder="e.g. Ask about red flags before treatment."
          className="w-full resize-none rounded-2xl bg-[rgb(var(--vx-card))] px-4 py-3 text-base outline-none ring-1 ring-[rgb(var(--vx-line))] placeholder:text-[rgb(var(--vx-muted))] focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
      </label>
      <div className="flex flex-col gap-3 bg-[rgb(var(--vx-cell)/0.6)] p-5">
        <span className="flex items-center gap-2.5 font-semibold"><span className="grid size-9 place-items-center rounded-xl bg-white/10"><Flag className="size-[18px]" /></span> Something wrong?</span>
        <div role="group" className="flex w-full flex-col gap-0.5">
          {FLAGS.map(([k, l]) => (
            <Button key={k} variant={flag === k ? "soft" : "secondary"} aria-pressed={flag === k} onClick={() => report(k)}
              className="h-11 justify-between rounded-[8px] bg-[rgb(var(--vx-card))] px-4 first:rounded-t-[20px] last:rounded-b-[20px]">
              {l} {flag === k && <Check />}
            </Button>
          ))}
        </div>
        {flag && <p className="text-sm text-[rgb(var(--vx-muted))]">Sent to your educator. It does not change your score.</p>}
      </div>
    </div>
  );
}

const CASE_FIELDS = [["diagnosis", "Diagnosis"], ["alternatives", "Alternatives to consider"], ["key_findings", "Key findings"], ["red_flags", "Red flags"], ["examination", "Examination"], ["not_uncovered", "What was not uncovered"], ["expert_reasoning", "How an expert would reason"]];

export default function Results({ tab, setTab, phase, reflection, reflectionSaved, feedback, cr, crUnreadable, onReasoning, canReason, onExit, onClose, onReport, insight, onSaveMine, htTurns }) {
  const [showCase, setShowCase] = useState(false);
  const htScore = pct(feedback?.score);
  const crStarted = ["reasoning", "cr_ending", "cr_feedback"].includes(phase);
  const steps = [
    { key: "reflection", icon: MessageCircleHeart, title: "Your reflection", state: reflectionSaved ? "done" : "preparing",
      value: reflection?.self_rating != null ? `You rated ${reflection.self_rating}/10` : reflectionSaved ? "Saved" : "Saving…" },
    { key: "history", icon: Stethoscope, title: "History taking", state: feedback ? "done" : "preparing",
      value: feedback ? (htScore != null ? `${htScore}/100` : "Feedback ready") : "Preparing…" },
    { key: "reasoning", icon: Brain, title: "Clinical reasoning",
      state: cr ? "done" : phase === "cr_ending" ? "preparing" : feedback ? "next" : "locked",
      value: cr ? (cr.percent != null ? `${cr.percent}/100` : "Done") : phase === "cr_ending" ? "Preparing…" : "Next step" },
  ];

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
      <style>{MOTION}</style>
      <div className="vr-rise flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] shadow-2xl">
        <div className="flex items-center justify-between gap-4 px-8 pt-6">
          <h2 className="text-2xl font-semibold tracking-tight">Your results</h2>
          {onClose && <Button variant="secondary" onClick={onClose} title="Close" className="w-10 px-0"><X /></Button>}
        </div>

        <nav className="px-8 pt-5" aria-label="Results">
          <ButtonGroup className="flex w-full">
            {steps.map((s) => <StepChip key={s.key} {...s} active={tab === s.key} onClick={() => setTab(s.key)} />)}
          </ButtonGroup>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          {tab === "reflection" && (
            !reflectionSaved ? <Spinner>Saving your reflection…</Spinner> : (
              <div className="space-y-4">
                <p className="text-sm text-neutral-400">What you said before seeing any score. Compare it with the feedback: noticing the gap is how judgement improves.</p>
                {reflection?.summary
                  ? <blockquote className="rounded-xl border-l-4 border-white/60 bg-white/5 px-4 py-3 text-base italic leading-relaxed text-neutral-200">“{reflection.summary}”</blockquote>
                  : <p className="text-sm text-neutral-400">Your reflection is saved.</p>}
                {reflection?.self_rating != null && (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/10 p-4 text-sm">
                    <span>You rated yourself <b className="tabular-nums text-white">{reflection.self_rating}/10</b></span>
                    {htScore != null && <span>History taking scored <b className="tabular-nums text-white">{htScore}/100</b></span>}
                    {htScore != null && (
                      <span className="text-neutral-400">
                        {Math.abs(reflection.self_rating * 10 - htScore) <= 15 ? "Your sense of how it went matches the feedback."
                          : reflection.self_rating * 10 > htScore ? "You felt it went better than the feedback shows. Look at what was missed."
                          : "It went better than you thought. Look at what worked, and trust it."}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {tab === "history" && (
            !feedback ? <Spinner>Preparing your feedback…</Spinner> : (
              <div className="flex flex-col gap-8 md:flex-row md:items-start">
                <div className="flex flex-col items-center gap-3">
                  <Ring value={htScore} label="History taking" />
                  <span className="text-xs text-neutral-500">History taking</span>
                  <Change now={htScore} before={insight?.previous} attempt={insight?.attempt} />
                </div>
                <div className="min-w-0 flex-1 space-y-4 text-sm leading-relaxed text-neutral-300">
                  <Skills skills={insight?.skills} />
                  {feedback.text.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                  {htTurns?.length > 0 && <div className="pt-2 text-neutral-200 [--kink-ring:#1c1c1c]"><HtTimelinePanel turns={htTurns} /></div>}
                  {onReport && (
                    <button type="button" onClick={onReport} className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
                      <FileText className="h-4 w-4" /> Full report: every criterion, with evidence
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {tab === "reasoning" && (
            cr ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="flex flex-col items-center gap-1">
                    <Ring value={cr.percent} label="Clinical reasoning" />
                    <span className="text-xs text-neutral-500">Clinical reasoning</span>
                  </div>
                  <div className="space-y-3 text-sm leading-relaxed text-neutral-300">
                    {cr.percent == null && <p className="text-neutral-400">No score this time{cr.status === "skipped" ? ": the conversation was skipped" : ""}.</p>}
                    {cr.summary && <p>{cr.summary}</p>}
                    {cr.focus_next_time && (
                      <div className="rounded-xl bg-white/10 p-4">
                        <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Target className="h-4 w-4" /> Focus for next time</h4>
                        <p>{cr.focus_next_time}</p>
                      </div>
                    )}
                  </div>
                </div>

                {cr.criteria?.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-sm font-semibold text-white">By criterion</h4>
                    <p className="mb-2 text-xs text-neutral-500">Reasoning you reach on your own counts for more: needing a prompt caps the rating.</p>
                    <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                      {cr.criteria.map((r) => (
                        <li key={r.n} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                          <span className="min-w-0 flex-1 text-sm text-neutral-200">{r.name}</span>
                          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-neutral-300">{INDEPENDENCE_LABEL[r.independence]}</span>
                          <span className="flex items-center gap-2">
                            <Segments final={r.final} />
                            <span className="w-32 text-right text-xs text-neutral-400">{LEVEL[r.final]}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <List icon={ThumbsUp} title="What went well" items={cr.went_well} />
                  <List icon={Wrench} title="What to work on" items={cr.work_on} />
                </div>

                {cr.case_reveal && (
                  <div className="rounded-xl border border-white/10">
                    <button type="button" onClick={() => setShowCase((v) => !v)} aria-expanded={showCase}
                      className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-white/5">
                      The case, revealed <ChevronDown className={`h-4 w-4 transition-transform ${showCase ? "rotate-180" : ""}`} />
                    </button>
                    {showCase && (
                      <dl className="space-y-3 border-t border-white/10 px-4 py-3 text-sm text-neutral-300">
                        {CASE_FIELDS.filter(([k]) => cr.case_reveal[k]).map(([k, label]) => (
                          <div key={k}><dt className="text-xs uppercase tracking-wider text-neutral-500">{label}</dt><dd className="mt-0.5">{String(cr.case_reveal[k])}</dd></div>
                        ))}
                      </dl>
                    )}
                  </div>
                )}
              </div>
            ) : crUnreadable ? <p className="py-12 text-center text-sm text-neutral-400">Your Clinical Reasoning feedback could not be read. Your educator can still see the conversation.</p>
            : phase === "cr_ending" ? <Spinner>Preparing your Clinical Reasoning feedback…</Spinner> : (
              <div className="mx-auto max-w-md space-y-3 py-6 text-center">
                <Brain className="mx-auto h-8 w-8 text-neutral-400" />
                <h3 className="text-lg font-semibold">Talk through your reasoning</h3>
                <p className="text-sm text-neutral-400">
                  A guide asks what you noticed, what you think is going on, and why. Up to 10 minutes. It only narrows its questions if you get stuck, and reasoning you reach on your own counts for more.
                </p>
                {!crStarted && (
                  <button onClick={onReasoning} disabled={!canReason}
                    className="mx-auto mt-2 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-medium text-neutral-900 hover:bg-neutral-200 disabled:opacity-40">
                    <Brain className="h-4 w-4" /> Start Clinical Reasoning
                  </button>
                )}
                {!canReason && !crStarted && <p className="text-xs text-neutral-500">Available once your reflection and feedback are ready.</p>}
              </div>
            )
          )}
        </div>

        {feedback && tab !== "reflection" && <div className="px-8 pb-5"><BeforeYouGo key={insight?.recordId || "pending"} onSaveMine={insight?.recordId ? onSaveMine : null} /></div>}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[rgb(var(--vx-line))] px-8 py-4">
          <ButtonGroup>
            {phase === "feedback" && tab !== "reasoning" && (
              <Button size="lg" onClick={() => setTab(feedback && tab === "reflection" ? "history" : "reasoning")} className="px-7">
                {tab === "reflection" && feedback ? <><Stethoscope /> See your feedback</> : <><Brain /> Next: Clinical Reasoning</>}
              </Button>
            )}
            {cr
              ? <Button size="lg" onClick={onExit} className="px-7"><RotateCcw /> Done: see this attempt</Button>
              : <Button size="lg" variant="secondary" onClick={onExit} className="px-6"><LogOut /> Exit</Button>}
          </ButtonGroup>
        </div>
      </div>
    </div>
  );
}
