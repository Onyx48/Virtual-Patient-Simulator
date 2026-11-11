// How one scenario went (the "View" of a published scenario): reach, scores and their trend, which
// parts of the history students cover and miss, Clinical Reasoning, self-reflection calibration,
// student reports, and who did what. GET /api/dashboard/scenario-analytics + scenario-students.
import React, { useState } from "react";
import { ArrowLeft, Users, Target, TrendingUp, Repeat, Pencil, MessageSquareText, AlertTriangle, Gauge } from "lucide-react";
import { useParams, useNavigate } from "../../../lib/router";
import { useData } from "../../../lib/query";
import { cn } from "../../../lib/utils";
import { Button, ButtonGroup } from "@/components/vx/ui";
import { Ago } from "@/components/vx/bits";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Kpi, Panel } from "../Dashboard";
import { ScenarioStudents } from "@/components/shared/ScenarioInsights";
import TranscriptViewerModal from "@/components/ui/TranscriptViewerModal";
import "@/components/vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";
const Skeleton = ({ className }) => <div className={cn("animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]", className)} />;
const tone = (v, target = 75) => (v == null ? "bg-[rgb(var(--vx-line))]" : v >= target ? "bg-[rgb(var(--vx-ok))]" : v >= 50 ? "bg-[rgb(var(--vx-accent))]" : "bg-[rgb(var(--vx-warn))]");
const LEVEL = ["", "Needs development", "Developing", "Proficient", "Highly proficient"];
const FLAG = { misheard: "It misheard me", feedback: "Feedback seems wrong", technical: "Technical problem" };
const BAND_COLORS = ["rgb(var(--vx-c8))", "rgb(var(--vx-c4))", "rgb(var(--vx-c2))", "rgb(var(--vx-c1))", "rgb(var(--vx-c3))"];
const Nothing = ({ children }) => <p className={cn("py-12 text-center text-base", muted)}>{children}</p>;

/** One horizontal bar with its label and value (out of 100). */
function Meter({ label, value, sub, target }) {
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-4 text-base">
        <span className="min-w-0">{label}{sub && <span className={cn("ml-2 text-sm", muted)}>{sub}</span>}</span>
        <b className="shrink-0 tabular-nums">{value ?? "—"}<span className={cn("text-sm font-normal", muted)}> / 100</span></b>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--vx-cell))]"><div className={cn("h-full rounded-full", tone(value, target))} style={{ width: `${Math.max(2, value || 0)}%` }} /></div>
    </li>
  );
}

