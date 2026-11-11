// Educator dashboard in the vx design, with bklit charts (src/components/charts, from
// ci/internal-shortlisting). Same endpoints as before.
import React, { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useData, apiGet, who } from "../../lib/query";
import { useNavigate } from "../../lib/router";
import axios from "axios";
import { ArrowDownRight, ArrowUpRight, BookOpen, Clock, Gauge, Users, ChevronRight, Bell, Copy, KeyRound, Moon, TrendingDown, FilePen, UserX, CheckCircle2 } from "lucide-react";
import { copyText, mailto, Ago, Select, Intro } from "@/components/vx/bits";
import ComposeEmail from "@/components/shared/ComposeEmail";
import { PenLine } from "lucide-react";
import { HeartPulse, Printer } from "lucide-react";
import TranscriptViewerModal from "@/components/ui/TranscriptViewerModal";
import { ToolbarToggle } from "@/components/vx/list";
import { useAuth } from "@/AuthContext.jsx";
import { getAuthHeaders, cn } from "../../lib/utils.js";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import { Button, ButtonGroup } from "@/components/vx/ui";
import "@/components/vx/vx.css";
import { useLearningOverview, LearningStats, LearningGaps, LearnersTable, CohortTable, CohortSwitch, Stat } from "./learning";

const muted = "text-[rgb(var(--vx-muted))]";
const card = "rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]";


// 0.9 -> "54m", 1.5 -> "1h 30m", 2 -> "2h".
const formatHours = (hours) => {
  const total = Math.round((hours || 0) * 60);
  const h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

function Delta({ value, unit = "%" }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-sm font-medium tabular-nums",
      up ? "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]" : "bg-[rgb(var(--vx-danger)/0.1)] text-[rgb(var(--vx-danger))]")}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {Math.abs(value)}{unit}
    </span>
  );
}

