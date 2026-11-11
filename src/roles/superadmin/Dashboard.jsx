// Superadmin (vendor) dashboard in the vx design, with bklit charts (mindsets/superadmin.md):
// platform health, schools that need set-up or renewal, and adoption per school. Counts only.
import React, { useEffect, useMemo, useState } from "react";
import { Building2, Activity, Users, BookOpen, ChevronRight, KeyRound, CalendarClock, Moon, UserX, CheckCircle2, Wrench, FileSpreadsheet, AlertTriangle, CircleDollarSign } from "lucide-react";
import { ToolbarToggle, Pagination } from "@/components/vx/list";
import { usePagedRows } from "../../lib/hooks/usePagedRows";
import { downloadCsv } from "@/components/vx/bits";
import { useAuth } from "../../AuthContext";
import { useNavigate } from "../../lib/router";
import { cn } from "../../lib/utils.js";
import { useStreamedApi } from "../../lib/query";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Button, ButtonGroup } from "@/components/vx/ui";
import { Ago } from "@/components/vx/bits";
import { Kpi, Panel } from "../educator/Dashboard";
import "@/components/vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";
const Skeleton = ({ className }) => <div className={cn("animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]", className)} />;

export function RenewalChip({ daysLeft, status }) {
  if (status && status !== "Active") return <span className="rounded-full bg-[rgb(var(--vx-cell))] px-2.5 py-0.5 text-sm font-medium text-[rgb(var(--vx-muted))]">{status}</span>;
  if (daysLeft == null) return <span className={muted}>—</span>;
  const tone = daysLeft < 0 ? "bg-[rgb(var(--vx-danger)/0.1)] text-[rgb(var(--vx-danger))]"
    : daysLeft <= 30 ? "bg-[rgb(var(--vx-warn)/0.14)] text-[rgb(var(--vx-warn))]" : "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]";
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-medium tabular-nums", tone)}>{daysLeft < 0 ? `ended ${-daysLeft} d ago` : `${daysLeft} d left`}</span>;
}

/*
 * Sessions per week (8 bars) or per month (6 bars). Buckets come from the server as calendar
 * weeks (Monday start) and months with ISO start dates; labels are formatted here, in local time.
 * The header compares with the previous period of the same length.
 */