export default function ScenarioAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const a = useData("/api/dashboard/scenario-analytics", { params: { scenarioId: id }, fallback: {} });
  const [open, setOpen] = useState(null);
  const [qShow, setQShow] = useState(8);

  if (a === null) {
    return (
      <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
        <Skeleton className="h-12 w-1/2" />
        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        <Skeleton className="mt-5 h-72" />
      </div>
    );
  }
  if (!a.scenario) return <div className="vx min-h-full p-10 text-center text-lg">This scenario could not be loaded.</div>;
  const t = a.totals;
  const weeks = a.weeks.map((w) => ({ ...w, label: new Date(w.start).toLocaleDateString(undefined, { day: "numeric", month: "short" }) }));

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className={cn("text-sm font-medium", muted)}>{a.scenario.status} · {a.scenario.difficulty || "Medium"}{a.scenario.patient ? ` · patient ${a.scenario.patient}` : ""}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{a.scenario.name}</h1>
            {a.scenario.description && <p className={cn("mt-1 max-w-4xl text-base", muted)}>{a.scenario.description}</p>}
          </div>
          <ButtonGroup>
            <Button variant="secondary" onClick={() => navigate("/scenarios")}><ArrowLeft /> Scenarios</Button>
            <Button variant="secondary" onClick={() => navigate(`/scenarios/edit/${id}`)}><Pencil /> {a.scenario.status === "Published" ? "Open the case" : "Edit"}</Button>
          </ButtonGroup>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi icon={Users} label="Students tried it" value={t.students} hint={t.assigned ? `of ${t.assigned} assigned · ${t.notStarted} not started` : "nobody assigned"} />
          <Kpi icon={MessageSquareText} label="Attempts" value={t.attempts} hint={`${t.attemptsPerStudent ?? "—"} per student${t.unfinished ? ` · ${t.unfinished} unfinished` : ""}`} />
          <Kpi icon={Gauge} label="Average score" value={t.avg ?? "—"} hint={t.median != null ? `median ${t.median} / 100` : "no scores yet"} />
          <Kpi icon={Target} label="At target now" value={t.students ? t.atTarget : "—"} hint={`latest score ${a.target}+ · of ${t.students}`} />
          <Kpi icon={TrendingUp} label="First → latest" value={t.firstAvg != null ? `${t.firstAvg} → ${t.latestAvg}` : "—"} hint="average per student" />
          <Kpi icon={Repeat} label="Gain on a retry" value={t.repeatGain != null ? `${t.repeatGain > 0 ? "+" : ""}${t.repeatGain}` : "—"} hint={`${t.repeaters} student${t.repeaters === 1 ? "" : "s"} retried`} />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title="Attempts per week" className="xl:col-span-2">
            {t.attempts === 0 ? <Nothing>Nobody has tried it yet.</Nothing> : (
              <div className="vx-chart">
                <BarChart data={weeks} xDataKey="label" aspectRatio="auto" className="h-[240px]" margin={{ top: 12, right: 8, bottom: 32, left: 8 }} maxBarWidth={40}>
                  <Grid horizontal vertical={false} />
                  <Bar dataKey="attempts" fill="rgb(var(--vx-c1))" />
                  <BarXAxis />
                  <ChartTooltip rows={(p) => [{ color: "rgb(var(--vx-c1))", label: "Attempts", value: p.attempts }, { color: "rgb(var(--vx-c3))", label: "Average score", value: p.avg == null ? "—" : `${p.avg} / 100` }]} />
                </BarChart>
              </div>
            )}
          </Panel>
          <Panel title="How scores spread">
            {t.scored === 0 ? <Nothing>No scores yet.</Nothing> : (
              <div className="vx-chart">
                <BarChart data={a.bands} xDataKey="band" aspectRatio="auto" className="h-[240px]" margin={{ top: 12, right: 8, bottom: 32, left: 8 }} maxBarWidth={48}>
                  <Grid horizontal vertical={false} />
                  <Bar dataKey="attempts" fill={(d, i) => BAND_COLORS[i] || BAND_COLORS[3]} />
                  <BarXAxis showAllLabels />
                  <ChartTooltip rows={(p) => [{ color: "rgb(var(--vx-c1))", label: `Scored ${p.band}`, value: `${p.attempts} attempts` }]} />
                </BarChart>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Panel title="History taking, by part">
            {!a.criteria.length ? <Nothing>No graded attempts yet.</Nothing> : (
              <>
                <p className={cn("-mt-1 mb-3 text-sm", muted)}>How much of each part students covered, across all attempts. Weakest first.</p>
                <ul className="flex flex-col gap-3">{a.criteria.map((c) => <Meter key={c.criterion} label={c.criterion} value={c.pct} target={a.target} />)}</ul>
              </>
            )}
          </Panel>
          <Panel title="Questions most often missed">
            {!a.questions.length ? <Nothing>No graded attempts yet.</Nothing> : (
              <>
                <ul className="flex flex-col gap-3">{a.questions.slice(0, qShow).map((q) => <Meter key={q.number} label={q.question || `Question ${q.number}`} sub={q.criterion} value={q.metPct} target={a.target} />)}</ul>
                {a.questions.length > qShow && <Button variant="secondary" size="sm" className="mt-3 self-start" onClick={() => setQShow(a.questions.length)}>Show all {a.questions.length}</Button>}
              </>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title="Clinical reasoning">
            {!a.reasoning.attempts ? <Nothing>No Clinical Reasoning yet.</Nothing> : (
              <>
                <p className="-mt-1 mb-3 text-base">Average <b className="tabular-nums">{a.reasoning.avg} / 100</b> over {a.reasoning.attempts} conversations{a.reasoning.missedRedFlag ? <> · <span className="text-[rgb(var(--vx-danger))]">{a.reasoning.missedRedFlag} missed a red flag</span></> : null}</p>
                <ul className="flex flex-col gap-3">
                  {a.reasoning.criteria.map((c) => (
                    <li key={c.n}>
                      <div className="mb-1 flex justify-between gap-3 text-base"><span>{c.name}</span><span className={cn("shrink-0 text-sm", muted)}>{LEVEL[Math.round(c.avg)]}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--vx-cell))]"><div className={cn("h-full rounded-full", tone((c.avg / 4) * 100))} style={{ width: `${(c.avg / 4) * 100}%` }} /></div>
                      <p className={cn("mt-0.5 text-sm", muted)}>{c.independentPct}% reached it on their own</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
          <Panel title="Self-reflection">
            {!a.reflection.n ? <Nothing>No reflections yet.</Nothing> : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-2xl">
                  <div className="bg-[rgb(var(--vx-cell)/0.6)] p-4"><p className={cn("text-sm", muted)}>They rated themselves</p><p className="text-3xl font-semibold tabular-nums">{a.reflection.selfAvg}</p></div>
                  <div className="bg-[rgb(var(--vx-cell)/0.6)] p-4"><p className={cn("text-sm", muted)}>They scored</p><p className="text-3xl font-semibold tabular-nums">{a.reflection.scoreAvg}</p></div>
                </div>
                <ul className="flex flex-col gap-1 text-base">
                  <li><b className="tabular-nums">{a.reflection.over}</b> felt it went better than it did</li>
                  <li><b className="tabular-nums">{a.reflection.under}</b> did better than they thought</li>
                  <li><b className="tabular-nums">{a.reflection.n - a.reflection.over - a.reflection.under}</b> judged it about right</li>
                  {a.reflection.distress > 0 && <li className="text-[rgb(var(--vx-danger))]"><b className="tabular-nums">{a.reflection.distress}</b> showed distress</li>}
                </ul>
              </div>
            )}
          </Panel>
          <Panel title="Reported by students">
            {!Object.keys(a.flags).length ? <Nothing>Nothing reported.{t.avgTurns ? ` Conversations average ${t.avgTurns} turns.` : ""}</Nothing> : (
              <ul className="flex flex-col gap-0.5 overflow-hidden rounded-2xl">
                {Object.entries(a.flags).map(([k, n]) => (
                  <li key={k} className="flex items-center gap-3 bg-[rgb(var(--vx-cell)/0.6)] px-4 py-3">
                    <AlertTriangle size={18} className="text-[rgb(var(--vx-warn))]" /><span className="flex-1 text-base">{FLAG[k] || k}</span><b className="tabular-nums">{n}</b>
                  </li>
                ))}
                {t.avgTurns ? <li className={cn("bg-[rgb(var(--vx-cell)/0.6)] px-4 py-3 text-sm", muted)}>Conversations average {t.avgTurns} turns.</li> : null}
              </ul>
            )}
          </Panel>
        </div>

        <ScenarioStudents scenarioId={id} onOpen={(r) => setOpen({ studentId: r.studentId, studentName: r.name, sessionId: r.lastSessionId })} />
        {t.lastAt && <p className={cn("text-sm", muted)}>Last attempt <Ago date={t.lastAt} />.</p>}
      </div>
      {open && <TranscriptViewerModal isOpen onClose={() => setOpen(null)} student={{ id: open.studentId, name: open.studentName }} initialSessionId={open.sessionId} />}
    </div>
  );
}