const TONES = [1, 3, 7, 2, 5, 4];
const toneOf = (label) => TONES[[...String(label)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
export function Kpi({ icon: Icon, label, value, delta, hint, onClick, tone }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={cn(card, "flex flex-col gap-2 p-5 text-left", onClick && "transition-colors hover:border-[rgb(var(--vx-accent)/0.6)]")}>
      <div className={cn("flex items-center gap-2.5", muted)}>
        <span className={cn("grid size-9 place-items-center rounded-xl", `vx-tint-${tone || toneOf(label)}`)}><Icon size={18} /></span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-semibold leading-none tabular-nums">{value}</span>
        {delta}
      </div>
      {hint && <span className={cn("text-sm", muted)}>{hint}</span>}
    </Tag>
  );
}

const DAY = 86400000;
const names = (rows, n = 3) => {
  const list = rows.slice(0, n).map((r) => r.name || r.scenarioName || "Untitled");
  return rows.length > n ? `${list.join(", ")} and ${rows.length - n} more` : list.join(", ");
};

/*
 * "Who needs me today" (mindsets/educator.md, M7). Built only from the roster and scenarios
 * already loaded, so it costs no extra request. Each row: what is wrong, who, one action.
 */
function NeedsYou({ students, summary, navigate, educator }) {
  // One email per reason (ci: grouped by stage), written in the app's compose.
  const [compose, setCompose] = useState(null);
  const write = (rows) => setCompose({ students: rows.map((r) => ({ id: r._id, name: r.name, email: r.email })) });
  const remind = (rows) => {
    window.location.href = mailto({
      bcc: rows.map((r) => r.email),
      subject: "Reminder: practise your virtual patient scenarios",
      body: "Hi everyone,\n\nA reminder to practise the scenarios assigned to you on the Virtual Patient Simulator. " +
        `Each session takes about 15 minutes.\n\nSign in here: ${window.location.origin}/login\n\nThanks,\n${educator || ""}`,
    });
  };
  const now = Date.now();
  const rows = [
    {
      key: "pending", icon: KeyRound, tone: "warn",
      items: students.filter((s) => s.inviteStatus === "pending"),
      title: (n) => `${n} never got their login details`,
      actions: (it) => [{ label: "Open students", onClick: () => navigate("/students") }, { label: "Copy emails", icon: Copy, onClick: () => copyText(it.map((r) => r.email).join(", "), "Emails copied") }],
    },
    {
      key: "notstarted", icon: UserX, tone: "warn",
      items: students.filter((s) => (s.assignedScenariosCount || 0) > 0 && !(s.totalSessions > 0)),
      title: (n) => `${n} assigned but not started`,
      actions: (it) => [{ label: "Write", icon: PenLine, onClick: () => write(it) }, { label: "See them", onClick: () => navigate("/students?progress=notstarted") }],
    },
    {
      key: "quiet", icon: Moon, tone: "muted",
      items: students.filter((s) => s.totalSessions > 0 && s.lastSessionAt && now - new Date(s.lastSessionAt).getTime() > 14 * DAY),
      title: (n) => `${n} quiet for over two weeks`,
      actions: (it) => [{ label: "Write", icon: PenLine, onClick: () => write(it) }, { label: "Mail app", icon: Bell, onClick: () => remind(it) }],
    },
    {
      key: "low", icon: TrendingDown, tone: "danger",
      items: students.filter((s) => s.totalSessions > 0 && s.avgScore != null && s.avgScore < 0.5),
      title: (n) => `${n} averaging under 50%`,
      actions: () => [{ label: "Read transcripts", onClick: () => navigate("/students?progress=active") }],
    },
    {
      key: "drafts", icon: FilePen, tone: "muted",
      items: summary?.drafts?.items || [], count: summary?.drafts?.count,
      title: (n) => `${n} scenario${n === 1 ? "" : "s"} still in draft`,
      actions: (it) => [{ label: it.length === 1 ? "Finish it" : "Open first", onClick: () => navigate(`/scenarios/edit/${it[0]._id}`) }],
    },
    {
      key: "unassigned", icon: BookOpen, tone: "muted",
      items: summary?.unassigned?.items || [], count: summary?.unassigned?.count,
      title: (n) => `${n} published but given to nobody`,
      actions: () => [{ label: "Assign", onClick: () => navigate("/students?assign=1") }],
    },
  ].filter((r) => r.items.length > 0);

  const tone = { warn: "text-[rgb(var(--vx-warn))] bg-[rgb(var(--vx-warn)/0.12)]", danger: "text-[rgb(var(--vx-danger))] bg-[rgb(var(--vx-danger)/0.1)]", muted: "text-[rgb(var(--vx-muted))] bg-[rgb(var(--vx-cell))]" };

  return (
    <Panel title="Needs you">
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-[rgb(var(--vx-ok)/0.08)] px-4 py-3 text-base">
          <CheckCircle2 size={20} className="text-[rgb(var(--vx-ok))]" /> Nothing waiting on you. Everyone has their login and is practising.
        </div>
      ) : (
        <ul className="-mx-5 divide-y divide-[rgb(var(--vx-line)/0.7)]">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", tone[r.tone])}><Icon size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{r.title(r.count ?? r.items.length)}</span>
                  <span className={cn("block truncate text-sm", muted)}>{names(r.items)}</span>
                </span>
                <ButtonGroup className="shrink-0">
                  {r.actions(r.items).map((a) => {
                    const AIcon = a.icon;
                    return <Button key={a.label} variant="secondary" size="sm" onClick={a.onClick}>{AIcon && <AIcon />} {a.label}</Button>;
                  })}
                </ButtonGroup>
              </li>
            );
          })}
        </ul>
      )}
      {compose && <ComposeEmail to={compose} fromName={educator} onClose={() => setCompose(null)} />}
    </Panel>
  );
}

