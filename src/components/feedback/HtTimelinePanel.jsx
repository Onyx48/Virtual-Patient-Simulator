// "How the conversation went": the timeline, a legend that toggles each line, and the final
// scores weakest first (docs/HT_TIMELINE_PLAN.md §6). Used in the room's results and on the
// session pages. Coaching only: these numbers are not part of the history-taking mark.
import React, { useMemo, useState } from "react";
import KinkTimeline from "./KinkTimeline";
import { HT_DIMENSIONS, HT_KINK_COLOR, HT_KINK_LABEL, rollupHt, steadyHt } from "../../lib/htRubric";

export default function HtTimelinePanel({ turns: rawTurns, final, state, onJump }) {
  const [hidden, setHidden] = useState(() => new Set());
  // The same step rules as the stored roll-up, so a dot never sits where the total disagrees.
  const turns = useMemo(() => steadyHt(rawTurns), [rawTurns]);
  // Only dimensions the scorer returned at all. Presence without a camera is absent, not 0.
  const dims = useMemo(
    () => HT_DIMENSIONS.filter((d) => (turns || []).some((t) => t.scores && d.key in t.scores)),
    [turns],
  );
  if (!turns?.length || !dims.length) return null;
  const totals = final || rollupHt(turns).final;
  const finals = dims.map((d) => ({ ...d, value: Number(totals?.[d.key] ?? 0) })).sort((a, b) => a.value - b.value);
  const failed = turns.filter((t) => t.status === "failed").length;
  const toggle = (k) => setHidden((h) => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <section className="space-y-4">
      <div>
        <h4 className="text-base font-semibold">How the conversation went</h4>
        <p className="text-sm opacity-60">Each line climbs when you did something well. Hover a dot to see the moment.</p>
      </div>

      <KinkTimeline dimensions={dims} turns={turns} hiddenDimensions={hidden} onJump={onJump} />

      <div className="flex flex-wrap items-center gap-2">
        {dims.map((d) => {
          const off = hidden.has(d.key);
          return (
            <button key={d.key} type="button" style={{ borderColor: "color-mix(in srgb, currentColor 20%, transparent)" }} onClick={() => toggle(d.key)} aria-pressed={!off} title={d.blurb}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-opacity ${off ? "opacity-40" : ""}`}>
              <span className="size-2.5 rounded-full" style={{ background: d.color }} /> {d.label}
            </button>
          );
        })}
        <span className="ml-auto flex flex-wrap items-center gap-3 text-xs opacity-60">
          {Object.entries(HT_KINK_LABEL).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: HT_KINK_COLOR[k] }} />{label}</span>
          ))}
        </span>
      </div>

      <ul className="space-y-2">
        {finals.map((d) => (
          <li key={d.key} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate">{d.label}</span>
            <span className="h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, currentColor 12%, transparent)" }}>
              <span className="block h-full rounded-full" style={{ width: `${(d.value / 10) * 100}%`, background: d.color }} />
            </span>
            <span className="text-right tabular-nums opacity-70">{Math.round(d.value * 10) / 10}</span>
          </li>
        ))}
      </ul>

      {(state === "partial" || failed > 0) && (
        <p className="text-xs opacity-60">{failed} turn{failed === 1 ? " was" : "s were"} not scored (the next line came in before scoring finished). They are left out, not counted as zero.</p>
      )}
    </section>
  );
}
