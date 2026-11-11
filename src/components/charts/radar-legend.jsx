import { defaultRadarColors } from "@/components/charts/radar-context";
import { cn } from "@/lib/utils";
function RadarLegend({
  series,
  metrics,
  hovered,
  onHover,
  className
}) {
  const active = hovered === null ? null : series[hovered];
  return <div className={cn("flex flex-col items-center gap-2", className)}><ul className="flex flex-wrap justify-center gap-1.5">{series.map((s, i) => <li key={s.label}><button
    type="button"
    onMouseEnter={() => onHover(i)}
    onMouseLeave={() => onHover(null)}
    onFocus={() => onHover(i)}
    onBlur={() => onHover(null)}
    className={cn(
      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors hover:bg-muted",
      hovered === i && "bg-muted"
    )}
  ><span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color ?? defaultRadarColors[i % defaultRadarColors.length] }} />{s.label}</button></li>)}</ul>{
    /* Space kept so the card does not jump on hover. */
  }<p className="min-h-5 text-center text-xs tabular-nums text-muted-foreground">{active ? metrics.map((m) => `${m.label} ${Math.round(active.values[m.key] ?? 0)}`).join(" \xB7 ") : "Hover a series to see each skill's score."}</p></div>;
}
export {
  RadarLegend
};