const fmtDay = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
export function ActivityChart({ weeks = [], months = [], className = "xl:col-span-2" }) {
  const [mode, setMode] = useState("week");
  const src = mode === "week" ? weeks : months;
  const n = mode === "week" ? 8 : 6;
  const cur = src.slice(-n), prev = src.slice(-2 * n, -n);
  const sum = (a) => a.reduce((t, b) => t + b.sessions, 0);
  const total = sum(cur), before = sum(prev);
  const change = before ? Math.round(((total - before) / before) * 100) : null;
  const multiYear = cur.length && new Date(cur[0].start).getFullYear() !== new Date(cur[cur.length - 1].start).getFullYear();
  const data = cur.map((b, i) => {
    const st = new Date(b.start);
    const last = i === cur.length - 1;
    let label, range;
    if (mode === "week") {
      const end = new Date(st); end.setDate(end.getDate() + 6);
      label = fmtDay(st);
      range = `${fmtDay(st)} – ${fmtDay(end)}`;
    } else {
      label = st.toLocaleDateString(undefined, { month: "short", ...(multiYear && { year: "2-digit" }) });
      range = st.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    return { label: last ? `${label}*` : label, range: last ? `${range} (so far)` : range, sessions: b.sessions, students: b.students };
  });
  return (
    <Panel title={mode === "week" ? "Sessions per week" : "Sessions per month"} className={className}
      action={
        <div className="flex [&>div]:flex [&>div]:h-9 [&>div]:items-center [&>div]:rounded-full [&>div]:bg-[rgb(var(--vx-cell))] [&_button]:h-7 [&_button]:px-3 [&_button]:text-sm">
          <ToolbarToggle label="Period" value={mode} onChange={setMode} options={[{ value: "week", label: "8 weeks" }, { value: "month", label: "6 months" }]} />
        </div>
      }>
      <p className="-mt-1 mb-1 text-base">
        <b className="tabular-nums">{total}</b> sessions
        {change != null && (
          <span className={cn("ml-2 rounded-full px-2 py-0.5 text-sm font-medium tabular-nums", change >= 0 ? "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]" : "bg-[rgb(var(--vx-danger)/0.1)] text-[rgb(var(--vx-danger))]")}>
            {change >= 0 ? "+" : ""}{change}% on the previous {mode === "week" ? "8 weeks" : "6 months"}
          </span>
        )}
      </p>
      {!total ? <p className={cn("py-10 text-center text-base", muted)}>No sessions in this period.</p> : (
        <div className="vx-chart">
          <BarChart data={data} xDataKey="label" aspectRatio="auto" className="h-[220px]" margin={{ top: 12, right: 8, bottom: 32, left: 8 }}
            maxBarWidth={44} animationDuration={600} revealSignature={mode}>
            <Grid horizontal vertical={false} />
            <Bar dataKey="sessions" fill="var(--chart-1)" />
            <BarXAxis showAllLabels />
            <ChartTooltip title={(p) => p.range} rows={(p) => [
              { color: "var(--chart-1)", label: "Sessions", value: p.sessions ?? 0 },
              { color: "rgb(var(--vx-muted))", label: "Students", value: p.students ?? 0 },
            ]} />
          </BarChart>
        </div>
      )}
      <p className={cn("text-sm", muted)}>* still in progress. {mode === "week" ? "Weeks start on Monday." : ""}</p>
    </Panel>
  );
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  /*
   * Streamed (TanStack Query streamedQuery over NDJSON): the headline counts arrive first and fill
   * the tiles; the full overview (schools, charts, renewals) replaces them when it is ready.
   */
  const q = useStreamedApi("/api/dashboard/platform-overview/stream", {
    initialValue: null,
    reducer: (acc, line) => line.part === "full" ? line
      : line.part === "totals" ? { ...(acc || {}), totals: { ...(acc?.totals || {}), ...line.totals } }
      : line.part === "error" ? (acc?.schools ? acc : { totals: acc?.totals || {}, weeks: [], schools: [] }) : acc,
  });
  const streamed = q.data;
  // Tiles need only the totals; everything else waits for the full overview.
  const d = streamed?.schools ? streamed : null;
  const tilesReady = !!streamed?.totals?.schools || !!d;

  const first = String(user?.name || "").split(/\s+/).find((w) => w && !/^(dr|prof|mr|mrs|ms|miss|mx)\.?$/i.test(w)) || "";
  const t = streamed?.totals || {};
  const schools = d?.schools || [];
  const active = schools.filter((s) => s.status === "Active");
  const [show, setShow] = useState("");
  const shown = useMemo(() => schools.filter((s) => ({
    "": true,
    expiring: s.status === "Active" && s.daysLeft != null && s.daysLeft <= 60,
    noadmin: !s.admin || !s.admin.lastLoginAt,
    quiet: s.status === "Active" && s.sessions30 === 0,
    // From the Renewals panel's "View" buttons.
    end30: s.status === "Active" && s.daysLeft != null && s.daysLeft > 0 && s.daysLeft <= 30,
    end60: s.status === "Active" && s.daysLeft != null && s.daysLeft > 30 && s.daysLeft <= 60,
    end90: s.status === "Active" && s.daysLeft != null && s.daysLeft > 60 && s.daysLeft <= 90,
    lapsed: s.daysLeft != null && s.daysLeft <= 0 && s.sessions30 > 0,
  }[show] ?? true)), [schools, show]);
  const pg = usePagedRows(shown, 16);
  const exportCsv = () => downloadCsv(`schools-usage-${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: "School", value: (s) => s.name }, { label: "Status", value: (s) => s.status }, { label: "Plan", value: (s) => s.plan || "" },
    { label: "Admin", value: (s) => s.admin?.email || "" }, { label: "Admin last sign-in", value: (s) => (s.admin?.lastLoginAt ? s.admin.lastLoginAt.slice(0, 10) : "") },
    { label: "Students", value: (s) => s.students }, { label: "Educators", value: (s) => s.educators }, { label: "Scenarios", value: (s) => s.scenarios },
    { label: "Active students (7 d)", value: (s) => s.active7 }, { label: "Sessions (30 d)", value: (s) => s.sessions30 },
    { label: "Last session", value: (s) => (s.lastSessionAt ? String(s.lastSessionAt).slice(0, 10) : "") },
    { label: "Subscription ends", value: (s) => (s.expireDate ? String(s.expireDate).slice(0, 10) : "") }, { label: "Days left", value: (s) => s.daysLeft ?? "" },
  ], shown);

  // What needs us, school by school (V2, V3, V1).
  const needs = [
    { key: "noadmin", icon: KeyRound, tone: "warn", items: active.filter((s) => !s.admin), title: (n) => `${n} school${n === 1 ? "" : "s"} without an admin` },
    { key: "nosignin", icon: UserX, tone: "warn", items: active.filter((s) => s.admin && !s.admin.lastLoginAt), title: (n) => `${n} admin${n === 1 ? "" : "s"} never signed in` },
    { key: "renew", icon: CalendarClock, tone: "danger", items: active.filter((s) => s.daysLeft != null && s.daysLeft <= 30), title: (n) => `${n} subscription${n === 1 ? "" : "s"} ending within 30 days` },
    { key: "quiet", icon: Moon, tone: "muted", items: active.filter((s) => s.admin && s.sessions30 === 0), title: (n) => `${n} school${n === 1 ? "" : "s"} with no sessions in 30 days` },
    { key: "unfinished", icon: AlertTriangle, tone: "warn", items: schools.filter((s) => s.unfinished30 >= 3), title: (n) => `Sessions not finishing at ${n} school${n === 1 ? "" : "s"}`,
      names: (it) => it.map((s) => `${s.name} (${s.unfinished30})`) },
    { key: "tech", icon: Wrench, tone: "danger", items: schools.filter((s) => s.technicalReports > 0), title: (n) => `Students reported technical problems at ${n} school${n === 1 ? "" : "s"}`,
      names: (it) => it.map((s) => `${s.name} (${s.technicalReports})`) },
  ].filter((r) => r.items.length);
  const toneCls = { warn: "text-[rgb(var(--vx-warn))] bg-[rgb(var(--vx-warn)/0.12)]", danger: "text-[rgb(var(--vx-danger))] bg-[rgb(var(--vx-danger)/0.1)]", muted: "text-[rgb(var(--vx-muted))] bg-[rgb(var(--vx-cell))]" };

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">{first ? `Welcome back, ${first}` : "Dashboard"}</h1>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={Building2} label="Schools" value={tilesReady ? t.activeSchools : "…"} hint={tilesReady ? `active of ${t.schools}` : ""} onClick={() => navigate("/schools")} />
          <Kpi icon={Activity} label="Active students this week" value={t.activeStudents7 ?? "…"} hint={tilesReady ? `of ${t.students} students` : ""} />
          <Kpi icon={Users} label="Sessions, last 30 days" value={tilesReady ? t.sessions30 : "…"} hint={tilesReady ? `${t.educators} educators` : ""} />
          <Kpi icon={BookOpen} label="Scenarios" value={tilesReady ? t.scenarios : "…"} hint="across all schools" />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title="Needs us" className="xl:col-span-1">
            {!d ? <Skeleton className="h-40" /> : needs.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl bg-[rgb(var(--vx-ok)/0.08)] px-4 py-3 text-base">
                <CheckCircle2 size={20} className="text-[rgb(var(--vx-ok))]" /> Every active school is set up, signed in and practising.
              </div>
            ) : (
              <ul className="-mx-5 divide-y divide-[rgb(var(--vx-line)/0.7)]">
                {needs.map((r) => {
                  const Icon = r.icon;
                  return (
                    <li key={r.key} className="flex items-start gap-3 px-5 py-3">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", toneCls[r.tone])}><Icon size={18} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold">{r.title(r.items.length)}</span>
                        <span className={cn("block truncate text-sm", muted)}>{(r.names ? r.names(r.items) : r.items.map((s) => s.name)).slice(0, 3).join(", ")}{r.items.length > 3 ? ` and ${r.items.length - 3} more` : ""}</span>
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => navigate("/schools")}>Open</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {d ? <ActivityChart weeks={d.weeks} months={d.months} /> : <Panel title="Sessions per week" className="xl:col-span-2"><Skeleton className="h-[240px]" /></Panel>}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel title="Renewals">
            {!d ? <Skeleton className="h-40" /> : (() => {
              const band = (lo, hi) => active.filter((s) => s.daysLeft != null && s.daysLeft > lo && s.daysLeft <= hi);
              const lapsed = schools.filter((s) => s.daysLeft != null && s.daysLeft <= 0 && s.sessions30 > 0);
              const rows = [["Ending in 30 days", band(0, 30), "danger", "end30"], ["31 to 60 days", band(30, 60), "warn", "end60"], ["61 to 90 days", band(60, 90), "muted", "end90"], ["Ended but still used", lapsed, "danger", "lapsed"]];
              const max = Math.max(1, ...rows.map(([, l]) => l.length));
              const go = (key) => { setShow(key); document.getElementById("schools-table")?.scrollIntoView({ behavior: "smooth" }); };
              return (
                <ul className="flex flex-col gap-0.5 overflow-hidden rounded-2xl">
                  {rows.map(([label, list, tone, key]) => (
                    <li key={label} className="flex items-center gap-4 bg-[rgb(var(--vx-cell)/0.5)] px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-base font-medium">{label}</span>
                          <span className={cn("text-xl font-semibold tabular-nums", list.length ? "" : muted)}>{list.length}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--vx-card))]">
                          <div className={cn("h-full rounded-full", tone === "danger" ? "bg-[rgb(var(--vx-danger))]" : tone === "warn" ? "bg-[rgb(var(--vx-warn))]" : "bg-[rgb(var(--vx-muted))]")} style={{ width: `${(list.length / max) * 100}%` }} />
                        </div>
                        {list.length > 0 && <p className={cn("mt-1 truncate text-sm", muted)}>{list.slice(0, 2).map((x) => x.name).join(", ")}{list.length > 2 ? ` and ${list.length - 2} more` : ""}</p>}
                      </div>
                      <Button variant="secondary" size="sm" disabled={!list.length} onClick={() => go(key)}>View <ChevronRight /></Button>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Panel>
          <Panel title="Platform health, 30 days">
            {!d ? <Skeleton className="h-40" /> : (
              <ul className="flex flex-col gap-2 text-base">
                <li className="flex items-center gap-2"><Activity size={18} className={muted} /><span className="flex-1">Sessions</span><b className="tabular-nums">{t.sessions30}</b></li>
                <li className="flex items-center gap-2"><AlertTriangle size={18} className={t.unfinished30 ? "text-[rgb(var(--vx-warn))]" : muted} /><span className="flex-1">Did not finish</span>
                  <b className="tabular-nums">{t.unfinished30}{t.sessions30 ? <span className={cn("ml-1 text-sm font-normal", muted)}>({Math.round((t.unfinished30 / t.sessions30) * 100)}%)</span> : null}</b></li>
                <li className="flex items-center gap-2"><Wrench size={18} className={muted} /><span className="flex-1">Technical reports</span><b className="tabular-nums">{schools.reduce((n, s) => n + (s.technicalReports || 0), 0)}</b></li>
                <li className={cn("mt-1 text-sm", muted)}>"Did not finish": started over 2 hours ago with no conversation. The simulator does not report its own errors yet.</li>
              </ul>
            )}
          </Panel>
          <Panel title="AI spend, 30 days">
            {!d ? <Skeleton className="h-40" /> : !(d.aiSpend30 || []).length ? (
              <p className={cn("text-base", muted)}>No AI calls logged yet. Logging started with this release.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-base">
                {d.aiSpend30.map((r) => (
                  <li key={r.kind} className="flex items-center gap-2">
                    <CircleDollarSign size={18} className={muted} />
                    <span className="flex-1">{{ scenario_ai: "Writing scenarios", sim: "Built-in simulator", other: "Other" }[r.kind] || r.kind}<span className={cn("text-sm", muted)}> · {r.calls} calls</span></span>
                    <b className="tabular-nums">{r.costUsd ? `$${r.costUsd.toFixed(2)}` : `${Math.round(r.tokens / 1000)}k tokens`}</b>
                  </li>
                ))}
              </ul>
            )}
            <p className={cn("mt-2 text-sm", muted)}>Calls this server makes. Live student sessions run in Voxio; their cost comes from Voxio's usage, not from here.</p>
          </Panel>
        </div>

        <div id="schools-table" className="scroll-mt-4" />
        <Panel title="Schools" action={
          <span className="flex flex-wrap items-center gap-2">
            <span className="flex [&>div]:flex [&>div]:h-9 [&>div]:items-center [&>div]:rounded-full [&>div]:bg-[rgb(var(--vx-cell))] [&_button]:h-7 [&_button]:px-3 [&_button]:text-sm">
              <ToolbarToggle label="Show" value={show} onChange={setShow}
                options={[{ value: "", label: "All" }, { value: "expiring", label: "Ending ≤ 60 d" }, { value: "noadmin", label: "Admin not in" }, { value: "quiet", label: "Quiet" }]} />
            </span>
            <ButtonGroup>
              <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!shown.length}><FileSpreadsheet /> Export</Button>
              <Button variant="secondary" size="sm" onClick={() => navigate("/schools")}>Manage <ChevronRight /></Button>
            </ButtonGroup>
          </span>
        }>
          {!d ? <Skeleton className="h-48" /> : schools.length === 0 ? (
            <p className={cn("py-10 text-center text-base", muted)}>No schools yet.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-y border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
                  <tr>
                    {["School", "Admin", "Students", "Educators", "Scenarios", "Active (7 d)", "Sessions (30 d)", "Last session", "Subscription"].map((h, i) => (
                      <th key={h} className={cn("whitespace-nowrap px-5 py-2.5 text-sm font-medium", muted, i >= 2 && i <= 6 ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
                  {shown.length === 0 && <tr><td colSpan={9} className={cn("px-5 py-10 text-center text-base", muted)}>No schools match.</td></tr>}
                  {pg.rows.map((s) => (
                    <tr key={s._id} onClick={() => navigate(`/schools/${s._id}`)} className="cursor-pointer transition-colors hover:bg-[rgb(var(--vx-accent)/0.05)]">
                      <td className="max-w-xs px-5 py-3"><div className="truncate text-base font-semibold">{s.name}</div><div className={cn("text-sm", muted)}>{s.plan || "—"}</div></td>
                      <td className="max-w-[14rem] px-5 py-3">
                        {s.admin ? (<><div className="truncate text-base">{s.admin.name || s.admin.email}</div>
                          <div className={cn("text-sm", muted)}>{s.admin.lastLoginAt ? <>signed in <Ago date={s.admin.lastLoginAt} /></> : "never signed in"}</div></>)
                          : <span className="text-sm font-medium text-[rgb(var(--vx-warn))]">No admin</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-base tabular-nums">{s.students}</td>
                      <td className="px-5 py-3 text-right text-base tabular-nums">{s.educators}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-base tabular-nums">{s.scenarios}<span className={cn("text-sm", muted)}> · {s.published} live</span></td>
                      <td className="px-5 py-3 text-right text-base tabular-nums">{s.active7}</td>
                      <td className="px-5 py-3 text-right text-base font-semibold tabular-nums">{s.sessions30}</td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-base", !s.lastSessionAt && muted)}><Ago date={s.lastSessionAt} fallback="None" /></td>
                      <td className="px-5 py-3"><RenewalChip daysLeft={s.daysLeft} status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination {...pg.bind} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
