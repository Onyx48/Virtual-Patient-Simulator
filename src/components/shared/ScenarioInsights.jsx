// One scenario's results (docs/EDUCATOR_SCREENS.md, Scenarios): score spread, what students miss,
// who did it lately. Same dashboard endpoints, narrowed with ?scenarioId.
import React, { useEffect, useState } from "react";
import { useData } from "../../lib/query";
import { Paged } from "../vx/list";
import { Button, ButtonGroup } from "../vx/ui";
import axios from "axios";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Dialog } from "../vx/ui";
import { Ago } from "../vx/bits";
import TranscriptViewerModal from "../ui/TranscriptViewerModal";
import { cn } from "../../lib/utils";

const muted = "text-[rgb(var(--vx-muted))]";
const card = "rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5";

export default function ScenarioInsights({ scenario, onClose }) {
  const id = scenario._id || scenario.id;
  const spread = useData("/api/dashboard/score-spread", { params: { compact: 1, scenarioId: id }, fallback: { overall: [], total: 0 } });
  const misses = useData("/api/dashboard/question-misses", { params: { scenarioId: id, limit: 10, min: 1 }, fallback: [] });
  const feed = useData("/api/dashboard/sessions-feed", { params: { scenarioId: id, limit: 20 }, fallback: [] });
  const [open, setOpen] = useState(null);

  const people = feed ? new Set(feed.map((x) => x.studentId)).size : 0;
  const scores = (feed || []).map((x) => x.score).filter((x) => x != null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <>
      <Dialog title={scenario.scenarioName || "Scenario"} subtitle="How students are doing on this case" onClose={onClose} size="lg">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[["Sessions", scenario.totalSessions || 0], ["Students who tried", feed ? people : "…"], ["Average", avg == null ? "—" : `${avg}%`],
              ["Felt realistic", spread?.realism ? `${spread.realism.avg} / 5` : "—"]].map(([l, v]) => (
              <div key={l} className={cn(card, "p-4")}><div className={cn("text-sm", muted)}>{l}</div><div className="text-2xl font-semibold tabular-nums">{v}</div></div>
            ))}
          </div>

          <section className={card}>
            <h3 className="mb-2 text-lg font-semibold">Score spread</h3>
            {!spread ? <p className={muted}>Loading…</p> : spread.total === 0 ? <p className={cn("text-base", muted)}>No scored sessions yet.</p> : (
              <div className="vx-chart">
                <BarChart data={spread.overall} xDataKey="band" aspectRatio="auto" className="h-[200px]" margin={{ top: 12, right: 8, bottom: 32, left: 8 }} maxBarWidth={48}>
                  <Grid horizontal vertical={false} />
                  <Bar dataKey="sessions" fill="var(--chart-1)" />
                  <BarXAxis showAllLabels />
                  <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: `Scored ${p.band}%`, value: p.sessions ?? 0 }]} />
                </BarChart>
              </div>
            )}
          </section>

          <section className={card}>
            <h3 className="mb-2 text-lg font-semibold">Most missed</h3>
            {!misses ? <p className={muted}>Loading…</p> : misses.length === 0 ? <p className={cn("text-base", muted)}>No graded questions yet.</p> : (
              <ul className="flex flex-col gap-2">
                {misses.map((r) => (
                  <li key={r.number} className="flex flex-col gap-1">
                    <span className="flex justify-between gap-4 text-base"><span>{r.question || `Question ${r.number}`}</span><b className="tabular-nums">{r.missRate}%</b></span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--vx-cell))]"><span className="block h-full rounded-full bg-[rgb(var(--vx-accent))]" style={{ width: `${r.missRate}%` }} /></span>
                    <span className={cn("text-sm", muted)}>{r.criterion ? `${r.criterion} · ` : ""}missed in {r.no} of {r.sessions}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ScenarioStudents scenarioId={id} onOpen={(r) => setOpen({ studentId: r.studentId, studentName: r.name, sessionId: r.lastSessionId })} />

          <section className={card}>
            <h3 className="mb-2 text-lg font-semibold">Latest sessions</h3>
            {!feed ? <p className={muted}>Loading…</p> : feed.length === 0 ? <p className={cn("text-base", muted)}>Nobody has tried it yet.</p> : (
              <ul className="-mx-2 flex flex-col">
                {feed.map((r) => (
                  <li key={r.sessionId}>
                    <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[rgb(var(--vx-cell)/0.6)]">
                      <span className="min-w-0 flex-1 truncate text-base font-medium">{r.studentName}</span>
                      <span className={cn("text-sm", muted)}><Ago date={r.at} /></span>
                      <span className="w-12 text-right text-base font-semibold tabular-nums">{r.score == null ? "—" : `${r.score}%`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Dialog>
      {open && (
        <TranscriptViewerModal isOpen onClose={() => setOpen(null)} student={{ id: open.studentId, name: open.studentName }} initialSessionId={open.sessionId} />
      )}
    </>
  );
}

/** Who did what: everyone assigned (or who tried it), with attempts and scores; a row opens their latest attempt. */
export function ScenarioStudents({ scenarioId, onOpen }) {
  const d = useData("/api/dashboard/scenario-students", { params: { scenarioId }, fallback: { rows: [], total: 0, tried: 0 } });
  const [show, setShow] = useState("all");
  const rows = (d?.rows || []).filter((r) => show === "all" || (show === "tried" ? r.attempts > 0 : r.attempts === 0));
  const tone = (v) => (v == null ? "" : v >= 75 ? "text-[rgb(var(--vx-ok))]" : v < 50 ? "text-[rgb(var(--vx-warn))]" : "");
  return (
    <section className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Students {d && <span className={cn("text-base font-normal", muted)}>· {d.tried} of {d.total} tried it</span>}</h3>
        <ButtonGroup>
          {[["all", "All"], ["tried", "Tried"], ["not", "Not started"]].map(([k, l]) => (
            <Button key={k} size="sm" variant={show === k ? "default" : "secondary"} aria-pressed={show === k} onClick={() => setShow(k)}>{l}</Button>
          ))}
        </ButtonGroup>
      </div>
      {!d ? <p className={muted}>Loading…</p> : rows.length === 0 ? <p className={cn("text-base", muted)}>Nobody here.</p> : (
        <Paged rows={rows} size={10}>{(page) => (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <thead><tr className={cn("text-left text-sm", muted)}>
                {["Student", "Attempts", "First", "Latest", "Best", "Last attempt"].map((h, i) => <th key={h} className={cn("px-2 py-2 font-medium", i > 0 && i < 5 && "text-right")}>{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
                {page.map((r) => (
                  <tr key={r.studentId} onClick={() => r.lastSessionId && onOpen(r)} className={cn(r.lastSessionId && "cursor-pointer hover:bg-[rgb(var(--vx-cell)/0.6)]")}>
                    <td className="px-2 py-2"><div className="font-medium">{r.name}</div>{!r.assigned && <div className={cn("text-sm", muted)}>not assigned</div>}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.attempts || <span className={muted}>—</span>}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.first ?? "—"}</td>
                    <td className={cn("px-2 py-2 text-right font-semibold tabular-nums", tone(r.latest))}>{r.latest ?? "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.best ?? "—"}</td>
                    <td className={cn("px-2 py-2", !r.lastAt && muted)}>{r.lastAt ? <Ago date={r.lastAt} /> : "Not started"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}</Paged>
      )}
    </section>
  );
}
