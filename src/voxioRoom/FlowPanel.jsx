// Dev only: what the flow sends back, as tiles and a readable packet feed.
import React from "react";
import { Activity, ChevronDown, Radio } from "lucide-react";

const kindOf = (d) => {
  if (d && typeof d === "object") {
    if ("movement" in d || "frame" in d) return ["Movement", "text-sky-300 bg-sky-400/10 border-sky-400/30"];
    if ("expression" in d) return ["Expression", "text-violet-300 bg-violet-400/10 border-violet-400/30"];
    if ("feedback" in d || "score" in d) return ["Feedback", "text-emerald-300 bg-emerald-400/10 border-emerald-400/30"];
    if ("cr_feedback" in d || "summary" in d) return ["Reflection / CR", "text-amber-300 bg-amber-400/10 border-amber-400/30"];
  }
  return ["Packet", "text-neutral-300 bg-white/5 border-white/15"];
};

export default function FlowPanel({ open, onToggle, events, live, moving, fill }) {
  const tiles = [
    ["Movement", live.movement.length ? live.movement.join(", ") : "none"],
    ["Frame", live.frame || "main", moving],
    ["Expression", live.expression || "neutral"],
  ];
  return (
    <section className={`flex min-h-0 flex-col border-t border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-bg))] ${fill ? "flex-1" : "max-h-[45%] shrink-0"}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[.03]">
        <span className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[rgb(var(--vx-accent)/0.15)] text-[rgb(var(--vx-accent))]"><Activity className="size-5" /></span>
          <span>
            <span className="block font-semibold">Received from the flow</span>
            <span className="block text-xs text-[rgb(var(--vx-muted))]">Developer view · {events.length} packet{events.length === 1 ? "" : "s"}</span>
          </span>
        </span>
        <ChevronDown className={`size-5 text-[rgb(var(--vx-muted))] transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5">
          <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-2xl">
            {tiles.map(([k, v, hot]) => (
              <div key={k} className={`min-w-0 px-3 py-2.5 ${hot ? "bg-emerald-500/15" : "bg-[rgb(var(--vx-card))]"}`}>
                <p className="text-xs text-[rgb(var(--vx-muted))]">{k}</p>
                <p className={`truncate font-mono text-sm ${hot ? "text-emerald-300" : ""}`} title={v}>{v}</p>
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {events.length === 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-[rgb(var(--vx-line))] px-4 py-8 text-center text-sm text-[rgb(var(--vx-muted))]">
                <Radio className="mb-2 size-6 opacity-60" /> Packets appear here as the flow sends them.
              </div>
            )}
            {events.map((e, i) => {
              const [kind, tone] = kindOf(e.data);
              const body = typeof e.data === "string" ? e.data : JSON.stringify(e.data, null, 2);
              return (
                <details key={events.length - i} className="vr-in rounded-xl bg-[rgb(var(--vx-card))] open:ring-1 open:ring-[rgb(var(--vx-line))]">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-xs ${tone}`}>{kind}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-[rgb(var(--vx-muted))]">{body.replace(/\s+/g, " ")}</span>
                    <span className="shrink-0 font-mono text-xs text-[rgb(var(--vx-muted))]">{e.at}</span>
                  </summary>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-[rgb(var(--vx-line))] px-3 py-2 font-mono text-xs leading-relaxed">{body}</pre>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
