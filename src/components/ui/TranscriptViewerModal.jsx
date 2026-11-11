// A student's sessions and transcripts, in the vx design. Same endpoint as before:
// GET /api/sessions/student/:id.
import { getAccessToken } from "../../lib/authToken.js";
const ScenarioInsights = React.lazy(() => import("../shared/ScenarioInsights"));
import { useCached } from "../../lib/query";
import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { ChevronDown, Clock, Loader2, MessageSquareText, Search, Copy, Printer, X, GitCompareArrows, ArrowUp, ArrowDown, FileText, BarChart3 } from "lucide-react";
const PdfViewer = React.lazy(() => import("../shared/PdfViewer"));
import { copyText, Select } from "../vx/bits";
import { useLanguage } from "../../i18n/LanguageContext";
import { toScorePercent, cn } from "../../lib/utils.js";
import { Button, Dialog } from "../vx/ui";
import HtTimelinePanel from "../feedback/HtTimelinePanel";
import { toast } from "react-hot-toast";

const muted = "text-[rgb(var(--vx-muted))]";
const card = "rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5";

const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${getAccessToken()}` } });

const OBSERVED = {
  yes: ["Yes", "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]"],
  partly: ["Partly", "bg-[rgb(var(--vx-warn)/0.14)] text-[rgb(var(--vx-warn))]"],
  no: ["No", "bg-[rgb(var(--vx-danger)/0.1)] text-[rgb(var(--vx-danger))]"],
};

const REFLECTION_STATUS = { completed: "Completed", partial: "Partly completed", skipped: "Skipped", ended_early_distress: "Ended early" };

const verdict = (r) => r.review?.observed || r.observed;

/** One question's review: Yes / Partly / No and a note. Saves on Save; Revert drops the override. */
function ReviewEditor({ r, onSave, onClose }) {
  const [obs, setObs] = useState(verdict(r));
  const [note, setNote] = useState(r.review?.note || "");
  const [busy, setBusy] = useState(false);
  const go = async (body) => { setBusy(true); try { await onSave(body); onClose(); } finally { setBusy(false); } };
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-[rgb(var(--vx-cell)/0.6)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-sm", muted)}>Your verdict</span>
        <div className="flex gap-0.5 rounded-full bg-[rgb(var(--vx-card))] p-1">
          {["yes", "partly", "no"].map((k) => (
            <button key={k} type="button" aria-pressed={obs === k} onClick={() => setObs(k)}
              className={cn("h-8 rounded-full px-3 text-sm font-medium", obs === k ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : cn(muted, "hover:text-[rgb(var(--vx-ink))]"))}>
              {OBSERVED[k][0]}
            </button>
          ))}
        </div>
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Why? (only educators see this)"
        className="w-full resize-y rounded-xl border-0 bg-[rgb(var(--vx-card))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {r.review && <Button variant="ghost" size="sm" disabled={busy} onClick={() => go({ number: r.number, observed: null })}>Back to the AI's verdict</Button>}
        <Button variant="secondary" size="sm" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={busy} onClick={() => go({ number: r.number, observed: obs, note })}>{busy ? <Loader2 className="animate-spin" /> : null} Save</Button>
      </div>
    </div>
  );
}

/** The grader's verdict per question, grouped by History Taking criterion. Educators only, and they can correct it. */
function QuestionResults({ results, onEvidence, onReview }) {
  const [editing, setEditing] = useState(null);
  const groups = results.reduce((acc, r) => { (acc[r.criterion || "Other"] ||= []).push(r); return acc; }, {});
  const yes = results.filter((r) => verdict(r) === "yes").length;
  const partly = results.filter((r) => verdict(r) === "partly").length;
  const changed = results.filter((r) => r.review).length;
  return (
    <section className={card}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-lg font-semibold">Grading questions</h4>
        <span className={cn("text-sm tabular-nums", muted)}>{yes} yes · {partly} partly · {results.length - yes - partly} no{changed ? ` · ${changed} changed by you` : ""}</span>
      </div>
      <p className={cn("mb-3 text-sm", muted)}>Marked by AI, for practice only. Click a verdict to change it.</p>
      <div className="flex flex-col gap-4">
        {Object.entries(groups).map(([criterion, rows]) => (
          <div key={criterion}>
            <div className="mb-1 text-sm font-semibold">{criterion}</div>
            <ul className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
              {rows.map((r) => {
                const [label, style] = OBSERVED[verdict(r)] || OBSERVED.no;
                return (
                  <li key={r.number} className="py-2">
                    <div className="flex items-start gap-3">
                      <span className={cn("w-8 shrink-0 text-sm tabular-nums", muted)}>Q{r.number}</span>
                      <span className="min-w-0 flex-1 text-base">
                        {r.question}
                        {r.evidence && (
                          <button type="button" onClick={() => onEvidence?.(r.evidence)} title="Show this in the conversation"
                            className={cn("mt-0.5 block text-left text-sm italic underline decoration-dotted underline-offset-2 hover:text-[rgb(var(--vx-ink))]", muted)}>
                            {r.evidence}
                          </button>
                        )}
                        {r.review && (
                          <span className={cn("mt-1 block text-sm", muted)}>
                            AI said {OBSERVED[r.observed]?.[0] || r.observed} · changed by {r.review.byName || "an educator"}
                            {r.review.note ? <>: <span className="text-[rgb(var(--vx-ink))]">{r.review.note}</span></> : null}
                          </span>
                        )}
                      </span>
                      <button type="button" onClick={() => setEditing(editing === r.number ? null : r.number)} disabled={!onReview}
                        title={onReview ? "Change this verdict" : undefined}
                        className={cn("shrink-0 rounded-full px-3 py-0.5 text-sm font-medium transition-shadow", style, onReview && "hover:ring-2 hover:ring-[rgb(var(--vx-accent)/0.5)]", r.review && "ring-1 ring-[rgb(var(--vx-ink)/0.25)]")}>
                        {label}{r.review ? " *" : ""}
                      </button>
                    </div>
                    {editing === r.number && <ReviewEditor r={r} onSave={onReview} onClose={() => setEditing(null)} />}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const RANK = { no: 0, partly: 1, yes: 2 };

/** Two attempts at one scenario, question by question: what improved, what slipped (oldest left). */
function CompareAttempts({ sessions, formatDate, onClose }) {
  const sorted = [...sessions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const [aId, setAId] = useState(sorted[sorted.length - 2]?._id);
  const [bId, setBId] = useState(sorted[sorted.length - 1]?._id);
  const A = sorted.find((x) => x._id === aId), B = sorted.find((x) => x._id === bId);
  const numbers = [...new Set([...(A?.question_results || []), ...(B?.question_results || [])].map((r) => r.number))].sort((x, y) => x - y);
  const get = (sess, n) => sess?.question_results?.find((r) => r.number === n);
  const better = numbers.filter((n) => RANK[verdict(get(B, n)) ?? "no"] > RANK[verdict(get(A, n)) ?? "no"]).length;
  const worse = numbers.filter((n) => RANK[verdict(get(B, n)) ?? "no"] < RANK[verdict(get(A, n)) ?? "no"]).length;
  const pick = (val, set) => (
    <Select size="sm" label="Attempt" value={val} onChange={set}
      options={sorted.map((x, i) => ({ value: x._id, label: `Attempt ${i + 1} · ${formatDate(x.createdAt)}`, hint: x.score > 0 ? `${toScorePercent(x.score)}%` : undefined }))} />
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">Compare attempts</h3>
        <Button variant="secondary" size="sm" onClick={onClose}>Back to the session</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">{pick(aId, setAId)} <span className={muted}>→</span> {pick(bId, setBId)}</div>
      <p className="text-base">
        {A && B && <>Score {toScorePercent(A.score)}% → <b>{toScorePercent(B.score)}%</b>. </>}
        <span className="text-[rgb(var(--vx-ok))]">{better} improved</span> · <span className="text-[rgb(var(--vx-danger))]">{worse} slipped</span>
      </p>
      {numbers.length === 0 ? <p className={cn("text-base", muted)}>These attempts have no graded questions to compare.</p> : (
        <section className={card}>
          <ul className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
            {numbers.map((n) => {
              const a = get(A, n), b = get(B, n);
              const ra = RANK[verdict(a) ?? "no"], rb = RANK[verdict(b) ?? "no"];
              const chip = (r) => { const [l, st] = OBSERVED[verdict(r)] || ["—", cn("bg-[rgb(var(--vx-cell))]", muted)]; return <span className={cn("w-16 rounded-full px-2 py-0.5 text-center text-sm font-medium", st)}>{l}</span>; };
              return (
                <li key={n} className="flex items-center gap-3 py-2">
                  <span className={cn("w-8 shrink-0 text-sm tabular-nums", muted)}>Q{n}</span>
                  <span className="min-w-0 flex-1 text-base">{(a || b)?.question}</span>
                  {chip(a)}
                  <span className="w-5 shrink-0">
                    {rb > ra ? <ArrowUp size={16} className="text-[rgb(var(--vx-ok))]" /> : rb < ra ? <ArrowDown size={16} className="text-[rgb(var(--vx-danger))]" /> : null}
                  </span>
                  {chip(b)}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The educator's private note on the session. Saves when it loses focus. */
function SessionNote({ note, onSave }) {
  const [text, setText] = useState(note?.text || "");
  const [state, setState] = useState("");
  useEffect(() => { setText(note?.text || ""); setState(""); }, [note]);
  const save = async () => {
    if (text.trim() === (note?.text || "")) return;
    setState("saving");
    try { await onSave({ sessionNote: text }); setState("saved"); } catch { setState("error"); }
  };
  return (
    <section className={card}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-lg font-semibold">Your note</h4>
        <span className={cn("text-sm", state === "error" ? "text-[rgb(var(--vx-danger))]" : muted)}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Not saved" : "Only educators see this"}
        </span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={save} rows={2}
        placeholder="e.g. Good rapport, but never asked about night pain. Discuss in tutorial."
        className="w-full resize-y rounded-xl border-0 bg-[rgb(var(--vx-cell)/0.6)] px-3 py-2 text-base outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
    </section>
  );
}

/** Self-reflection given before any feedback. The distress marker is for educators only. */
function SelfReflection({ reflection, score }) {
  return (
    <section className={card}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-lg font-semibold">Self-reflection</h4>
        <div className="flex items-center gap-2 text-sm">
          {reflection.distress_flag && <span className="rounded-full bg-[rgb(var(--vx-danger)/0.1)] px-3 py-0.5 font-medium text-[rgb(var(--vx-danger))]">Distress noted</span>}
          <span className={muted}>{REFLECTION_STATUS[reflection.status] || reflection.status}</span>
        </div>
      </div>
      {reflection.summary && <blockquote className="my-2 border-l-4 border-[rgb(var(--vx-accent))] pl-3 text-base italic">“{reflection.summary}”</blockquote>}
      {reflection.self_rating != null && (
        <p className="text-base">
          Rated themselves <span className="font-semibold tabular-nums">{reflection.self_rating}/10</span>
          {score > 0 && (() => {
            const gap = reflection.self_rating * 10 - toScorePercent(score);
            return <span className={muted}> · scored {toScorePercent(score)}% · {Math.abs(gap) <= 15 ? "an accurate sense of how it went" : gap > 0 ? "felt it went better than it did" : "felt it went worse than it did"}</span>;
          })()}
        </p>
      )}
    </section>
  );
}


const INDEPENDENCE_LABEL = { independent: "On their own", prompted: "With a prompt", step_by_step: "Step by step", not_reached: "Not reached", not_covered: "Not covered" };
const LEVEL = { 4: "Highly proficient", 3: "Proficient", 2: "Developing", 1: "Needs development" };
const CR_STATUS = { completed: "Completed", partial: "Partly completed", skipped: "Skipped", ended_early_distress: "Ended early" };
const CASE_FIELDS = [["diagnosis", "Diagnosis"], ["alternatives", "Alternatives"], ["key_findings", "Key findings"], ["red_flags", "Red flags"], ["examination", "Examination"], ["not_uncovered", "Not uncovered"], ["expert_reasoning", "Expert reasoning"]];

/** The Clinical Reasoning result: five weighted criteria, how independently each was reached, and the guide's notes. */
function ClinicalReasoning({ cr }) {
  const [showCase, setShowCase] = useState(false);
  if (!cr) return <section className={card}><p className={cn("text-base", muted)}>No Clinical Reasoning saved for this session. It was not started, or it ran before these results were saved.</p></section>;
  return (
    <div className="flex flex-col gap-3">
      <section className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-lg font-semibold">Clinical reasoning</h4>
          <span className={cn("text-sm", muted)}>{CR_STATUS[cr.status] || cr.status || ""}</span>
        </div>
        {cr.summary && <p className="text-base">{cr.summary}</p>}
        {cr.criteria?.length > 0 && (
          <ul className="mt-3 divide-y divide-[rgb(var(--vx-line)/0.7)]">
            {cr.criteria.map((r) => (
              <li key={r.n} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1 text-base">{r.name} <span className={cn("text-sm", muted)}>· weight {Math.round((r.weight || 0) * 100)}%</span></span>
                <span className={cn("rounded-full bg-[rgb(var(--vx-cell))] px-2.5 py-0.5 text-sm", r.independence !== "independent" && muted)}>{INDEPENDENCE_LABEL[r.independence] || r.independence}</span>
                <span className="flex items-center gap-2">
                  <span className="flex gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1.5 w-5 rounded-full", i <= r.final ? "bg-[rgb(var(--vx-accent))]" : "bg-[rgb(var(--vx-cell))]")} />)}</span>
                  <span className={cn("w-36 text-right text-sm", muted)}>{r.final}/4 · {LEVEL[r.final]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={cn("mt-2 text-sm", muted)}>The support a learner needed caps each rating: on their own 4, with a prompt 3, step by step 2.</p>
      </section>
      {(cr.went_well?.length > 0 || cr.work_on?.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {[["What went well", cr.went_well], ["What to work on", cr.work_on]].map(([t, items]) => items?.length ? (
            <section key={t} className={card}>
              <h4 className="mb-1 text-base font-semibold">{t}</h4>
              <ul className="list-disc space-y-1 pl-5 text-base">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </section>
          ) : null)}
        </div>
      )}
      {cr.focus_next_time && <section className={card}><h4 className="mb-1 text-base font-semibold">Focus for next time</h4><p className="text-base">{cr.focus_next_time}</p></section>}
      {cr.case_reveal && (
        <section className={card}>
          <button type="button" onClick={() => setShowCase((v) => !v)} aria-expanded={showCase} className="flex w-full items-center justify-between text-left text-base font-semibold">
            The case, as revealed to the learner <ChevronDown size={18} className={cn("transition-transform", muted, showCase && "rotate-180")} />
          </button>
          {showCase && (
            <dl className="mt-3 flex flex-col gap-2">
              {CASE_FIELDS.filter(([k]) => cr.case_reveal[k]).map(([k, l]) => <div key={k}><dt className={cn("text-sm", muted)}>{l}</dt><dd className="text-base">{String(cr.case_reveal[k])}</dd></div>)}
            </dl>
          )}
        </section>
      )}
    </div>
  );
}

// Rough but useful: an open question invites a story ("what", "how", "tell me", "describe").
const OPEN_START = /^(what|how|why|tell|describe|can you (tell|describe|explain)|could you (tell|describe|explain)|walk me|explain|talk me)/i;
const isQuestion = (t) => /\?\s*$/.test(t.trim()) || /^(what|how|why|when|where|who|which|do|does|did|is|are|was|were|have|has|can|could|would|will|tell|describe)\b/i.test(t.trim());

function questionStats(transcription = []) {
  const asked = transcription.filter((m) => m.role === "user" && isQuestion(m.content || ""));
  const open = asked.filter((m) => OPEN_START.test((m.content || "").trim()));
  return { asked: asked.length, open: open.length };
}

const words = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
/** Index of the message that best matches a piece of grader evidence (most shared words). */
function findEvidence(transcription = [], evidence = "") {
  const q = new Set(words(evidence.replace(/^["“]|["”]$/g, "")));
  if (!q.size) return -1;
  let best = -1, bestScore = 0;
  transcription.forEach((m, i) => {
    const score = words(m.content).filter((w) => q.has(w)).length / q.size;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return bestScore >= 0.4 ? best : -1;
}

function Highlight({ text, q }) {
  if (!q) return text;
  const parts = String(text).split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-[rgb(var(--vx-accent)/0.35)] px-0.5 text-inherit">{p}</mark> : p));
}

const ScoreChip = ({ score, big }) => score > 0 ? (
  <span className={cn("shrink-0 rounded-full bg-[rgb(var(--vx-accent)/0.18)] font-semibold tabular-nums", big ? "px-4 py-1 text-base" : "px-2.5 py-0.5 text-sm")}>
    {toScorePercent(score)}%
  </span>
) : null;

function TranscriptViewerModal({ isOpen, onClose, student, initialSessionId }) {
  const { language } = useLanguage();
  const studentId = student ? (student.id || student._id || student.user_id) : null;
  const [cachedSessions, setSessions, , sq] = useCached(studentId ? `/api/sessions/student/${studentId}` : null, { enabled: !!isOpen && !!studentId, fallback: [] });
  const sessions = cachedSessions || [];
  const loading = sq.isPending && !!isOpen;
  const [selected, setSelected] = useState(null);
  const [insightOf, setInsightOf] = useState(null);
  const staff = (() => { try { return JSON.parse(localStorage.getItem("currentUser"))?.role !== "student"; } catch { return false; } })();
  const [open, setOpen] = useState({});
  const [q, setQ] = useState("");
  const [comparing, setComparing] = useState(null); // scenario group key
  const [flash, setFlash] = useState(-1);
  const [view, setView] = useState("overview"); // overview | history | reasoning | conversation
  const [reportOpen, setReportOpen] = useState(false);
  const lineRefs = useRef([]);
  useEffect(() => { setQ(""); setFlash(-1); }, [selected]);
  useEffect(() => { setView("overview"); }, [selected?._id]);

  const review = async (body) => {
    try {
      const { data } = await axios.patch(`/api/sessions/${selected._id}/review`, body, getAuthHeaders());
      const patch = (x) => (x._id === selected._id ? { ...x, question_results: data.question_results, educator_note: data.educator_note } : x);
      setSelected((cur) => patch(cur));
      setSessions((list) => list.map(patch));
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not save that.");
      throw e;
    }
  };

  const jumpTo = (evidence) => {
    const i = findEvidence(selected?.transcription, evidence);
    if (i < 0) return;
    setView("conversation");
    setTimeout(() => lineRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    setFlash(i);
    setTimeout(() => setFlash(-1), 1800);
  };
  const asText = (sess) => (sess.transcription || []).map((m) => {
    const who = m.speaker?.trim() || (m.role === "user" ? "Student" : m.role === "assistant" ? "Patient" : "System");
    return `${who}: ${m.content}`;
  }).join("\n");
  const print = (sess) => {
    const w = window.open("", "_blank", "noopener,width=800,height=900");
    if (!w) return;
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(student?.name || "")} · ${esc(sess.scenario_id?.scenarioName || "Session")}</title>
      <style>body{font:15px/1.6 Figtree,system-ui,sans-serif;max-width:720px;margin:40px auto;color:#1c1b18}h1{font-size:22px;margin:0}p.m{color:#6b665d;margin:4px 0 24px}b{font-weight:600}div{margin:6px 0}</style>
      <h1>${esc(sess.scenario_id?.scenarioName || "Session")}</h1>
      <p class="m">${esc(student?.name || "")} · ${esc(formatDate(sess.createdAt))}${sess.score > 0 ? ` · ${toScorePercent(sess.score)}%` : ""}</p>
      ${asText(sess).split("\n").map((l) => { const [a, ...b] = l.split(": "); return `<div><b>${esc(a)}:</b> ${esc(b.join(": "))}</div>`; }).join("")}`);
    w.document.close();
    w.focus();
    w.print();
  };


  // Follow the app language, not the browser locale.
  const formatDate = (s) => {
    if (!s) return "";
    const d = new Date(s);
    const locale = language === "ja" ? "ja-JP" : "en-US";
    return `${d.toLocaleDateString(locale)} ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
  };

  const grouped = useMemo(() => sessions.reduce((acc, s) => {
    const id = s.scenario_id?._id || s.scenario_id || "unknown";
    (acc[id] ||= { name: s.scenario_id?.scenarioName || "Unknown scenario", sessions: [] }).sessions.push(s);
    return acc;
  }, {}), [sessions]);

  // Open the first scenario so there is something to click straight away, or the session asked for.
  useEffect(() => {
    if (initialSessionId) {
      const hit = sessions.find((x) => String(x._id) === String(initialSessionId));
      if (hit) {
        setSelected(hit);
        setOpen((o) => ({ ...o, [hit.scenario_id?._id || hit.scenario_id || "unknown"]: true }));
        return;
      }
    }
    const first = Object.keys(grouped)[0];
    if (first) setOpen((o) => (Object.keys(o).length ? o : { [first]: true }));
  }, [grouped, sessions, initialSessionId]);

  if (!isOpen) return null;

  return (
    <>
    {insightOf && <React.Suspense fallback={null}><ScenarioInsights scenario={insightOf} onClose={() => setInsightOf(null)} /></React.Suspense>}
    <Dialog title="Transcripts" subtitle={student?.name} onClose={onClose} size="full" bodyClass="px-0 pb-0">
      <div className="flex min-h-[60vh] flex-col border-t border-[rgb(var(--vx-line)/0.7)] md:flex-row">
        <aside className="shrink-0 overflow-y-auto border-[rgb(var(--vx-line)/0.7)] p-4 md:w-[26rem] md:border-r">
          {loading ? (
            <p className={cn("flex items-center gap-2 text-base", muted)}><Loader2 size={18} className="animate-spin" /> Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className={cn("text-base", muted)}>No sessions yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {Object.entries(grouped).map(([id, g]) => (
                <li key={id} className="overflow-hidden rounded-2xl bg-[rgb(var(--vx-card))]">
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [id]: o[id] === false }))} aria-expanded={open[id] !== false}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-[rgb(var(--vx-cell)/0.5)]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{g.name}</span>
                      <span className={cn("text-sm", muted)}>{g.sessions.length} session{g.sessions.length === 1 ? "" : "s"}</span>
                    </span>
                    <ChevronDown size={18} className={cn("shrink-0 transition-transform", muted, open[id] !== false && "rotate-180")} />
                  </button>
                  {open[id] !== false && (
                    <div className="flex flex-col gap-0.5 px-2 pb-2">
                      {staff && id !== "unknown" && (
                        <button type="button" onClick={() => setInsightOf({ _id: id, scenarioName: g.name })}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[rgb(var(--vx-cell)/0.6)]">
                          <BarChart3 size={16} className={muted} /> Scenario analytics: the whole class
                        </button>
                      )}
                      {g.sessions.length > 1 && (
                        <button type="button" onClick={() => { setComparing(id); setSelected(null); }}
                          className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                            comparing === id ? "bg-[rgb(var(--vx-accent)/0.15)]" : "hover:bg-[rgb(var(--vx-cell)/0.6)]")}>
                          <GitCompareArrows size={16} className={muted} /> Compare attempts
                        </button>
                      )}
                      {g.sessions.map((s) => {
                        const on = selected?._id === s._id;
                        return (
                          <button key={s._id} type="button" onClick={() => { setSelected(s); setComparing(null); }} aria-pressed={on}
                            className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors",
                              on ? "bg-[rgb(var(--vx-accent)/0.15)]" : "hover:bg-[rgb(var(--vx-cell)/0.6)]")}>
                            <Clock size={16} className={muted} />
                            <span className="flex-1 text-sm tabular-nums">{formatDate(s.createdAt)}</span>
                            {s.student_flag?.reason && <span title="Reported by the student" className="size-2 shrink-0 rounded-full bg-[rgb(var(--vx-warn))]" />}
                            <ScoreChip score={s.score} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          {comparing && grouped[comparing] ? (
            <CompareAttempts sessions={grouped[comparing].sessions} formatDate={formatDate} onClose={() => setComparing(null)} />
          ) : !selected ? (
            <div className={cn("flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-base", muted)}>
              <MessageSquareText size={32} />
              Pick a session to read it.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{selected.scenario_id?.scenarioName || "Session"}</h3>
                  <p className={cn("text-sm", muted)}>{formatDate(selected.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setReportOpen(true)}><FileText /> Full report</Button>
                  {[["History taking", selected.score > 0 ? `${toScorePercent(selected.score)}%` : null],
                    ["Clinical reasoning", selected.clinical_reasoning?.percent != null ? `${selected.clinical_reasoning.percent}%` : null],
                    ["Self-rating", selected.reflection?.self_rating != null ? `${selected.reflection.self_rating}/10` : null]]
                    .filter(([, v]) => v).map(([l, v]) => (
                      <span key={l} className="rounded-xl bg-[rgb(var(--vx-cell))] px-3 py-1.5 text-center">
                        <span className={cn("block text-xs", muted)}>{l}</span>
                        <span className="block text-base font-semibold tabular-nums">{v}</span>
                      </span>
                    ))}
                </div>
              </div>

              {/* What an educator must not miss stays above the tabs. */}
              {(selected.reflection?.distress_flag || selected.clinical_reasoning?.distress_flag) && (
                <p className="rounded-2xl border border-[rgb(var(--vx-danger)/0.4)] bg-[rgb(var(--vx-danger)/0.08)] px-4 py-3 text-base">
                  <b>Distress noted</b> during {selected.reflection?.distress_flag ? "the reflection" : "Clinical Reasoning"}. Consider checking in with this learner.
                </p>
              )}
              {selected.clinical_reasoning?.missed_red_flag && (
                <p className="rounded-2xl border border-[rgb(var(--vx-warn)/0.4)] bg-[rgb(var(--vx-warn)/0.08)] px-4 py-3 text-base">
                  <b>Missed a red flag</b> in Clinical Reasoning. The case is under Clinical reasoning.
                </p>
              )}
              {selected.student_flag?.reason && (
                <section className="rounded-2xl border border-[rgb(var(--vx-warn)/0.4)] bg-[rgb(var(--vx-warn)/0.08)] p-4">
                  <h4 className="text-base font-semibold">The student reported: {{ misheard: "It misheard me", feedback: "Feedback seems wrong", technical: "Technical problem", other: "Something else" }[selected.student_flag.reason]}</h4>
                  {selected.student_flag.text && <p className="text-base">“{selected.student_flag.text}”</p>}
                  <p className={cn("text-sm", muted)}>Check the conversation; change a verdict under History taking if the grade was unfair.</p>
                </section>
              )}

              <div role="tablist" aria-label="Session" className="flex flex-wrap gap-1 self-start rounded-full bg-[rgb(var(--vx-cell))] p-1">
                {[["overview", "Overview"], ["history", "History taking"], ["reasoning", "Clinical reasoning"], ["conversation", "Conversation"]].map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
                    className={cn("h-9 rounded-full px-4 text-sm font-medium transition-colors", view === k ? "bg-[rgb(var(--vx-card))] shadow-sm" : cn(muted, "hover:text-[rgb(var(--vx-ink))]"))}>
                    {l}
                  </button>
                ))}
              </div>

              {view === "overview" && (
                <>
                  {selected.reflection?.status
                    ? <SelfReflection reflection={selected.reflection} score={selected.score} />
                    : <section className={card}><h4 className="text-lg font-semibold">Self-reflection</h4><p className={cn("text-base", muted)}>No reflection for this session.</p></section>}
                  {selected.ht_turns?.length > 0 && (
                    <section className={cn(card, "[--kink-ring:#fff]")}>
                      <HtTimelinePanel turns={selected.ht_turns} final={selected.ht_final} state={selected.ht_state} onJump={() => setView("conversation")} />
                    </section>
                  )}
                  {(selected.feedback || selected.clinical_reasoning) && (
                    <section className={card}>
                      <h4 className="mb-2 text-lg font-semibold">At a glance</h4>
                      <dl className="grid gap-3 md:grid-cols-2">
                        <div>
                          <dt className={cn("text-sm", muted)}>History taking</dt>
                          <dd className="text-base">{selected.question_results?.length
                            ? `${selected.question_results.filter((r) => verdict(r) === "yes").length} of ${selected.question_results.length} questions covered`
                            : selected.feedback ? "Feedback given" : "No result"}</dd>
                        </div>
                        <div>
                          <dt className={cn("text-sm", muted)}>Clinical reasoning: focus next time</dt>
                          <dd className="text-base">{selected.clinical_reasoning?.focus_next_time || <span className={muted}>—</span>}</dd>
                        </div>
                      </dl>
                    </section>
                  )}
                  <SessionNote note={selected.educator_note} onSave={review} />
                </>
              )}

              {view === "history" && (
                <>
                  {selected.feedback && (
                    <section className="rounded-2xl border border-[rgb(var(--vx-accent)/0.4)] bg-[rgb(var(--vx-accent)/0.06)] p-5">
                      <h4 className="mb-1 text-lg font-semibold">Feedback the learner saw</h4>
                      <p className="whitespace-pre-line text-base">{selected.feedback}</p>
                    </section>
                  )}
                  {selected.question_results?.length > 0
                    ? <QuestionResults results={selected.question_results} onEvidence={jumpTo} onReview={review} />
                    : !selected.feedback && <section className={card}><p className={cn("text-base", muted)}>Not graded yet.</p></section>}
                </>
              )}

              {view === "reasoning" && <ClinicalReasoning cr={selected.clinical_reasoning} />}

              {view === "conversation" && (
              <section className={card}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h4 className="mr-auto text-lg font-semibold">Conversation</h4>
                  {(() => {
                    const st = questionStats(selected.transcription);
                    return st.asked > 0 ? (
                      <span className={cn("text-sm tabular-nums", muted)} title="Open questions start with what, how, why, tell me or describe.">
                        {st.asked} question{st.asked === 1 ? "" : "s"} · {Math.round((st.open / st.asked) * 100)}% open
                      </span>
                    ) : null;
                  })()}
                  {selected.transcription?.length > 0 && (
                    <>
                      <label className="relative">
                        <Search size={16} className={cn("pointer-events-none absolute left-3 top-1/2 -translate-y-1/2", muted)} />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find in conversation" aria-label="Find in conversation"
                          className="h-9 w-48 rounded-full border-0 bg-[rgb(var(--vx-cell))] pl-9 pr-8 text-sm outline-none placeholder:text-[rgb(var(--vx-muted))] focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
                        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear" className={cn("absolute right-2 top-1/2 -translate-y-1/2", muted)}><X size={14} /></button>}
                      </label>
                      <button type="button" onClick={() => copyText(asText(selected), "Transcript copied")} title="Copy as text"
                        className={cn("grid size-9 place-items-center rounded-full hover:bg-[rgb(var(--vx-cell))]", muted)}><Copy size={17} /></button>
                      <button type="button" onClick={() => print(selected)} title="Print"
                        className={cn("grid size-9 place-items-center rounded-full hover:bg-[rgb(var(--vx-cell))]", muted)}><Printer size={17} /></button>
                    </>
                  )}
                </div>
                {q && selected.transcription?.length > 0 && (
                  <p className={cn("mb-2 text-sm", muted)}>
                    {selected.transcription.filter((m) => String(m.content).toLowerCase().includes(q.toLowerCase())).length} matching line(s)
                  </p>
                )}
                {selected.transcription?.length ? (
                  <ol className="flex flex-col gap-2">
                    {selected.transcription.map((m, i) => {
                      const hidden = q && !String(m.content).toLowerCase().includes(q.toLowerCase());
                      const student = m.role === "user";
                      const who = m.speaker?.trim() || (student ? "Student" : m.role === "assistant" ? "Patient" : "System");
                      return (
                        <li key={i} ref={(el) => { lineRefs.current[i] = el; }} className={cn("flex transition-opacity", student ? "justify-end" : "justify-start", hidden && "opacity-30")}>
                          <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 transition-shadow", flash === i && "ring-2 ring-[rgb(var(--vx-accent))]",
                            student ? "rounded-br-md bg-[rgb(var(--vx-accent)/0.15)]" : m.role === "assistant" ? "rounded-bl-md bg-[rgb(var(--vx-cell))]" : "bg-transparent italic")}>
                            <div className={cn("text-xs font-semibold", muted)}>{who}</div>
                            <div className="text-base leading-relaxed"><Highlight text={m.content} q={q} /></div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className={cn("text-base", muted)}>No transcript for this session.</p>
                )}
              </section>
              )}
            </div>
          )}
        </div>
      </div>
      {reportOpen && selected && (
        <React.Suspense fallback={null}>
          <PdfViewer url={`/api/sessions/${selected._id}/report.pdf`} title="History Taking Feedback Report"
            subtitle={`${student?.name || ""} · ${selected.scenario_id?.scenarioName || "Session"} · ${formatDate(selected.createdAt)}`}
            filename={`feedback-report-${String(student?.name || "learner").replace(/\s+/g, "-")}.pdf`} onClose={() => setReportOpen(false)} />
        </React.Suspense>
      )}
    </Dialog>
    </>
  );
}

export default TranscriptViewerModal;
