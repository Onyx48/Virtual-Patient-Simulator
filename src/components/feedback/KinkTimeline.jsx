// The history-taking score timeline, with the kinks marked. A port of ci/internal-shortlisting's
// components/interviews/kink-timeline.tsx (docs/HT_TIMELINE_PLAN.md §6): same scale, same stepped
// lines with a blurred backlight, same dots on their own line, same hover column and card.
//
// Hand-drawn SVG rather than a chart library, as in ci: the lines, the dots and the hover
// columns must share ONE x-scale. Colours are inherited (currentColor) so it reads on the dark
// room and on a light page alike; dimension and kink colours come from src/lib/htRubric.js.
//
// No recording here, so a click does not seek a video: it calls onJump(turnNumber), and the
// caller scrolls the transcript to that turn.
import React, { useId, useMemo, useState } from "react";
import { HT_KINK_COLOR, HT_KINK_LABEL } from "../../lib/htRubric";

const W = 960;
const H = 300;
const M = { top: 18, right: 18, bottom: 30, left: 36 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;
const MAX_SCORE = 10;
/** Half-width of a column's hover target, in viewBox units. */
const HIT_HALF_W = 14;
/** Centre-to-centre distance at which two dots stop touching, in viewBox units. */
const KINK_MIN_GAP = 15;

const mmss = (total) => {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmt = (n) => (Math.round(n * 10) / 10).toString();

/**
 * Where the dots for one turn sit vertically: each ON its own dimension's line at the score
 * it moved to, separated only where two would overlap, and kept inside the axes.
 */
function fanOut(baseYs, top, bottom) {
  const order = baseYs.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = new Array(baseYs.length);
  let cursor = -Infinity;
  for (const { y, i } of order) {
    const placed = Math.max(y, cursor + KINK_MIN_GAP);
    out[i] = placed;
    cursor = placed;
  }
  const overflow = cursor - bottom;
  if (overflow > 0) {
    let ceiling = Infinity;
    for (const { i } of [...order].reverse()) {
      const placed = Math.min(out[i] - overflow, ceiling - KINK_MIN_GAP);
      out[i] = placed;
      ceiling = placed;
    }
  }
  return out.map((y) => Math.max(top, Math.min(bottom, y)));
}

/**
 * @param dimensions [{ key, label, color }]
 * @param turns [{ turn, at, status: "scored"|"empty"|"failed", scores: { [key]: { type_, score, description } } }]
 */
export default function KinkTimeline({ dimensions, turns, hiddenDimensions, onJump, showKinks = true }) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null); // { turnIndex, focus }

  const model = useMemo(() => {
    // A failed turn is not a data point: plotting it as a flat continuation is the lie
    // `status` exists to prevent.
    const scored = (turns || []).filter((t) => t.status !== "failed");
    if (scored.length < 2) return null;

    const raw = scored.map((t) => (Number.isFinite(t.at) ? t.at : 0));
    const spread = Math.max(...raw) - Math.min(...raw);
    const useRealTime = spread > 0.5;
    const seconds = useRealTime ? raw : raw.map((_, i) => i);
    const domainStart = seconds[0];
    const domainEnd = seconds[seconds.length - 1];
    const domainSpan = domainEnd - domainStart || 1;

    // The ONE scale. Lines, dots and hover columns all go through it.
    const xOf = (sec) => M.left + ((Math.min(Math.max(sec, domainStart), domainEnd) - domainStart) / domainSpan) * PLOT_W;
    const yOf = (score) => M.top + PLOT_H - (Math.max(0, Math.min(MAX_SCORE, score)) / MAX_SCORE) * PLOT_H;

    // Scores carry forward and a line steps only on a turn that carried a kink. The number on
    // a kink-less turn is ignored, as in backend/utils/htTimeline.js finaliseHt, so the chart
    // and the stored roll-up can never disagree.
    const series = dimensions.map((d) => {
      let last = 0;
      const points = scored.map((turn, i) => {
        const e = turn.scores?.[d.key];
        if (e?.type_ && typeof e.score === "number") last = e.score;
        return { x: xOf(seconds[i]), y: yOf(last), value: last };
      });
      return { ...d, points };
    });

    const columns = new Map();
    scored.forEach((turn, i) => {
      for (const d of dimensions) {
        const e = turn.scores?.[d.key];
        if (!e?.type_) continue;
        const list = columns.get(i) || [];
        list.push({ turnIndex: i, turnNumber: turn.turn, dimensionKey: d.key, label: d.label, color: d.color,
          type_: e.type_, description: e.description || "", score: e.score ?? 0 });
        columns.set(i, list);
      }
    });

    return { scored, seconds, xOf, yOf, series, columns, domainStart, domainEnd, useRealTime };
  }, [dimensions, turns]);

  if (!model) {
    return (
      <div className="grid h-[200px] place-items-center rounded-xl border border-dashed px-4 text-center text-sm opacity-60" style={{ borderColor: "color-mix(in srgb, currentColor 25%, transparent)" }}>
        {!turns?.length ? "No scored turns in this session." : "A timeline needs at least two scored turns. A longer conversation will fill this in."}
      </div>
    );
  }

  const { xOf, yOf, series, columns, seconds, domainStart, domainEnd, useRealTime, scored } = model;
  const visible = (key) => !hiddenDimensions?.has(key);
  const shownKinks = (list) => list.filter((k) => visible(k.dimensionKey));
  const hoveredList = hover ? shownKinks(columns.get(hover.turnIndex) || []) : [];
  const hoveredX = hover ? xOf(seconds[hover.turnIndex]) : 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img"
        aria-label="Scores over the conversation, with the notable moments marked">
        <defs>
          {/* The backlight: each line drawn wide and blurred underneath, then crisp on top. */}
          <filter id={`bl${uid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter>
          <filter id={`halo${uid}`} x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>

        {[0, 2.5, 5, 7.5, 10].map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={yOf(v)} y2={yOf(v)} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
            <text x={M.left - 8} y={yOf(v) + 4} textAnchor="end" fill="currentColor" fillOpacity={0.5} fontSize={12}>{v}</text>
          </g>
        ))}

        {series.map((s) => {
          if (!visible(s.key)) return null;
          const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
          const dimmed = hover !== null && !hoveredList.some((k) => k.dimensionKey === s.key);
          return (
            <g key={s.key} opacity={dimmed ? 0.35 : 1} style={{ transition: "opacity .15s" }}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.4} filter={`url(#bl${uid})`} />
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}

        {showKinks && [...columns.entries()].map(([turnIndex, list]) => {
          const shown = shownKinks(list);
          if (!shown.length) return null;
          const x = xOf(seconds[turnIndex]);
          const isHovered = hover?.turnIndex === turnIndex;
          const fanned = fanOut(shown.map((k) => yOf(k.score)), M.top, M.top + PLOT_H);
          return (
            <g key={turnIndex}>
              {isHovered && <line x1={x} x2={x} y1={M.top} y2={M.top + PLOT_H} stroke="currentColor" strokeOpacity={0.5} strokeWidth={1} />}
              {shown.map((k, i) => {
                const y = fanned[i];
                const focused = isHovered && hover?.focus === k.dimensionKey;
                return (
                  <g key={k.dimensionKey}>
                    {isHovered && <circle cx={x} cy={y} r={10} fill={HT_KINK_COLOR[k.type_]} opacity={0.55} filter={`url(#halo${uid})`} />}
                    <circle cx={x} cy={y} r={focused ? 7 : isHovered ? 6 : 5} fill={HT_KINK_COLOR[k.type_]}
                      stroke="var(--kink-ring, #fff)" strokeWidth={2} style={{ transition: "r .15s" }} />
                  </g>
                );
              })}
              {/* One hit target for the whole column: a 5-unit dot is about three real pixels. */}
              <rect x={x - HIT_HALF_W} y={M.top} width={HIT_HALF_W * 2} height={PLOT_H} fill="transparent"
                style={{ cursor: onJump ? "pointer" : "default" }}
                onMouseEnter={() => setHover({ turnIndex, focus: null })}
                onMouseLeave={() => setHover(null)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (!rect) return;
                  const yUnits = ((e.clientY - rect.top) / rect.height) * H;
                  const nearest = shown.reduce((best, k, i) => {
                    const dy = Math.abs(fanned[i] - yUnits);
                    return dy < best.dy ? { dy, key: k.dimensionKey } : best;
                  }, { dy: Infinity, key: null });
                  if (nearest.key !== hover?.focus || hover?.turnIndex !== turnIndex) setHover({ turnIndex, focus: nearest.key });
                }}
                onClick={() => onJump?.(scored[turnIndex].turn)} />
            </g>
          );
        })}

        <text x={M.left} y={H - 8} fill="currentColor" fillOpacity={0.5} fontSize={12}>{useRealTime ? mmss(domainStart) : "start"}</text>
        <text x={W - M.right} y={H - 8} textAnchor="end" fill="currentColor" fillOpacity={0.5} fontSize={12}>{useRealTime ? mmss(domainEnd) : "end"}</text>
      </svg>

      {showKinks && hover && hoveredList.length > 0 && (
        <div className="pointer-events-none absolute top-3 z-10 w-[min(22rem,80vw)] -translate-x-1/2 rounded-xl border border-black/10 bg-white/95 p-3 text-neutral-900 shadow-sm backdrop-blur"
          style={{ left: `${Math.min(Math.max((hoveredX / W) * 100, 18), 82)}%` }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium">
              Turn {scored[hover.turnIndex].turn}
              {hoveredList.length > 1 && <span className="ml-1.5 text-neutral-500">· {hoveredList.length} moments</span>}
            </span>
            {useRealTime && <span className="text-xs tabular-nums text-neutral-500">{mmss(seconds[hover.turnIndex])}</span>}
          </div>
          <div className="mt-2 space-y-2">
            {hoveredList.map((k) => (
              <div key={k.dimensionKey}
                className={`rounded-lg px-2 py-1.5 transition-colors ${hoveredList.length > 1 && hover.focus === k.dimensionKey ? "bg-neutral-100" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: k.color }} />
                  <span className="text-xs font-medium">{k.label}</span>
                  <span className="ml-auto shrink-0 text-xs font-medium" style={{ color: HT_KINK_COLOR[k.type_] }}>{HT_KINK_LABEL[k.type_]}</span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-500">{fmt(k.score)}</span>
                </div>
                {k.description && <p className="mt-1 text-xs leading-relaxed text-neutral-600">{k.description}</p>}
              </div>
            ))}
          </div>
          {onJump && <p className="mt-2 px-2 text-xs text-neutral-500">Click to see this moment</p>}
        </div>
      )}
    </div>
  );
}
