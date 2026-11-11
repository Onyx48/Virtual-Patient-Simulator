import React, { useState, useEffect, useMemo } from "react";
import { useApi } from "../../../lib/query";
import { useParams } from "../../../lib/router";
import { setCrumb } from "../../../components/Header/Header";
import { useDispatch, useSelector } from "react-redux";
import { Play, Lock, Copy, Flag, Check, Clock3, Mic, MessageCircleQuestion, NotebookPen } from "lucide-react";
import { copyText } from "@/components/vx/bits";
import { requestStart } from "@/components/shared/MicCheck";
import { FileText } from "lucide-react";
const PdfViewer = React.lazy(() => import("@/components/shared/PdfViewer"));
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Button } from "@/components/vx/ui";
import { Ago } from "@/components/vx/bits";
import { difficultyLabel } from "./ScenrioGridStudent";
import { AttemptReflection, AttemptReasoning } from "./AttemptParts";
import "@/components/vx/vx.css";
import axios from "axios";
import toast from "react-hot-toast";
import { getAuthHeaders, toScorePercent, cn } from "../../../lib/utils.js";
import {
  fetchSessionsByStudentAndScenario,
  fetchScenario,
} from "../../../redux/slices/sessionSlice.js";

function StudentScenarioDetails() {
  const { id: scenarioId } = useParams();
  const [activeAttempt, setActiveAttempt] = useState(1);
  const [showAllTurns, setShowAllTurns] = useState(false);

  // TanStack Query (was Redux thunks): cached per scenario, so going back and forth is instant,
  // and a new attempt (room Exit, ?attempt=) is picked up because saves invalidate the cache.
  const studentId = useMemo(() => { try { return JSON.parse(localStorage.getItem("currentUser"))?._id || null; } catch { return null; } }, []);
  const scenarioQ = useApi(scenarioId ? `/api/scenarios/${scenarioId}` : null, {
    select: (d) => ({ id: d._id, name: d.scenarioName, description: d.description, difficulty: d.difficulty || "Medium",
      testable: d.testable === true, learningObjectives: d.learningObjectives || "", profession: d.profession || "" }),
  });
  const sessionsQ = useApi(studentId && scenarioId ? `/api/sessions/by-student/${studentId}/${scenarioId}` : null, { params: { page: 1, limit: 50 } });
  const scenarioData = scenarioQ.data || null;
  const sessions = sessionsQ.data?.sessions || [];
  const totalCount = sessionsQ.data?.totalCount ?? 0;
  const loading = sessionsQ.isPending;

  useEffect(() => { const n = scenarioData?.scenarioName || scenarioData?.name; if (n) setCrumb(n); }, [scenarioData]);

  // From the room's Exit: /student/scenario/:id?attempt=<record id> opens the attempt just done.
  const wantedAttempt = useMemo(() => new URLSearchParams(window.location.search).get("attempt"), [scenarioId]);
  useEffect(() => {
    if (!wantedAttempt) return;
    const sorted = [...sessions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const i = sorted.findIndex((s) => String(s._id) === wantedAttempt);
    if (i >= 0) setActiveAttempt(i + 1);
  }, [sessions, wantedAttempt]);

  // A fresh read when arriving from the room with a new attempt.
  useEffect(() => { if (wantedAttempt) sessionsQ.refetch(); }, [wantedAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSession = useMemo(() => {
    if (sessions.length === 0) return null;
    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    return sortedSessions[activeAttempt - 1] || sortedSessions[0];
  }, [sessions, activeAttempt]);

  // Scores are stored as a 0-1 fraction (a few legacy rows out of 10).
  const toPercent = toScorePercent;

  const attemptsData = useMemo(() => {
    if (sessions.length === 0) return [];
    /*
     * Copied before sorting. `sessions` comes straight from the Redux store, which
     * Immer freezes, so an in-place sort throws "Cannot assign to read only
     * property '0'" — and only sometimes, because V8's sort writes nothing when
     * the array already happens to be in order. Same reason the currentSession
     * memo above spreads first.
     */
    return [...sessions]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((s) => toPercent(s.score));
  }, [sessions]);

  const results = useMemo(() => {
    if (sessions.length === 0)
      return { lowest: "0%", average: "0%", highest: "0%" };
    const scores = sessions.map((s) => toPercent(s.score));
    const lowest = Math.min(...scores);
    const highest = Math.max(...scores);
    const average = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
    return {
      lowest: `${lowest}%`,
      average: `${average}%`,
      highest: `${highest}%`,
    };
  }, [sessions]);

  const currentScore = currentSession?.score ?? 0;
  const currentFeedback = currentSession?.feedback ?? "";
  const totalAttempts = totalCount || sessions.length || 0;

  /*
   * Only scenarios the backend has enabled can be run in the simulator — see
   * backend/utils/testableScenarios.js. Absent (an older response, or the scenario
   * not loaded yet) counts as not startable, so the button fails closed instead of
   * offering a run that POST /api/sessions/start will refuse.
   */
  const canStart = scenarioData?.testable === true;
  const startBlockedReason = "Not open for practice yet. Your educator will enable it.";

  const handleStartSession = async () => {
    if (!scenarioId) {
      toast.error("Scenario ID is missing.");
      return;
    }
    if (!canStart) {
      toast.error(startBlockedReason);
      return;
    }

    requestStart(scenarioId);
  };

  const sorted = useMemo(() => [...sessions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [sessions]);
  // Local copies of what the student saved on an attempt (note, flag), keyed by session id.
  const [mine, setMine] = useState({});
  const mineOf = (x) => mine[x?._id] || { note: x?.student_note || "", flag: x?.student_flag || null, rating: x?.student_rating ?? null };
  const saveMine = async (x, body) => {
    try {
      const { data } = await axios.patch(`/api/sessions/${x._id}/mine`, body, getAuthHeaders());
      setMine((m) => ({ ...m, [x._id]: { note: data.student_note || "", flag: data.student_flag, rating: data.student_rating ?? null } }));
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not save that.");
      return false;
    }
  };
  const [noteDraft, setNoteDraft] = useState("");
  const [noteState, setNoteState] = useState("");
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("misheard");
  const [flagText, setFlagText] = useState("");
  useEffect(() => {
    setNoteDraft(mineOf(currentSession).note);
    setNoteState("");
    setFlagOpen(false);
    setFlagText("");
  }, [currentSession?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  const objectives = String(scenarioData?.learningObjectives || "").split("\n").map((l) => l.replace(/^[\s•\-*\d.)]+/, "").trim()).filter(Boolean);
  const delta = (i) => (i > 0 ? attemptsData[i] - attemptsData[i - 1] : null);
  const [reportOpen, setReportOpen] = useState(false);
  const signed = (n) => (n > 0 ? `+${n}` : String(n));
  const chart = attemptsData.map((score, i) => ({ attempt: `#${i + 1}`, score, index: i + 1 }));
  const turns = (currentSession?.transcription || []).filter((t) => t.role !== "system");
  const muted = "text-[rgb(var(--vx-muted))]";
  const card = "rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5";
  const latest = attemptsData.length ? attemptsData[attemptsData.length - 1] : null;

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">{scenarioData?.name || "Scenario"}</h1>
            <p className={cn("mt-1 flex flex-wrap items-center gap-2 text-base", muted)}>
              <span className="rounded-full bg-[rgb(var(--vx-cell))] px-3 py-0.5 text-sm font-medium text-[rgb(var(--vx-ink))]">{difficultyLabel(scenarioData?.difficulty)}</span>
              {totalAttempts} attempt{totalAttempts === 1 ? "" : "s"}
            </p>
            {scenarioData?.description && scenarioData.description !== scenarioData.name && <p className={cn("mt-2 max-w-3xl text-base", muted)}>{scenarioData.description}</p>}
          </div>
          <Button size="lg" onClick={handleStartSession} disabled={!canStart} title={canStart ? "Opens the simulator in a new tab" : startBlockedReason}>
            {canStart ? <Play /> : <Lock />} {canStart ? (sessions.length ? "Practise again" : "Start") : "Not open yet"}
          </Button>
        </header>

        <details open={sessions.length === 0} className="group rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xl font-semibold">
            Before you start
            <span className={cn("text-sm font-normal", muted)}>{sessions.length ? "Show" : ""}</span>
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-base font-semibold">What this case practises</h3>
              {objectives.length ? (
                <ul className="list-disc pl-5 text-base leading-relaxed">{objectives.map((o) => <li key={o}>{o}</li>)}</ul>
              ) : <p className={cn("text-base", muted)}>Taking a full history from this patient and reasoning about it.</p>}
            </div>
            <ul className={cn("flex flex-col gap-2 text-base", muted)}>
              <li className="flex gap-2"><Clock3 size={18} className="mt-0.5 shrink-0" /> About 15 minutes. Practise as often as you like.</li>
              <li className="flex gap-2"><Mic size={18} className="mt-0.5 shrink-0" /> A quiet room and a headset help. Speak as you would to a real patient.</li>
              <li className="flex gap-2"><MessageCircleQuestion size={18} className="mt-0.5 shrink-0" /> Start with open questions, then narrow down. Screen for red flags.</li>
              <li className="flex gap-2"><Check size={18} className="mt-0.5 shrink-0" /> It is practice. Only you and your educator see the results.</li>
            </ul>
          </div>
        </details>

        {loading && sessions.length === 0 ? (
          <div className="h-40 animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]" />
        ) : sessions.length === 0 ? (
          <section className={cn(card, "py-14 text-center")}>
            <h2 className="text-xl font-semibold">No attempts yet</h2>
            <p className={cn("mt-1 text-base", muted)}>Start a session. Your score, feedback and the conversation show here afterwards.</p>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Latest", latest != null ? `${latest}%` : "—"], ["Best", results.highest], ["Average", results.average], ["Attempts", totalAttempts]].map(([l, v]) => (
                <div key={l} className={cn(card, "p-4")}><div className={cn("text-sm", muted)}>{l}</div><div className="text-3xl font-semibold tabular-nums">{v}</div></div>
              ))}
            </div>

            <section className={card}>
              <h2 className="mb-2 text-xl font-semibold">Score per attempt</h2>
              <div className="vx-chart">
                <BarChart data={chart} xDataKey="attempt" aspectRatio="auto" valueMax={100} className="h-[220px]"
                  margin={{ top: 12, right: 8, bottom: 32, left: 8 }} maxBarWidth={44} animationDuration={600}>
                  <Grid horizontal vertical={false} />
                  <Bar dataKey="score" fill="var(--chart-1)" />
                  <BarXAxis showAllLabels />
                  <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: `Attempt ${p.index}`, value: `${p.score}%` }]} />
                </BarChart>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sorted.map((x, i) => (
                  <button key={x._id || i} type="button" onClick={() => setActiveAttempt(i + 1)} aria-pressed={activeAttempt === i + 1}
                    className={cn("h-9 rounded-full px-3 text-sm font-medium transition-colors",
                      activeAttempt === i + 1 ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "bg-[rgb(var(--vx-cell))] hover:bg-[rgb(var(--vx-accent)/0.15)]")}>
                    Attempt {i + 1} · {toPercent(x.score)}%{delta(i) ? <span className="opacity-70"> ({signed(delta(i))})</span> : null}
                  </button>
                ))}
              </div>
            </section>

            <AttemptReflection reflection={currentSession?.reflection} score={currentScore} />

            <section className="rounded-2xl border border-[rgb(var(--vx-accent)/0.4)] bg-[rgb(var(--vx-accent)/0.06)] p-5">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">History taking: attempt {activeAttempt}</h2>
                <span className="flex items-center gap-2">
                  {delta(activeAttempt - 1) != null && (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-medium tabular-nums",
                      delta(activeAttempt - 1) >= 0 ? "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]" : "bg-[rgb(var(--vx-cell))]")}>
                      {signed(delta(activeAttempt - 1))} on last time
                    </span>
                  )}
                  <span className="text-base font-semibold tabular-nums">{toPercent(currentScore)}%</span>
                  {currentSession?._id && (
                    <button type="button" onClick={() => setReportOpen(true)} title="Your full feedback report (PDF)"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[rgb(var(--vx-card))] px-3 text-sm font-medium hover:bg-[rgb(var(--vx-accent)/0.15)]"><FileText size={15} /> Full report</button>
                  )}
                  {currentFeedback && (
                    <button type="button" onClick={() => copyText(currentFeedback, "Feedback copied")} title="Copy feedback" aria-label="Copy feedback"
                      className={cn("grid size-8 place-items-center rounded-full hover:bg-[rgb(var(--vx-card))]", muted)}><Copy size={16} /></button>
                  )}
                </span>
              </div>
              {currentSession?.createdAt && <p className={cn("mb-2 text-sm", muted)}><Ago date={currentSession.createdAt} /></p>}
              <p className="whitespace-pre-line text-base leading-relaxed">{currentFeedback || "No feedback for this attempt."}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--vx-accent)/0.25)] pt-3">
                <span className="text-sm font-medium">How realistic did the patient feel?</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-pressed={mineOf(currentSession).rating === n} title={["", "Not at all", "A little", "Somewhat", "Mostly", "Very"][n]}
                    onClick={() => saveMine(currentSession, { rating: n })}
                    className={cn("size-9 rounded-full text-sm font-semibold transition-colors", mineOf(currentSession).rating === n ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "bg-[rgb(var(--vx-card))] hover:bg-[rgb(var(--vx-accent)/0.15)]")}>{n}</button>
                ))}
                <span className={cn("text-xs", muted)}>Helps your educator improve the case.</span>
              </div>
            </section>

            <AttemptReasoning cr={currentSession?.clinical_reasoning} />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <section className={card}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold"><NotebookPen size={18} /> Next time I will…</h2>
                  <span className={cn("text-sm", muted)}>{noteState === "saving" ? "Saving…" : noteState === "saved" ? "Saved" : "Only you see this"}</span>
                </div>
                <textarea value={noteDraft} onChange={(e) => { setNoteDraft(e.target.value); setNoteState(""); }} rows={3}
                  onBlur={async () => { if (noteDraft !== mineOf(currentSession).note) { setNoteState("saving"); if (await saveMine(currentSession, { note: noteDraft })) setNoteState("saved"); else setNoteState(""); } }}
                  placeholder="e.g. Ask about night pain before treatment. Slow down at the start."
                  className="w-full resize-y rounded-xl border-0 bg-[rgb(var(--vx-cell)/0.6)] px-3 py-2 text-base outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
              </section>
              <section className={card}>
                <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Flag size={18} /> Something wrong?</h2>
                {mineOf(currentSession).flag ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-base">Sent to your educator: <b>{{ misheard: "It misheard me", feedback: "The feedback seems wrong", technical: "Technical problem", other: "Something else" }[mineOf(currentSession).flag.reason]}</b>
                      {mineOf(currentSession).flag.text ? <span className={muted}> · {mineOf(currentSession).flag.text}</span> : null}</p>
                    <div><Button variant="secondary" size="sm" onClick={() => saveMine(currentSession, { flag: null })}>Withdraw</Button></div>
                  </div>
                ) : !flagOpen ? (
                  <div className="flex flex-col items-start gap-2">
                    <p className={cn("text-base", muted)}>If it misheard you or the score looks wrong, tell your educator. It does not change your score by itself.</p>
                    <Button variant="secondary" size="sm" onClick={() => setFlagOpen(true)}><Flag /> Report a problem</Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {[["misheard", "It misheard me"], ["feedback", "Feedback seems wrong"], ["technical", "Technical problem"], ["other", "Other"]].map(([k, l]) => (
                        <button key={k} type="button" aria-pressed={flagReason === k} onClick={() => setFlagReason(k)}
                          className={cn("h-9 rounded-full px-3 text-sm font-medium", flagReason === k ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "bg-[rgb(var(--vx-cell))]")}>{l}</button>
                      ))}
                    </div>
                    <input value={flagText} onChange={(e) => setFlagText(e.target.value)} maxLength={1000}
                      placeholder={flagReason === "misheard" ? 'e.g. I said "night pain", it heard "knee pain"' : "What happened? (optional)"}
                      className="h-10 rounded-xl border-0 bg-[rgb(var(--vx-cell)/0.6)] px-3 text-base outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => { if (await saveMine(currentSession, { flag: { reason: flagReason, text: flagText } })) { setFlagOpen(false); toast.success("Sent to your educator."); } }}>Send to my educator</Button>
                      <Button variant="secondary" size="sm" onClick={() => setFlagOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <section className={card}>
              <h2 className="mb-3 text-xl font-semibold">Conversation</h2>
              {turns.length === 0 ? <p className={cn("text-base", muted)}>No transcript for this attempt.</p> : (
                <>
                  <ol className="flex flex-col gap-2">
                    {(showAllTurns ? turns : turns.slice(0, 12)).map((m, i) => {
                      const me = m.role === "user";
                      return (
                        <li key={i} className={cn("flex", me ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-[80%] rounded-2xl px-4 py-2", me ? "rounded-br-md bg-[rgb(var(--vx-accent)/0.15)]" : "rounded-bl-md bg-[rgb(var(--vx-cell))]")}>
                            <div className={cn("text-xs font-semibold", muted)}>{me ? "You" : m.speaker?.trim() || "Patient"}</div>
                            <div className="text-base leading-relaxed">{m.content}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {turns.length > 12 && (
                    <div className="mt-3 flex justify-center">
                      <Button variant="secondary" size="sm" onClick={() => setShowAllTurns((v) => !v)}>
                        {showAllTurns ? "Show less" : `Show all ${turns.length} messages`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    {reportOpen && currentSession?._id && (
        <React.Suspense fallback={null}>
          <PdfViewer url={`/api/sessions/${currentSession._id}/report.pdf`} title="History Taking Feedback Report"
            subtitle={`${scenarioData?.name || "Scenario"} · attempt ${activeAttempt}`}
            filename={`feedback-report-attempt-${activeAttempt}.pdf`} onClose={() => setReportOpen(false)} />
        </React.Suspense>
      )}
    </div>
  );
}

export default StudentScenarioDetails;