export function Panel({ title, action, className, children }) {
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

const Empty = ({ children }) => <div className={cn("grid h-full min-h-[200px] place-items-center text-base", muted)}>{children}</div>;
const Skeleton = ({ className }) => <div className={cn("animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]", className)} />;

/*
 * What the cohort keeps missing (M6). Group-level only: no names, so it can go on a projector.
 * Rows link to the scenario so the educator can teach it or fix the case.
 */
export function CohortMisses({ navigate, filters }) {
  const rows = useData("/api/dashboard/question-misses", { params: { limit: 8, ...filters }, fallback: [] });
  return (
    <Panel title="Questions most missed">
      {rows === null ? <Skeleton className="h-40" /> : rows.length === 0 ? (
        <Empty>Once a few sessions are graded, the questions students most often skip show here.</Empty>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={`${r.scenarioId}-${r.number}`}>
              <button type="button" onClick={() => navigate(`/scenarios/edit/${r.scenarioId}`)}
                className="flex w-full flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[rgb(var(--vx-cell)/0.6)]">
                <span className="flex items-start justify-between gap-4">
                  <span className="min-w-0 text-base font-medium">{r.question || `Question ${r.number}`}</span>
                  <span className="shrink-0 text-base font-semibold tabular-nums">{r.missRate}%</span>
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--vx-cell))]">
                  <span className="block h-full rounded-full bg-[rgb(var(--vx-accent))]" style={{ width: `${r.missRate}%` }} />
                </span>
                <span className={cn("text-sm", muted)}>
                  {r.scenarioName}{r.criterion ? ` · ${r.criterion}` : ""} · missed in {r.no}{r.partly ? ` (+${r.partly} partly)` : ""} of {r.sessions} sessions
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Latest sessions; a row opens that exact transcript. */
export function RecentSessions({ filters, onOpen }) {
  const rows = useData("/api/dashboard/sessions-feed", { params: { limit: 8, ...filters }, fallback: [] });
  return (
    <Panel title="Recent sessions">
      {rows === null ? <Skeleton className="h-60" /> : rows.length === 0 ? <Empty>No sessions in this period.</Empty> : (
        <ul className="-mx-2 flex flex-col">
          {rows.map((r) => (
            <li key={r.sessionId}>
              <button type="button" onClick={() => onOpen(r)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[rgb(var(--vx-cell)/0.6)]">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[rgb(var(--vx-accent)/0.18)] text-sm font-semibold">
                  {String(r.studentName).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{r.studentName}</span>
                  <span className={cn("block truncate text-sm", muted)}>{r.scenarioName} · <Ago date={r.at} /></span>
                </span>
                {r.distress && <HeartPulse size={16} className="shrink-0 text-[rgb(var(--vx-danger))]" aria-label="Distress noted" />}
                <span className={cn("shrink-0 text-base font-semibold tabular-nums", r.score == null && muted)}>{r.score == null ? "—" : `${r.score}%`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** How scores spread, in 20-point bands: a mean hides a split class (M6). */
export function ScoreSpread({ filters, scenarios }) {
  const [scenarioId, setScenarioId] = useState("");
  const data = useData("/api/dashboard/score-spread", { params: { compact: 1, ...filters, ...(scenarioId && { scenarioId }) }, fallback: { overall: [], total: 0 } });
  const withSessions = scenarios.filter((x) => (x.totalSessions || 0) > 0);
  return (
    <Panel title="Score spread" action={withSessions.length > 1 && (
      <Select size="sm" label="Scenario" value={scenarioId} onChange={setScenarioId} align="right" className="max-w-[16rem]"
        options={[{ value: "", label: "All scenarios" }, ...withSessions.map((x) => ({ value: x._id, label: x.scenarioName, hint: x.totalSessions }))]} />
    )}>
      {!data ? <Skeleton className="h-[240px]" /> : data.total === 0 ? <Empty>No scored sessions in this period.</Empty> : (
        <>
          <div className="vx-chart">
            <BarChart data={data.overall} xDataKey="band" aspectRatio="auto" className="h-[220px]"
              margin={{ top: 12, right: 8, bottom: 32, left: 8 }} maxBarWidth={48} animationDuration={600}>
              <Grid horizontal vertical={false} />
              <Bar dataKey="sessions" fill="var(--chart-1)" />
              <BarXAxis showAllLabels />
              <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: `Scored ${p.band}%`, value: p.sessions ?? 0 }]} />
            </BarChart>
          </div>
          <p className={cn("text-sm", muted)}>{data.total} scored session{data.total === 1 ? "" : "s"}, grouped by score.</p>
        </>
      )}
    </Panel>
  );
}

const FLAG_REASON = { misheard: "It misheard me", feedback: "Feedback seems wrong", technical: "Technical problem", other: "Something else" };

/** Attempts a student reported as wrong (it misheard them, the feedback looks off). Opens the transcript. */
/**
 * A list that needs the educator's attention (distress, student reports, ...): a tinted header,
 * then people as tiles in a grid, five shown and "Show all" for the rest. One component, so every
 * alert on every dashboard looks and behaves the same.
 *   tone: "danger" | "warn"; items: [{ key, name, line, badge, onOpen }]
 */
const ALERT_TONE = {
  danger: { border: "border-[rgb(var(--vx-danger)/0.3)]", head: "bg-[rgb(var(--vx-danger)/0.06)] border-[rgb(var(--vx-danger)/0.2)]", chip: "bg-[rgb(var(--vx-danger)/0.12)] text-[rgb(var(--vx-danger))]", hover: "hover:bg-[rgb(var(--vx-danger)/0.05)]" },
  warn: { border: "border-[rgb(var(--vx-warn)/0.3)]", head: "bg-[rgb(var(--vx-warn)/0.07)] border-[rgb(var(--vx-warn)/0.2)]", chip: "bg-[rgb(var(--vx-warn)/0.14)] text-[rgb(var(--vx-warn))]", hover: "hover:bg-[rgb(var(--vx-warn)/0.05)]" },
};
export function AttentionList({ tone = "warn", icon: Icon, title, subtitle, items }) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const t = ALERT_TONE[tone];
  const shown = all ? items : items.slice(0, 6);
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-[rgb(var(--vx-card))]", t.border)}>
      <div className={cn("flex flex-wrap items-center gap-3 border-b px-5 py-3", t.head)}>
        <span className={cn("grid size-9 place-items-center rounded-xl", t.chip)}><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className={cn("text-sm", muted)}>{subtitle}</p>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-0.5 bg-[rgb(var(--vx-line)/0.5)] md:grid-cols-2 xl:grid-cols-3">
        {shown.map((r) => (
          <li key={r.key} className="bg-[rgb(var(--vx-card))]">
            <button type="button" onClick={r.onOpen} className={cn("flex w-full items-center gap-3 px-5 py-3 text-left transition-colors", t.hover)}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[rgb(var(--vx-cell))] text-sm font-semibold">{String(r.name).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-base font-semibold">{r.name}</span>{r.badge && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", t.chip)}>{r.badge}</span>}</span>
                <span className={cn("block truncate text-sm", muted)}>{r.line}</span>
              </span>
              <ChevronRight size={18} className={muted} />
            </button>
          </li>
        ))}
        {/* fill the last row so the grid has no hole */}
        {Array.from({ length: (3 - (shown.length % 3)) % 3 }).map((_, i) => <li key={`pad${i}`} className="hidden bg-[rgb(var(--vx-card))] xl:block" />)}
      </ul>
      {items.length > 6 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-[rgb(var(--vx-line)/0.7)] px-5 py-2.5 text-sm font-medium hover:bg-[rgb(var(--vx-cell)/0.5)]">
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}

export function StudentFlags({ onOpen }) {
  const rows = useData("/api/dashboard/student-flags", { fallback: [] }) || [];
  return (
    <AttentionList tone="warn" icon={Flag} title={`${rows.length} attempt${rows.length === 1 ? "" : "s"} reported by students`}
      subtitle="Read the conversation, then change a verdict in the transcript if the grade was unfair."
      items={rows.map((r) => ({ key: r.sessionId, name: r.studentName, badge: FLAG_REASON[r.reason], onOpen: () => onOpen(r),
        line: <><Ago date={r.at} /> · {r.text ? `"${r.text}" · ` : ""}{r.scenarioName}</> }))} />
  );
}

/*
 * Where educators disagree with the AI grader, per grading question (GET /api/dashboard/calibration).
 * High change rates show which rubric items the AI gets wrong, which is what earns (or loses) trust.
 */
export function Calibration() {
  const d = useData("/api/dashboard/calibration", { fallback: { totals: {}, questions: [] } });
  if (d && !d.questions.length) return null; // nothing reviewed yet: no empty panel
  return (
    <Panel title="Where you disagree with the AI">
      {!d ? <Skeleton className="h-32" /> : !d.questions.length ? (
        <Empty>When you change a grading verdict in a transcript, it is counted here. Nothing changed yet.</Empty>
      ) : (
        <>
          <p className="-mt-1 mb-3 text-base">
            You agreed with the AI on <b className="tabular-nums">{d.totals.agreement}%</b> of the {d.totals.reviewed} verdicts you reviewed.
          </p>
          <ul className="flex flex-col gap-1">
            {d.questions.map((q) => (
              <li key={`${q.scenarioId}-${q.number}`} className="rounded-xl px-3 py-2 hover:bg-[rgb(var(--vx-cell)/0.6)]">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-base font-medium">{q.question || `Question ${q.number}`}</span>
                  <span className="shrink-0 text-base font-semibold tabular-nums">{q.changed} of {q.reviewed}</span>
                </div>
                <span className={cn("text-sm", muted)}>
                  {q.scenarioName}{q.criterion ? ` · ${q.criterion}` : ""}
                  {q.harsh ? ` · AI too harsh ${q.harsh}×` : ""}{q.lenient ? ` · too lenient ${q.lenient}×` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/** Distress during self-reflection, last 30 days. Shown above everything when present. */
export function DistressAlert({ navigate }) {
  const rows = useData("/api/dashboard/distress", { fallback: [] }) || [];
  // One tile per student, newest first, with how many times.
  const people = [...rows.reduce((m, r) => (m.has(r.studentName) ? m : m.set(r.studentName, { ...r, times: rows.filter((x) => x.studentName === r.studentName).length })), new Map()).values()];
  return (
    <AttentionList tone="danger" icon={HeartPulse} title={`Check in with ${people.length} student${people.length === 1 ? "" : "s"}`}
      subtitle="Distress during self-reflection, last 30 days. Read the session before you talk to them."
      items={people.map((r) => ({ key: r.studentName, name: r.studentName, badge: r.times > 1 ? `${r.times}×` : null,
        onOpen: () => navigate(`/students?q=${encodeURIComponent(r.studentName)}`), line: <><Ago date={r.at} /> · {r.scenarioName}</> }))} />
  );
}

export default function EducatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Six reads in parallel, each cached by TanStack Query (coming back to the dashboard is instant).
  const qs = useQueries({ queries: [["/api/students"], ["/api/dashboard/scenario-summary"], ["/api/dashboard/monthly-activity"], ["/api/dashboard/teaching-effectiveness"], ["/api/dashboard/scenario-popularity", { limit: 10 }], ["/api/dashboard/educator-stats"]]
    .map(([url, params]) => ({ queryKey: [who(), url, params || null], queryFn: ({ signal }) => apiGet(url, params, signal) })) });
  const failed = qs.find((q) => q.isError);
  const error = failed ? (failed.error?.response?.data?.message || failed.error?.message) : null;
  const d = React.useMemo(() => {
    if (qs.some((q) => q.data === undefined)) return null;
    const [students, summary, activity, effectiveness, popularity, stats] = qs.map((q) => q.data);
    const list = (x) => (Array.isArray(x) ? x : x?.items || []);
    return { students: list(students), summary, activity: activity || [], effectiveness, popularity: popularity || [], stats: stats || {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, qs.map((q) => q.data));

  // "Dr. Marcus Lee" → "Marcus": skip a leading title.
  const first = String(user?.name || "").split(/\s+/).find((w) => w && !/^(dr|prof|mr|mrs|ms|miss|mx|sir|madam)\.?$/i.test(w)) || "";
  const groups = useData("/api/groups", { fallback: [] }) || [];
  const [groupId, setGroupId] = useState("");
  const [since, setSince] = useState("30");
  const filters = React.useMemo(() => ({ ...(groupId && { groupId }), ...(since !== "all" && { since }) }), [groupId, since]);
  const learning = useLearningOverview(groupId);
  const groupsById = React.useMemo(() => new Map(groups.map((g) => [g._id, g.name])), [groups]);
  const [transcript, setTranscript] = useState(null);

  if (error) {
    return (
      <div className="vx min-h-full px-4 pt-6 md:px-6">
        <p className="rounded-2xl bg-[rgb(var(--vx-danger)/0.1)] px-5 py-3 text-base text-[rgb(var(--vx-danger))]">Could not load the dashboard. {error}</p>
      </div>
    );
  }

  const s = d?.stats || {};
  const published = d?.summary?.published ?? 0;
  const rate = Math.min(100, Math.max(0, d?.effectiveness?.effectiveness || 0));
  const activity = d?.activity || [];
  const hasActivity = activity.some((a) => a.started > 0);
  const popular = (d?.popularity || []).filter((p) => p.sessionCount > 0).slice(0, 6);
  const recent = d?.summary?.recent || [];
  const sessionsTotal = (d?.students || []).reduce((n, st) => n + (st.totalSessions || 0), 0);

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{first ? `Welcome back, ${first}` : "Dashboard"}</h1>
          <Button variant="secondary" onClick={() => window.print()} className="print:hidden" title="Print or save as PDF for your programme lead">
            <Printer /> Print summary
          </Button>
        </header>

        <CohortSwitch groups={groups} value={groupId} onChange={setGroupId} totals={learning?.totals} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <LearningStats data={learning} onLearners={() => navigate("/students")} />
          {!d ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32" />) : (
            <>
              <Stat icon={Clock} label="Average time" value={sessionsTotal ? formatHours(s.avgTimeSpent) : "—"} hint={sessionsTotal ? "per student, across sessions" : "No sessions yet"}
                info="Total time in sessions divided by the number of your students who practised. All your students, whichever cohort is selected." />
              <Stat icon={BookOpen} label="Scenarios" value={d.summary?.total ?? 0} hint={`${published} published`} onClick={() => navigate("/scenarios")}
                info="Scenarios you created. Published ones can be assigned and appear on learners' dashboards; drafts cannot." />
            </>
          )}
        </div>

        <DistressAlert navigate={navigate} />
        <StudentFlags onOpen={(r) => setTranscript(r)} />
        <Intro id="educator-dashboard" steps={[
          { title: "Start with Needs you", body: "Students who never signed in, have not started, or have gone quiet, grouped by reason. Write to a whole group in one go." },
          { title: "What the cohort misses", body: "The grading questions students skip most. It names what to teach, never who is weak." },
          { title: "You stay the judge", body: "Open any transcript and change a verdict. Where you disagree with the AI is counted at the bottom of this page." },
          { title: "Classes and readiness", body: "Open a class from Students → Groups to show its join code. Readiness proposes who is ready for the CPE; you decide." },
        ]} />

        {d && <NeedsYou students={d.students} summary={d.summary} navigate={navigate} educator={user?.name} />}

        {!groupId && <CohortTable data={learning} onPick={setGroupId} current={groupId} />}
        <LearnersTable data={learning} groupsById={groupsById} onAll={() => navigate(groupId ? `/students?group=${groupId}` : "/students")}
          onOpen={(l) => navigate(`/students?q=${encodeURIComponent(l.email || l.name || "")}`)} />

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className={cn("mr-1 text-sm font-medium", muted)}>Showing</span>
            <div className="flex [&>div]:flex [&>div]:h-11 [&>div]:items-center [&>div]:rounded-full [&>div]:bg-[rgb(var(--vx-cell))]">
              <ToolbarToggle label="Period" value={since} onChange={setSince}
                options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "all", label: "All time" }]} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <LearningGaps data={learning} />
            <CohortMisses navigate={navigate} filters={filters} />
          </div>
          <RecentSessions filters={filters} onOpen={(r) => setTranscript(r)} />
          {d && <ScoreSpread filters={filters} scenarios={d.summary?.withSessions || []} />}
          <Calibration />
        </section>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title="Sessions per month" className="xl:col-span-2">
            {!d ? <Skeleton className="h-[280px]" /> : !hasActivity ? <Empty>No sessions yet.</Empty> : (
              <div className="vx-chart">
                <BarChart data={activity} xDataKey="name" aspectRatio="auto" className="h-[280px]"
                  margin={{ top: 16, right: 8, bottom: 32, left: 8 }} maxBarWidth={36} animationDuration={700}>
                  <Grid horizontal vertical={false} />
                  <Bar dataKey="started" fill="var(--chart-1)" />
                  <BarXAxis showAllLabels />
                  <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: "Sessions started", value: p.started ?? 0 }]} />
                </BarChart>
              </div>
            )}
          </Panel>

          <Panel title="Completion">
            {!d ? <Skeleton className="h-[280px]" /> : (
              <div className="vx-chart flex flex-1 flex-col items-center justify-center gap-3">
                <PieChart size={220} innerRadius={78} cornerRadius={6} padAngle={0.02}
                  data={[{ label: "Completed", value: rate, color: "var(--chart-1)" }, { label: "Not yet", value: 100 - rate, color: "rgb(var(--vx-cell))" }]}>
                  <PieSlice index={0} />
                  <PieSlice index={1} showGlow={false} />
                  <PieCenter defaultLabel="Completed" suffix="%" />
                </PieChart>
                <p className={cn("text-center text-sm", muted)}>
                  Share of assigned scenarios your students finished.
                  {d.effectiveness?.engagementChange ? <> Engagement <Delta value={d.effectiveness.engagementChange} /> this month.</> : null}
                </p>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Panel title="Sessions per scenario">
            {!d ? <Skeleton className="h-[260px]" /> : popular.length === 0 ? <Empty>No sessions yet.</Empty> : (
              <div className="vx-chart">
                <BarChart data={popular} xDataKey="name" orientation="horizontal" aspectRatio="auto"
                  className="h-[260px]" margin={{ top: 4, right: 16, bottom: 4, left: 96 }} maxBarWidth={22} animationDuration={700}>
                  <Bar dataKey="sessionCount" fill="var(--chart-1)" />
                  <BarYAxis labelMaxWidth={88} />
                  <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: p.name, value: p.sessionCount ?? 0 }]} />
                </BarChart>
              </div>
            )}
          </Panel>
        </div>

        {transcript && (
          <TranscriptViewerModal isOpen onClose={() => setTranscript(null)}
            student={{ id: transcript.studentId, name: transcript.studentName }} initialSessionId={transcript.sessionId} />
        )}

        <Panel title="Recent scenarios"
          action={<Button variant="secondary" size="sm" onClick={() => navigate("/scenarios")}>View all <ChevronRight /></Button>}>
          {!d ? <Skeleton className="h-24" /> : recent.length === 0 ? <Empty>No scenarios yet.</Empty> : (
            <ul className="grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl md:grid-cols-2 xl:grid-cols-4">
              {recent.map((sc) => (
                <li key={sc._id}>
                  <button type="button" onClick={() => navigate(`/scenarios/edit/${sc._id}`)}
                    className="flex h-full w-full flex-col items-start gap-2 rounded-[6px] bg-[rgb(var(--vx-cell)/0.6)] p-4 text-left transition-colors hover:bg-[rgb(var(--vx-accent)/0.1)]">
                    <span className={cn("rounded-full px-3 py-0.5 text-sm font-medium",
                      sc.status === "Published" ? "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]" : "bg-[rgb(var(--vx-card))]")}>
                      {sc.status || "Draft"}
                    </span>
                    <span className="line-clamp-2 text-base font-semibold">{sc.scenarioName || "Untitled"}</span>
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
