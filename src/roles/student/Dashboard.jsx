// Student dashboard in the vx design, with bklit charts. Same endpoints as before:
// /api/dashboard/student-stats and /api/scenarios (filtered to this student).
import React, { useEffect, useMemo, useState } from "react";
import { useApi, useData } from "../../lib/query";
import axios from "axios";
import { Play, CheckCircle2, ListTodo, Gauge, ChevronRight, Lock, Sparkles, CalendarDays } from "lucide-react";
import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { Ago, Intro, Info } from "@/components/vx/bits";
import { TrendingUp } from "lucide-react";
import { toast } from "react-hot-toast";
import { Users as UsersIcon } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { useNavigate } from "../../lib/router";
import { getAuthHeaders, toScorePercent, cn } from "../../lib/utils.js";
import { isAssignedToStudent } from "../../lib/assignment.js";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import { Button } from "@/components/vx/ui";
import { canRun, difficultyLabel, NOT_RUNNABLE } from "./scenarios/ScenrioGridStudent";
import { requestStart } from "@/components/shared/MicCheck";
import "@/components/vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";
const card = "rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]";

function Panel({ title, action, className, children }) {
  return (
    <section className={cn(card, "flex min-w-0 flex-col p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
const Skeleton = ({ className }) => <div className={cn("animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]", className)} />;

/** Join a class with the code the educator shows (POST /api/groups/join). */
function JoinClass() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await axios.post("/api/groups/join", { code }, getAuthHeaders());
      toast.success(data.already ? `You are already in ${data.group.name}.` : `You joined ${data.group.name}.`);
      setCode("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not join with that code.");
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={join} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] px-5 py-4">
      <UsersIcon size={20} className={muted} />
      <span className="text-base font-semibold">Join a class</span>
      {/* Joined field + button, like the app's InputGroup */}
      <span className="flex gap-0.5">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="ABC123" aria-label="Class code" autoComplete="off"
          className="h-11 w-40 rounded-l-full rounded-r-[8px] border-0 bg-[rgb(var(--vx-cell))] px-4 text-center font-mono text-lg tracking-[0.2em] outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
        <Button type="submit" disabled={busy || code.length !== 6} className="h-11 rounded-l-[8px] rounded-r-full">Join</Button>
      </span>
      <span className={cn("text-sm", muted)}>Use the code your educator shows in class.</span>
    </form>
  );
}

/*
 * Current learning focus (idea from the VPS v10 prototype): the one criterion with most room to grow,
 * its trend over repeat attempts at one scenario, strengths and priorities, and what to practise next.
 * Criterion names and percentages only (GET /api/sessions/mine/focus).
 */
function FocusCard({ focus, next, onPractise }) {
  if (!focus?.focus) return null;
  const f = focus.focus;
  const pts = focus.trend?.points || [];
  const target = focus.target ?? 75;
  const bar = (v) => (v >= target ? "bg-[rgb(var(--vx-ok))]" : v >= 50 ? "bg-[rgb(var(--vx-accent))]" : "bg-[rgb(var(--vx-warn))]");
  return (
    <section className="grid w-full grid-cols-1 overflow-hidden rounded-2xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <p className="flex flex-1 items-center gap-2 text-sm font-semibold text-[rgb(var(--vx-muted))]">
            <span className="size-2 rounded-full bg-[rgb(var(--vx-accent))]" /> Current learning focus
          </p>
          <Info title="Current focus">The part of the history with most room to grow, from your latest attempt at each scenario: the share of its feedback questions you met (partly counts half). {target} out of 100 or more is a strength.</Info>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-3xl font-semibold tracking-tight">{f.criterion}</h2>
            <p className="mt-1 text-base text-[rgb(var(--vx-muted))]">This is where another go helps most.</p>
          </div>
          <p className="text-4xl font-semibold tabular-nums">{f.pct}<span className="text-lg font-normal text-[rgb(var(--vx-muted))]"> / 100</span></p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--vx-cell))]"><div className={`h-full rounded-full ${bar(f.pct)}`} style={{ width: `${Math.max(2, f.pct)}%` }} /></div>
        {pts.length > 1 && (
          <p className="flex flex-wrap items-center gap-2 text-base">
            <span className="text-[rgb(var(--vx-muted))]">Your attempts at {focus.trend.scenarioName || "one scenario"}:</span>
            {pts.map((p, i) => <React.Fragment key={i}>{i > 0 && <span className="text-[rgb(var(--vx-muted))]">→</span>}<span className="font-semibold tabular-nums">{p.pct}</span></React.Fragment>)}
          </p>
        )}
        {next && (
          <div className="mt-auto flex flex-wrap items-center gap-4 rounded-2xl bg-[rgb(var(--vx-cell))] px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[rgb(var(--vx-muted))]">Recommended next</p>
              <p className="truncate text-lg font-semibold">{next.name}</p>
              <p className="text-sm text-[rgb(var(--vx-muted))]">{next.why}</p>
            </div>
            <button type="button" onClick={onPractise} className="h-11 rounded-full bg-[rgb(var(--vx-accent))] px-6 text-base font-semibold text-[rgb(var(--vx-on-accent))] transition-[border-radius] active:rounded-[8px]">Practise</button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-6 border-t border-[rgb(var(--vx-line))] p-6 lg:border-l lg:border-t-0">
        {[["Strengths", focus.strengths], ["Priorities", focus.priorities]].map(([title, list]) => (
          <div key={title}>
            <p className="mb-3 text-base font-semibold">{title}</p>
            {list?.length ? (
              <ul className="flex flex-col gap-3">
                {list.map((x) => (
                  <li key={x.criterion}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-base">
                      <span className="min-w-0 truncate">{x.criterion}</span><span className="shrink-0 tabular-nums text-[rgb(var(--vx-muted))]">{x.pct} / 100</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--vx-cell))]"><div className={`h-full rounded-full ${bar(x.pct)}`} style={{ width: `${Math.max(2, x.pct)}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-base text-[rgb(var(--vx-muted))]">{title === "Strengths" ? `None at ${target} yet. Keep going.` : "Nothing under target."}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Cached reads (TanStack Query): coming back to the dashboard shows it at once.
  const statsQ = useApi("/api/dashboard/student-stats", { enabled: !!user });
  const scenQ = useApi("/api/scenarios", { params: { fields: "lite", page: 1, limit: 12 }, enabled: !!user }); // only what the cards show
  const stats = statsQ.isError ? { completedCount: 0, availableCount: 0, averageScore: null, scenarioScores: [], totalAssigned: 0 } : (statsQ.data ?? null);
  const list = useMemo(() => {
    const all = Array.isArray(scenQ.data) ? scenQ.data : scenQ.data?.items || [];
    return all.filter((x) => isAssignedToStudent(x, user)).map((x) => {
      const row = stats?.scenarioScores?.find((r) => r.scenarioId === x._id);
      return {
        id: x._id, name: x.scenarioName, difficulty: x.difficulty, testable: x.testable === true,
        best: row?.bestScore != null ? toScorePercent(row.bestScore) : null, done: !!row?.isCompleted,
      };
    });
  }, [scenQ.data, stats, user]);
  const mine = useData("/api/sessions/mine", { enabled: !!user, fallback: [] }); // own attempts, newest first
  const focus = useData("/api/sessions/mine/focus", { enabled: !!user });
  const ready = useData("/api/sessions/mine/readiness", { enabled: !!user, fallback: { scenarios: 0, areas: [] } }); // { scenarios, areas: [{ criterion, met, questions }] }

  // "Dr. Ana Tan" → "Ana".
  const first = String(user?.name || "").split(/\s+/).find((w) => w && !/^(dr|prof|mr|mrs|ms|miss|mx)\.?$/i.test(w)) || "";
  const next = useMemo(() => list.find((x) => !x.done && canRun(x)) || list.find((x) => !x.done) || null, [list]);
  // Each scenario keeps one colour (its place in the assigned list), whatever the sort.
  // From the stats read (every scenario tried, with its best score), not from the scenario list.
  const triedAll = useMemo(() => (stats?.scenarioScores || []).filter((r) => r.bestScore != null)
    .map((r) => ({ id: r.scenarioId, name: r.scenarioName, best: toScorePercent(r.bestScore) })), [stats]);
  const hueOf = (id) => `rgb(var(--vx-c${(Math.max(0, triedAll.findIndex((x) => x.id === id)) % 8) + 1}))`;
  const scored = useMemo(() => [...triedAll].sort((a, b) => a.best - b.best).slice(0, 8), [triedAll]);
  const total = stats?.totalAssigned || list.length;
  const done = stats?.completedCount ?? list.filter((x) => x.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Own attempts: this week, the trend, and each attempt's change on the previous try of the same case.
  const attempts = useMemo(() => (mine || []).filter((x) => x.score > 0).map((x) => ({ ...x, pct: toScorePercent(x.score), t: new Date(x.createdAt) })), [mine]);
  const quietDays = mine?.length ? Math.floor((Date.now() - new Date(mine[0].createdAt).getTime()) / 86400000) : 0;
  const week = (mine || []).filter((x) => Date.now() - new Date(x.createdAt).getTime() < 7 * 86400000).length;
  const trend = useMemo(() => [...attempts].sort((a, b) => a.t - b.t).map((x) => ({ t: x.t, score: x.pct, name: x.scenarioName })), [attempts]);
  // Progress: first -> latest scored attempt, in points (same rule as the educator view). attempts is newest first.
  const gain = attempts.length >= 2 ? attempts[0].pct - attempts[attempts.length - 1].pct : null;
  // Recommended next: a scenario not tried yet, else the one where the focus was weakest.
  const recommended = useMemo(() => {
    if (!focus?.focus) return null;
    const fresh = list.find((x) => x.best == null && canRun(x));
    if (fresh) return { ...fresh, why: "Not tried yet: a new case is the best test of what you learned." };
    const ws = focus.weakestScenario;
    const w = ws && (list.find((x) => x.id === ws.scenarioId) || triedAll.find((x) => x.id === ws.scenarioId));
    if (w) return { ...w, why: `Your ${focus.focus.criterion.toLowerCase()} was ${focus.weakestScenario.pct}/100 here last time.` };
    return null;
  }, [focus, list]);
  const recent = useMemo(() => attempts.slice(0, 6).map((x) => {
    const prev = attempts.find((y) => y.scenarioId === x.scenarioId && y.t < x.t);
    return { ...x, change: prev ? x.pct - prev.pct : null };
  }), [attempts]);

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">{first ? `Welcome back, ${first}` : "Dashboard"}</h1>

        {/* Up next: the one thing to do now. */}
        {!stats ? <Skeleton className="h-36" /> : next ? (
          <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-[rgb(var(--vx-accent)/0.45)] bg-[rgb(var(--vx-accent)/0.08)] p-6">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]"><Sparkles size={22} /></span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", muted)}>Up next · {difficultyLabel(next.difficulty)}</p>
              <h2 className="truncate text-2xl font-semibold">{next.name}</h2>
              <p className={cn("text-sm", muted)}>
                {quietDays >= 7 ? `It has been ${quietDays} days since your last session. One short one keeps it fresh. ` : ""}
                About 15 minutes. You can practise as many times as you like; only you and your educator see the results.
              </p>
            </div>
            <Button size="lg" disabled={!canRun(next)} title={canRun(next) ? undefined : NOT_RUNNABLE} onClick={() => requestStart(next.id)}>
              {canRun(next) ? <Play /> : <Lock />} {canRun(next) ? "Start" : "Not open yet"}
            </Button>
          </section>
        ) : total > 0 ? (
          <section className="flex items-center gap-4 rounded-2xl bg-[rgb(var(--vx-ok)/0.08)] p-6">
            <CheckCircle2 size={28} className="text-[rgb(var(--vx-ok))]" />
            <div><h2 className="text-xl font-semibold">All scenarios done</h2><p className={cn("text-sm", muted)}>Go again on your lowest score to push it up.</p></div>
          </section>
        ) : (
          <section className={cn(card, "p-6")}>
            <h2 className="text-xl font-semibold">No scenarios yet</h2>
            <p className={cn("text-base", muted)}>Your educator assigns them. They will show up here.</p>
          </section>
        )}

        <FocusCard focus={focus} next={recommended}
          onPractise={() => recommended && (canRun(recommended) ? requestStart(recommended.id) : navigate(`/student/scenario/${recommended.id}`))} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [ListTodo, "To do", stats ? total - done : "…", `of ${total} assigned`],
            [CheckCircle2, "Done", stats ? done : "…", total ? `${pct}% of your scenarios` : "Nothing assigned yet"],
            [Gauge, "Average", stats?.averageScore != null ? `${stats.averageScore}%` : "—", stats?.averageScore != null ? "across your best scores" : "No scores yet",
              "The average of your best score at each scenario you have tried."],
            [TrendingUp, "Progress", gain == null ? "—" : `${gain > 0 ? "+" : ""}${gain} pts`,
              gain == null ? "after your second attempt" : <>first → latest · {week} this week</>,
              "Your latest score minus your first score, in percentage points. 64% to 80% is +16 pts."],
          ].map(([Icon, label, value, hint, info], i) => (
            <div key={label} className={cn(card, "flex flex-col gap-2 p-5")}>
              <span className={cn("flex items-center gap-2.5 text-sm font-medium", muted)}><span className={cn("grid size-9 place-items-center rounded-xl", `vx-tint-${[1, 3, 7, 2][i]}`)}><Icon size={18} /></span> <span className="flex-1">{label}</span>{info && <Info title={label}>{info}</Info>}</span>
              <span className="text-3xl font-semibold leading-none tabular-nums">{value}</span>
              <span className={cn("text-sm", muted)}>{hint}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title="Progress">
            {!stats ? <Skeleton className="h-60" /> : total === 0 ? <p className={cn("py-10 text-center text-base", muted)}>Nothing assigned yet.</p> : (
              <div className="vx-chart flex flex-1 flex-col items-center justify-center gap-3">
                <PieChart size={210} innerRadius={74} cornerRadius={6} padAngle={done && total - done ? 0.02 : 0}
                  data={[{ label: "Done", value: done, color: "rgb(var(--vx-c3))" }, ...(total - done > 0 ? [{ label: "To do", value: total - done, color: "rgb(var(--vx-c1))" }] : [])]}>
                  <PieSlice index={0} showGlow={false} hoverOffset={4} />
                  {total - done > 0 && <PieSlice index={1} showGlow={false} hoverOffset={4} />}
                  <PieCenter defaultLabel="done" />
                </PieChart>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[rgb(var(--vx-c3))]" /> Done {done}</span>
                  {total - done > 0 && <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[rgb(var(--vx-c1))]" /> To do {total - done}</span>}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Best score per scenario" className="xl:col-span-2"
            action={<Button variant="secondary" size="sm" onClick={() => navigate("/scenarios")}>All scenarios <ChevronRight /></Button>}>
            {!stats ? <Skeleton className="h-60" /> : scored.length === 0 ? (
              <p className={cn("py-10 text-center text-base", muted)}>Your scores show here after your first session.</p>
            ) : (
              <>
                <div className="vx-chart">
                  <BarChart data={scored} xDataKey="name" orientation="horizontal" aspectRatio="auto" valueMax={100}
                    className="h-[260px]" margin={{ top: 4, right: 16, bottom: 4, left: 200 }} maxBarWidth={22} animationDuration={700}>
                    <Bar dataKey="best" fill={(d) => hueOf(d.id)} />
                    <BarYAxis labelMaxWidth={190} />
                    <ChartTooltip rows={(p) => [{ color: hueOf(p.id), label: p.name, value: `${p.best} / 100` }]} />
                  </BarChart>
                </div>
                <p className={cn("text-sm", muted)}>Lowest first: that is where another go helps most.</p>
              </>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title="Scores over time" className="xl:col-span-2">
            {mine === null ? <Skeleton className="h-56" /> : trend.length < 2 ? (
              <p className={cn("py-10 text-center text-base", muted)}>{trend.length ? "One scored attempt so far. The trend shows after the next one." : "Your trend shows here after a couple of attempts."}</p>
            ) : (
              <div className="vx-chart">
                <LineChart data={trend} xDataKey="t" aspectRatio="auto" className="h-[220px] w-full" margin={{ left: 52, right: 20, top: 12, bottom: 32 }} yScaleDomainMax={100}>
                  <Grid />
                  <XAxis />
                  <YAxis numTicks={5} formatValue={(v) => (Math.round(v) === 0 ? "" : `${Math.round(v)}%`)} />
                  <Line dataKey="score" stroke="var(--chart-1)" fadeEdges={false} showMarkers />
                  <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: p.name, value: `${p.score}%` }]} />
                </LineChart>
              </div>
            )}
          </Panel>
          <Panel title="Recent attempts">
            {mine === null ? <Skeleton className="h-56" /> : recent.length === 0 ? <p className={cn("py-10 text-center text-base", muted)}>No attempts yet.</p> : (
              <ul className="-mx-2 flex flex-col">
                {recent.map((x) => (
                  <li key={x._id}>
                    <button type="button" onClick={() => navigate(`/student/scenario/${x.scenarioId}`)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[rgb(var(--vx-cell)/0.6)]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium">{x.scenarioName}</span>
                        <span className={cn("text-sm", muted)}><Ago date={x.createdAt} /></span>
                        {x.reflection && <span className={cn("mt-0.5 line-clamp-2 block text-sm italic", muted)}>“{x.reflection}”</span>}
                      </span>
                      {x.change != null && x.change !== 0 && (
                        <span className={cn("rounded-full px-2 py-0.5 text-sm font-medium tabular-nums", x.change > 0 ? "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]" : "bg-[rgb(var(--vx-cell))]")}>
                          {x.change > 0 ? `+${x.change}` : x.change}
                        </span>
                      )}
                      <span className="w-12 text-right text-base font-semibold tabular-nums">{x.pct}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {ready?.areas?.length > 0 && (
          <Panel title="Readiness by area">
            <p className={cn("-mt-1 mb-2 text-sm", muted)}>
              From your latest attempt at each of {ready.scenarios} scenario{ready.scenarios === 1 ? "" : "s"}: how much of each part of the history you covered. Weakest first.
            </p>
            <div className="vx-chart" style={{ height: Math.max(120, ready.areas.length * 40) }}>
              <BarChart data={ready.areas} xDataKey="criterion" orientation="horizontal" aspectRatio="auto" valueMax={100}
                className="h-full w-full" margin={{ top: 4, right: 16, bottom: 4, left: 170 }} maxBarWidth={20} animationDuration={700}>
                <Bar dataKey="met" fill="var(--chart-1)" />
                <BarYAxis labelMaxWidth={160} />
                <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: p.criterion, value: `${p.met}% covered` }]} />
              </BarChart>
            </div>
          </Panel>
        )}

        <JoinClass />
        <Intro id="student-dashboard" steps={[
          { title: "Up next", body: "The scenario to practise now. Each takes about 15 minutes; practise as often as you like." },
          { title: "Only you and your educator see results", body: "There are no class rankings. Use the scores to see what to try again." },
          { title: "If something goes wrong", body: "On a scenario's page you can tell your educator if it misheard you or the feedback looks wrong." },
        ]} />

        <Panel title="Your scenarios" action={<Button variant="secondary" size="sm" onClick={() => navigate("/scenarios")}>View all <ChevronRight /></Button>}>
          {!stats ? <Skeleton className="h-40" /> : list.length === 0 ? <p className={cn("py-6 text-center text-base", muted)}>No scenarios yet.</p> : (
            <ul className="-mx-5 divide-y divide-[rgb(var(--vx-line)/0.7)]">
              {list.slice(0, 6).map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => navigate(`/student/scenario/${x.id}`)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[rgb(var(--vx-accent)/0.05)]">
                    <span className="min-w-0 flex-1 truncate text-base font-medium">{x.name}</span>
                    <span className={cn("rounded-full px-3 py-0.5 text-sm font-medium", x.done ? "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]" : "bg-[rgb(var(--vx-accent)/0.15)]")}>{x.done ? "Done" : "To do"}</span>
                    <span className={cn("w-14 text-right text-base font-semibold tabular-nums", x.best == null && muted)}>{x.best == null ? "—" : `${x.best}%`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
