// Range-of-movement restrictions for the new scenario page, in the vx design (docs/DESIGN_SYSTEM.md).
// Bound to the form's `movements` field: { [regionId]: { [movementId]: value } }. An unset movement
// is shown as Full and stays unset, so formatMovementsForBackend omits it exactly as before.
import React from "react";
import { useController } from "react-hook-form";
import { RotateCcw, X } from "lucide-react";
import { Button, ButtonGroup } from "../vx/ui";
import { cn } from "../../lib/utils";

const humanize = (label) => label.split("_").map((w, i) => (i ? w.toLowerCase() : w)).join(" ");
const optionLabel = (opt) => {
  if (opt === "Full") return "Full";
  if (opt === "Ltd") return "Limited";
  const g = opt.match(/^(\d+)_Ltd$/);
  return g ? `Limited ${g[1]}°` : humanize(opt);
};
const isRestricted = (v) => !!v && v !== "Full";

export default function MovementPicker({ control, regions }) {
  const { field: { value: movements = {}, onChange } } = useController({ name: "movements", control });

  const set = (regionId, movementId, next) => {
    const region = { ...(movements[regionId] || {}) };
    if (next === "Full") delete region[movementId];
    else region[movementId] = next;
    onChange({ ...movements, [regionId]: region });
  };

  const restrictions = regions.flatMap((r) =>
    r.movements.filter((m) => isRestricted(movements[r.id]?.[m.id])).map((m) => ({ r, m, v: movements[r.id][m.id] })));

  return (
    <div className="flex flex-col gap-4">
      {restrictions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {restrictions.map(({ r, m, v }) => (
            <span key={`${r.id}-${m.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--vx-accent))] bg-[rgb(var(--vx-accent)/0.12)] py-1 pl-4 pr-1.5 text-sm">
              <span className="font-semibold">{r.label}</span>
              <span>{humanize(m.label)}</span>
              <span className="text-[rgb(var(--vx-accent-text))]">{optionLabel(v)}</span>
              <button type="button" onClick={() => set(r.id, m.id, "Full")} aria-label={`Make ${r.label} ${humanize(m.label)} full again`}
                className="rounded-full p-1 hover:bg-[rgb(var(--vx-accent)/0.2)]"><X size={16} /></button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {regions.map((region) => {
          const count = region.movements.filter((m) => isRestricted(movements[region.id]?.[m.id])).length;
          return (
            <div key={region.id} className="rounded-2xl bg-[rgb(var(--vx-cell)/0.6)] p-2">
              <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-xl font-semibold">{region.label}</h3>
                  <span className={cn("text-sm", count ? "font-medium text-[rgb(var(--vx-accent-text))]" : "text-[rgb(var(--vx-muted))]")}>
                    {count ? `${count} limited` : "All full"}
                  </span>
                </div>
                {count > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => onChange({ ...movements, [region.id]: {} })}>
                    <RotateCcw /> Reset
                  </Button>
                )}
              </div>
              <ul className="flex flex-col gap-0.5">
                {region.movements.map((m) => {
                  const value = movements[region.id]?.[m.id] || "Full";
                  const limited = isRestricted(value);
                  return (
                    <li key={m.id} className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-[8px] px-3 py-2 transition-colors first:rounded-t-xl last:rounded-b-xl",
                      limited ? "bg-[rgb(var(--vx-accent)/0.08)]" : "bg-[rgb(var(--vx-card))]",
                    )}>
                      <span className={cn("text-base", limited && "font-semibold")}>{humanize(m.label)}</span>
                      <ButtonGroup>
                        {m.options.map((opt) => {
                          const on = value === opt;
                          return (
                            <Button key={opt} size="sm" aria-pressed={on}
                              variant={on ? (opt === "Full" ? "secondary" : "default") : "ghost"}
                              className={cn("px-4", on && opt === "Full" && "bg-[rgb(var(--vx-ink)/0.08)]", !on && "text-[rgb(var(--vx-muted))]")}
                              onClick={() => set(region.id, m.id, opt)}>
                              {optionLabel(opt)}
                            </Button>
                          );
                        })}
                      </ButtonGroup>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
