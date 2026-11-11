/*
 * Learning overview panels for the educator and school-admin dashboards (GET /api/dashboard/learning-overview).
 * Ideas from the VPS v10 dashboard prototype, fitted to ours: one cohort switch drives the page, every
 * number has an "i" with its rule, activity dots, criterion-level gaps, progress first → latest, and the
 * learner's own reflection next to their score. Rules: backend/utils/learning.js and /definitions.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../../lib/query";
import { Pagination } from "../../components/vx/list";
import { usePagedRows } from "../../lib/hooks/usePagedRows";
import axios from "axios";
import { Target, Activity, TrendingUp, ChevronRight, ArrowUpDown } from "lucide-react";
import { getAuthHeaders, cn } from "../../lib/utils.js";
import { Info, ActivityDot, ACTIVITY, Ago, MiniRing } from "@/components/vx/bits";
import { Button } from "@/components/vx/ui";

const muted = "text-[rgb(var(--vx-muted))]";
const card = "rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]";
const Skeleton = ({ className }) => <div className={cn("animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]", className)} />;

export function useLearningOverview(groupId) {
  return useData("/api/dashboard/learning-overview", { params: groupId ? { groupId } : undefined, fallback: { totals: {}, learners: [], criteria: [], groups: [], rules: { target: 75 } } });
}

/** A dashboard number with its rule one click away. */
export function Stat({ icon: Icon, label, value, hint, info, onClick, highlight }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={cn(card, "relative flex flex-col gap-2 p-5 text-left", onClick && "transition-colors hover:border-[rgb(var(--vx-accent)/0.6)]",
        highlight && "border-[rgb(var(--vx-accent)/0.55)] bg-[rgb(var(--vx-accent)/0.08)]")}>
      <div className={cn("flex items-center gap-2", muted)}>
        {Icon && <Icon size={18} />}
        <span className="flex-1 text-sm font-medium">{label}</span>
        {info && <Info title={label}>{info}</Info>}
      </div>
      <span className="text-3xl font-semibold leading-none tabular-nums">{value}</span>
      {hint && <span className={cn("text-sm", muted)}>{hint}</span>}
    </Tag>
  );
}

/** The three learning numbers: at target, active, progress. */
export function LearningStats({ data, onLearners }) {
  if (!data) return Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />);
  const t = data.totals || {};
  const target = data.rules?.target ?? 75;
  return (
    <>
      <Stat icon={Target} label="At target" highlight value={t.learners ? `${t.atTarget} of ${t.learners}` : "—"}
        hint={t.started ? `latest session ${target}%+` : "No scored sessions yet"} onClick={onLearners}
        info={`Learners whose latest scored session is ${target}% or higher, out of everyone in this view. Learners who have not started count as not at target.`} />
      <Stat icon={Activity} label="Active learners" value={t.learners ? `${t.active} of ${t.learners}` : "—"}
        hint={t.learners ? [t.atRisk && `${t.atRisk} at risk`, t.inactive && `${t.inactive} inactive`, t.notStarted && `${t.notStarted} not started`].filter(Boolean).join(" · ") || "everyone practising" : ""}
        info={`From each learner's last scored session. Active: within ${data.rules?.activeDays ?? 14} days. At risk: up to ${data.rules?.riskDays ?? 30} days. Inactive: longer. Signing in alone does not count.`} />
      <Stat icon={TrendingUp} label="Progress" value={t.progress == null ? "—" : `${t.progress > 0 ? "+" : ""}${t.progress} pts`}
        hint={t.progressOf ? `first → latest session · ${t.progressOf} learner${t.progressOf === 1 ? "" : "s"}` : "needs two sessions per learner"}
        info="For each learner with two or more scored sessions: latest score minus first score, in percentage points. The figure is the average. Learners with one session are left out." />
    </>
  );
}

