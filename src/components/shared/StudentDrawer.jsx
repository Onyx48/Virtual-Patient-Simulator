// One student at a glance (docs/EDUCATOR_SCREENS.md, Students): scores over time, best per
// scenario, reflections, and the educator's private note. Opens from a row on the Students page.
import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../../lib/query";
import axios from "axios";
import { toast } from "react-hot-toast";
import { X, FileText, Bell, ClipboardList, Loader2, HeartPulse, PenLine } from "lucide-react";
import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Button, ButtonGroup } from "../vx/ui";
import { CopyButton, Ago } from "../vx/bits";
import { toScorePercent, cn } from "../../lib/utils";

const muted = "text-[rgb(var(--vx-muted))]";
const card = "rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-4";

export default function StudentDrawer({ student, onClose, onTranscripts, onRemind, onAssign, onEmail, canManage }) {
  const sessions = useData(`/api/sessions/student/${student.id}`, { fallback: [] });
  const [note, setNote] = useState(student.originalData?.educatorNote?.text || "");
  const [noteState, setNoteState] = useState("");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);



  const scored = useMemo(() => (sessions || []).filter((x) => x.score > 0)
    .map((x) => ({ t: new Date(x.createdAt), score: toScorePercent(x.score), name: x.scenario_id?.scenarioName || "Scenario" }))
    .sort((a, b) => a.t - b.t), [sessions]);

  const perScenario = useMemo(() => {
    const m = new Map();
    (sessions || []).forEach((x) => {
      const id = x.scenario_id?._id || x.scenario_id;
      const cur = m.get(id) || { name: x.scenario_id?.scenarioName || "Scenario", n: 0, best: 0, last: null };
      cur.n += 1;
      cur.best = Math.max(cur.best, toScorePercent(x.score));
      if (!cur.last || new Date(x.createdAt) > new Date(cur.last)) cur.last = x.createdAt;
      m.set(id, cur);
    });
    return [...m.values()].sort((a, b) => new Date(b.last) - new Date(a.last));
  }, [sessions]);

  const reflections = (sessions || []).filter((x) => x.reflection?.summary || x.reflection?.distress_flag).slice(0, 3);

  const saveNote = async () => {
    if (note.trim() === (student.originalData?.educatorNote?.text || "")) return;
    setNoteState("saving");
    try {
      const { data } = await axios.patch(`/api/students/${student.id}/note`, { text: note });
      if (student.originalData) student.originalData.educatorNote = data.educatorNote;
      setNoteState("saved");
    } catch (e) {
      setNoteState("error");
      toast.error(e.response?.data?.message || "Could not save the note.");
    }
  };

  return (
    <div className="vx fixed inset-0 z-50 flex justify-end backdrop-blur-[2px]" style={{ background: "rgb(0 0 0 / 0.35)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={student.name}
        className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-[rgb(var(--vx-bg))] text-[rgb(var(--vx-ink))] shadow-2xl">
        <div className="flex items-start gap-3 px-6 pb-3 pt-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[rgb(var(--vx-accent)/0.2)] text-lg font-semibold text-[rgb(var(--vx-accent-text))]">
            {String(student.name).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-semibold tracking-tight">{student.name}</h2>
            <p className={cn("flex items-center gap-0.5 text-base", muted)}>
              <span className="truncate">{student.email}</span><CopyButton value={student.email} label="Copy email" />
            </p>
            <p className={cn("text-sm", muted)}>
              {student.groupName || "No group"} · last session <Ago date={student.lastSessionAt} fallback="never" />
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className={cn("grid size-10 shrink-0 place-items-center rounded-full hover:bg-[rgb(var(--vx-cell))]", muted)}><X size={20} /></button>
        </div>

        <div className="px-6 pb-3">
          <ButtonGroup>
            <Button variant="secondary" size="sm" onClick={onTranscripts}><FileText /> Transcripts</Button>
            {canManage && <Button variant="secondary" size="sm" onClick={onRemind}><Bell /> Remind</Button>}
            {canManage && onEmail && <Button variant="secondary" size="sm" onClick={onEmail}><PenLine /> Email</Button>}
            {canManage && onAssign && <Button variant="secondary" size="sm" onClick={onAssign}><ClipboardList /> Assign</Button>}
          </ButtonGroup>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-3 gap-2">
            {[["Sessions", student.totalSessions], ["Average", student.progress === "N/A" ? "—" : student.progress], ["Best", student.bestScore || "—"]].map(([l, v]) => (
              <div key={l} className={cn(card, "p-3")}>
                <div className={cn("text-sm", muted)}>{l}</div>
                <div className="text-2xl font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>

          <section className={card}>
            <h3 className="mb-1 text-lg font-semibold">Scores over time</h3>
            {sessions === null ? (
              <p className={cn("flex items-center gap-2 py-8 text-base", muted)}><Loader2 size={18} className="animate-spin" /> Loading…</p>
            ) : scored.length < 2 ? (
              <p className={cn("py-6 text-base", muted)}>{scored.length ? "One scored session so far. The trend shows after the second." : "No scored sessions yet."}</p>
            ) : (
              <div className="vx-chart">
                <LineChart data={scored} xDataKey="t" aspectRatio="auto" className="h-[200px] w-full" margin={{ left: 52, right: 20, top: 12, bottom: 32 }} yScaleDomainMax={100}>
                  <Grid />
                  <XAxis />
                  <YAxis numTicks={5} formatValue={(v) => (Math.round(v) === 0 ? "" : `${Math.round(v)}%`)} />
                  <Line dataKey="score" stroke="var(--chart-1)" fadeEdges={false} showMarkers />
                  <ChartTooltip rows={(p) => [{ color: "var(--chart-1)", label: p.name, value: `${p.score}%` }]} />
                </LineChart>
              </div>
            )}
          </section>

          {perScenario.length > 0 && (
            <section className={card}>
              <h3 className="mb-2 text-lg font-semibold">By scenario</h3>
              <ul className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
                {perScenario.map((x) => (
                  <li key={x.name + x.last} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">{x.name}</span>
                      <span className={cn("text-sm", muted)}>{x.n} attempt{x.n === 1 ? "" : "s"} · <Ago date={x.last} /></span>
                    </span>
                    <span className="text-base font-semibold tabular-nums">{x.best ? `${x.best}%` : "—"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {reflections.length > 0 && (
            <section className={card}>
              <h3 className="mb-2 text-lg font-semibold">Recent reflections</h3>
              <ul className="flex flex-col gap-2">
                {reflections.map((x) => (
                  <li key={x._id} className="text-base">
                    <span className={cn("text-sm", muted)}>{x.scenario_id?.scenarioName} · <Ago date={x.createdAt} />
                      {x.reflection.self_rating != null && ` · rated themselves ${x.reflection.self_rating}/10`}</span>
                    {x.reflection.distress_flag && <span className="ml-2 inline-flex items-center gap-1 text-sm font-medium text-[rgb(var(--vx-danger))]"><HeartPulse size={14} /> distress</span>}
                    {x.reflection.summary && <p>{x.reflection.summary}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={card}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your note</h3>
              <span className={cn("text-sm", noteState === "error" ? "text-[rgb(var(--vx-danger))]" : muted)}>
                {noteState === "saving" ? "Saving…" : noteState === "saved" ? "Saved" : noteState === "error" ? "Not saved" : "Only educators see this"}
              </span>
            </div>
            <textarea value={note} onChange={(e) => { setNote(e.target.value); setNoteState(""); }} onBlur={saveNote} rows={3}
              placeholder="e.g. Anxious in tutorials; strong on red flags, weak on psychosocial."
              className="w-full resize-y rounded-xl border-0 bg-[rgb(var(--vx-cell)/0.6)] px-3 py-2 text-base outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
          </section>
        </div>
      </aside>
    </div>
  );
}