/** Criteria where most learners are below standard (criterion % under target on latest attempts). */
export function LearningGaps({ data, limit = 5 }) {
  const rows = (data?.criteria || []).filter((c) => c.criterion !== "General").slice(0, limit);
  return (
    <section className={cn(card, "flex min-w-0 flex-col p-5")}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="flex-1 text-xl font-semibold tracking-tight">Where learners are below standard</h2>
        <Info title="Below standard">For each criterion: the share of learners whose latest attempts meet less than {data?.rules?.target ?? 75}% of its feedback questions (partly met counts half). Most affected first.</Info>
      </div>
      <p className={cn("mb-3 text-sm", muted)}>By skill, not by question: what to teach next.</p>
      {!data ? <Skeleton className="h-40" /> : rows.length === 0 ? (
        <p className={cn("py-10 text-center text-base", muted)}>Shows once sessions are graded against the feedback questions.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => (
            <li key={c.criterion} className={cn("rounded-xl border-l-4 bg-[rgb(var(--vx-cell)/0.5)] px-4 py-3",
              c.share >= 60 ? "border-[rgb(var(--vx-danger))]" : c.share >= 30 ? "border-[rgb(var(--vx-warn))]" : "border-[rgb(var(--vx-ok))]")}>
              <div className="flex items-start justify-between gap-4">
                <span className="text-base font-semibold">{c.criterion}</span>
                <span className="shrink-0 text-lg font-semibold tabular-nums">{c.share}%</span>
              </div>
              <span className={cn("text-sm", muted)}>{c.below} of {c.of} learners below standard · average {c.avg}% met</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SORTS = {
  name: (a, b) => String(a.name).localeCompare(String(b.name)),
  latest: (a, b) => (b.latestScore ?? -1) - (a.latestScore ?? -1),
  gain: (a, b) => (b.gain ?? -999) - (a.gain ?? -999),
  activity: (a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0),
};

/** Every learner in the view: activity, latest score, progress, sessions and their own last reflection. */
export function LearnersTable({ data, onOpen, onAll, limit = 8, groupsById }) {
  const [sort, setSort] = useState("activity");
  const [status, setStatus] = useState("");
  const rows = useMemo(() => [...(data?.learners || [])].filter((l) => !status || l.status === status).sort(SORTS[sort]), [data, sort, status]);
  const counts = useMemo(() => (data?.learners || []).reduce((m, l) => ({ ...m, [l.status]: (m[l.status] || 0) + 1 }), {}), [data]);
  const target = data?.rules?.target ?? 75;
  const pg = usePagedRows(rows, limit);
  const H = ({ k, children, right }) => (
    <th className={cn("whitespace-nowrap px-4 py-2.5 text-sm font-medium", muted, right ? "text-right" : "text-left")}>
      <button type="button" onClick={() => setSort(k)} className={cn("inline-flex items-center gap-1 hover:text-[rgb(var(--vx-ink))]", sort === k && "text-[rgb(var(--vx-ink))]")}>
        {children}<ArrowUpDown size={13} className={sort === k ? "opacity-100" : "opacity-40"} />
      </button>
    </th>
  );
  return (
    <section className={cn(card, "flex min-w-0 flex-col p-5")}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl font-semibold tracking-tight">Learners</h2>
        <div className="vx-join">
        {Object.entries(ACTIVITY).filter(([k]) => counts[k]).map(([k, a]) => (
          <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(status === k ? "" : k)}
            className={cn("inline-flex h-9 items-center gap-1.5 px-3 text-sm font-medium transition-colors",
              status === k ? "bg-[rgb(var(--vx-ink))] text-[rgb(var(--vx-bg))]" : "bg-[rgb(var(--vx-cell))] hover:bg-[rgb(var(--vx-accent)/0.15)]")}>
            <span className={cn("size-2 rounded-full", a.dot)} />{a.label} <span className="tabular-nums opacity-70">{counts[k]}</span>
          </button>
        ))}
        {onAll && <Button variant="secondary" size="sm" className="h-9" onClick={onAll}>All students <ChevronRight /></Button>}
        </div>
      </div>
      {!data ? <Skeleton className="h-60" /> : rows.length === 0 ? <p className={cn("py-10 text-center text-base", muted)}>No learners in this view.</p> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-y border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
              <tr>
                <H k="name">Learner</H>
                <H k="latest" right>Latest</H>
                <H k="gain" right>Progress</H>
                <th className={cn("hidden px-4 py-2.5 text-left text-sm font-medium lg:table-cell", muted)}>Their last reflection</th>
                <H k="activity" right>Activity</H>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
              {pg.rows.map((l) => (
                <tr key={l._id} onClick={() => onOpen?.(l)} className={cn(onOpen && "cursor-pointer hover:bg-[rgb(var(--vx-cell)/0.5)]")}>
                  <td className="max-w-[14rem] px-4 py-3">
                    <div className="truncate text-base font-semibold">{l.name || "Unnamed"}</div>
                    <div className={cn("truncate text-sm", muted)}>{groupsById?.get(l.groupId) || l.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {l.latestScore == null ? <span className={muted}>—</span> : (
                      <span className="inline-flex items-center gap-2">
                        <MiniRing value={l.latestScore} size={24} />
                        <span className={cn("text-base font-semibold tabular-nums", l.latestScore < target && "text-[rgb(var(--vx-danger))]")}>{l.latestScore}%</span>
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-base tabular-nums">
                    {l.gain == null ? <span className={cn("text-sm", muted)}>{l.sessions ? "1 session" : "—"}</span>
                      : <span className={l.gain >= 0 ? "text-[rgb(var(--vx-ok))]" : "text-[rgb(var(--vx-danger))]"}>{l.gain >= 0 ? "▲ +" : "▼ "}{l.gain} pts</span>}
                  </td>
                  <td className="hidden max-w-sm px-4 py-3 lg:table-cell">
                    {l.reflection ? <span className={cn("line-clamp-2 text-sm italic", muted)}>“{l.reflection}”</span> : <span className={cn("text-sm", muted)}>—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <ActivityDot status={l.status} lastAt={l.lastAt} />
                      <span className={muted}>{l.lastAt ? <Ago date={l.lastAt} /> : ACTIVITY[l.status].label}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination {...pg.bind} />
        </div>
      )}
    </section>
  );
}

/** One row per cohort (group): for school admins and educators with several classes. */
export function CohortTable({ data, onPick, current }) {
  const groups = data?.groups || [];
  const target = data?.rules?.target ?? 75;
  if (data && groups.length < 2) return null;
  return (
    <section className={cn(card, "flex min-w-0 flex-col p-5")}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-xl font-semibold tracking-tight">Cohorts</h2>
        <Info title="Cohorts">One row per group. At target and progress use each learner's latest scored session; sessions are the last 30 days. Select a row to focus the whole page on it.</Info>
      </div>
      {!data ? <Skeleton className="h-40" /> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-y border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
              <tr>
                {["Cohort", "Learners", "Active", "At target", "Average", "Progress", "Sessions (30 d)"].map((h, i) => (
                  <th key={h} className={cn("whitespace-nowrap px-4 py-2.5 text-sm font-medium", muted, i ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
              {groups.map((g) => (
                <tr key={g._id || "none"} onClick={() => g._id && onPick?.(g._id)}
                  className={cn(g._id && onPick && "cursor-pointer hover:bg-[rgb(var(--vx-cell)/0.5)]", current === g._id && "bg-[rgb(var(--vx-accent)/0.08)]")}>
                  <td className="px-4 py-3 text-base font-semibold">{g.name}</td>
                  <td className="px-4 py-3 text-right text-base tabular-nums">{g.learners}</td>
                  <td className="px-4 py-3 text-right text-base tabular-nums">{g.active}{g.atRisk ? <span className="text-sm text-[rgb(var(--vx-warn))]"> · {g.atRisk} at risk</span> : null}</td>
                  <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">{g.atTarget} of {g.learners}</td>
                  <td className={cn("px-4 py-3 text-right text-base tabular-nums", g.avgLatest != null && g.avgLatest < target && "text-[rgb(var(--vx-danger))]")}>{g.avgLatest == null ? "—" : `${g.avgLatest}%`}</td>
                  <td className="px-4 py-3 text-right text-base tabular-nums">{g.progress == null ? "—" : `${g.progress > 0 ? "+" : ""}${g.progress} pts`}</td>
                  <td className="px-4 py-3 text-right text-base tabular-nums">{g.sessions30}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** "Showing data for" — the one cohort switch that drives the whole page. */
export function CohortSwitch({ groups, value, onChange, totals }) {
  if (!groups?.length) return null;
  const opts = [{ value: "", label: "All", count: undefined }, ...groups.map((g) => ({ value: g._id, label: g.name, count: g.studentCount }))];
  return (
    <section className={cn(card, "flex flex-col gap-3 p-5 print:border-0 print:p-0")}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--vx-accent-text))]">Showing data for</p>
        <h2 className="text-2xl font-semibold tracking-tight">{value ? groups.find((g) => g._id === value)?.name || "Group" : "All your learners"}</h2>
        {totals && <p className={cn("text-sm", muted)}>{totals.learners} learner{totals.learners === 1 ? "" : "s"}{totals.notStarted ? ` (${totals.notStarted} not started yet)` : ""} · every number on this page follows this choice</p>}
      </div>
      <div className="vx-join print:hidden" role="radiogroup" aria-label="Cohort">
        {opts.map((o) => (
          <button key={o.value || "all"} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
            className={cn("inline-flex h-10 items-center gap-1.5 px-4 text-sm font-medium transition-colors",
              value === o.value ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "bg-[rgb(var(--vx-cell))] hover:bg-[rgb(var(--vx-accent)/0.15)]")}>
            {o.label}{o.count != null && <span className="tabular-nums opacity-70">{o.count}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
