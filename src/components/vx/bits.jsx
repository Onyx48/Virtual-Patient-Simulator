// Small shared pieces for the educator screens (docs/EDUCATOR_SCREENS.md): copy with a tick,
// relative time, CSV download, mailto building and selection checkboxes.
import React, { useState } from "react";
import { Check, ChevronDown, Copy, MoreHorizontal } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "../../lib/utils";
import { Link } from "../../lib/router";

export async function copyText(text, what = "Copied") {
  try {
    await navigator.clipboard.writeText(String(text));
    toast.success(what, { duration: 1500 });
    return true;
  } catch {
    toast.error("Could not copy. Select the text and copy it instead.");
    return false;
  }
}

/** A small icon button that copies `value` and shows a tick for a moment. Stops the click reaching a row. */
export function CopyButton({ value, label = "Copy", toastText, className, size = 15 }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={label} title={label}
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyText(value, toastText || `${label.replace(/^Copy /, "")} copied`)) {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }
      }}
      className={cn("inline-grid size-7 shrink-0 place-items-center rounded-full text-[rgb(var(--vx-muted))] transition-colors hover:bg-[rgb(var(--vx-cell))] hover:text-[rgb(var(--vx-ink))]", className)}>
      {done ? <Check size={size} className="text-[rgb(var(--vx-ok))]" /> : <Copy size={size} />}
    </button>
  );
}

const RTF = typeof Intl !== "undefined" && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;

/** "just now", "3 hours ago", "yesterday", "2 weeks ago". null for no date. */
export function timeAgo(date) {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  const s = Math.round((t - Date.now()) / 1000);
  const a = Math.abs(s);
  if (a < 45) return "just now";
  const steps = [[60, "second", 1], [3600, "minute", 60], [86400, "hour", 3600], [604800, "day", 86400], [2629800, "week", 604800], [31557600, "month", 2629800], [Infinity, "year", 31557600]];
  for (const [limit, unit, div] of steps) {
    if (a < limit) return RTF ? RTF.format(Math.round(s / div), unit) : `${Math.round(a / div)} ${unit}s ago`;
  }
  return null;
}
export const fullDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

/** <time> with a relative label and the full date on hover. */
export function Ago({ date, fallback = "Never", className }) {
  const label = timeAgo(date);
  if (!label) return <span className={className}>{fallback}</span>;
  return <time dateTime={new Date(date).toISOString()} title={fullDate(date)} className={className}>{label}</time>;
}

/** Download rows as a CSV that opens cleanly in Excel (BOM, quoted cells). */
export function downloadCsv(filename, columns, rows) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(","))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** mailto: link. Long BCC lists are fine for mail clients up to ~2000 chars; past that, copy the list instead. */
export function mailto({ to = [], bcc = [], subject = "", body = "" }) {
  const q = new URLSearchParams();
  if (bcc.length) q.set("bcc", bcc.join(","));
  if (subject) q.set("subject", subject);
  if (body) q.set("body", body);
  return `mailto:${to.map(encodeURIComponent).join(",")}?${q.toString().replace(/\+/g, "%20")}`;
}

/** A square checkbox in the vx style. `indeterminate` shows a dash. */
export function Tick({ checked, indeterminate, onChange, label, className }) {
  return (
    <button type="button" role="checkbox" aria-checked={indeterminate ? "mixed" : !!checked} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange?.(e); }}
      className={cn("grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
        checked || indeterminate ? "border-[rgb(var(--vx-accent))] bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "border-[rgb(var(--vx-muted)/0.5)] hover:border-[rgb(var(--vx-accent))]",
        className)}>
      {indeterminate ? <span className="h-0.5 w-2.5 rounded bg-current" /> : checked ? <Check size={14} strokeWidth={3} /> : null}
    </button>
  );
}

/**
 * A ⋯ menu. `items`: [{ label, icon, onClick, danger, disabled, hidden }] or "sep".
 * Closes on outside click, Esc, or after an item runs. Clicks never reach the card or row under it.
 */
export function Menu({ items, label = "More actions", align = "right", className }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const shown = items.filter((i) => i === "sep" || !i.hidden);
  return (
    <div ref={ref} className={cn("relative", className)} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={cn("grid size-9 place-items-center rounded-full text-[rgb(var(--vx-muted))] transition-colors hover:bg-[rgb(var(--vx-cell))] hover:text-[rgb(var(--vx-ink))]", open && "bg-[rgb(var(--vx-cell))]")}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div role="menu" className={cn("absolute top-full z-40 mt-1 min-w-[13rem] rounded-2xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] p-1.5 shadow-xl", align === "right" ? "right-0" : "left-0")}>
          {shown.map((it, i) => it === "sep" ? (
            <div key={`s${i}`} className="my-1 border-t border-[rgb(var(--vx-line)/0.7)]" />
          ) : (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick?.(); }}
              className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-base transition-colors disabled:pointer-events-none disabled:opacity-40",
                it.danger ? "text-[rgb(var(--vx-danger))] hover:bg-[rgb(var(--vx-danger)/0.08)]" : "hover:bg-[rgb(var(--vx-cell))]")}>
              {it.icon && <it.icon size={17} className={it.danger ? "" : "text-[rgb(var(--vx-muted))]"} />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A select in the vx style: a pill trigger and a rounded list. Keyboard: Enter/Space/↓ open,
 * ↑/↓ move, Enter picks, Esc closes, typing jumps to the first label that starts with it.
 * `options`: [{ value, label, hint? }]. `size`: "sm" (h-9) or "md" (h-11).
 */
export function Select({ value, onChange, options, label, placeholder = "Choose", size = "md", className, align = "left", variant = "cell" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = React.useRef(null);
  const listRef = React.useRef(null);
  const current = options.find((o) => String(o.value) === String(value));
  React.useEffect(() => {
    if (!open) return undefined;
    setActive(Math.max(0, options.findIndex((o) => String(o.value) === String(value))));
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  const pick = (o) => { onChange(o.value); setOpen(false); };
  const onKeyDown = (e) => {
    if (!open && ["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[active]) pick(options[active]); }
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => String(o.label).toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };
  const h = size === "sm" ? "h-9 text-sm" : "h-11 text-base";
  return (
    <div ref={ref} className={cn("relative inline-flex", className)} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} onKeyDown={onKeyDown}
        className={cn("inline-flex w-full items-center justify-between gap-2 rounded-full pl-4 pr-3 font-medium leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[rgb(var(--vx-accent))]",
          h, variant === "cell" ? "bg-[rgb(var(--vx-cell))] hover:bg-[rgb(var(--vx-cell)/0.7)]" : "bg-transparent hover:bg-[rgb(var(--vx-cell)/0.6)]",
          !current && "text-[rgb(var(--vx-muted))]")}>
        <span className="truncate">{current ? current.label : placeholder}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-[rgb(var(--vx-muted))] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul ref={listRef} role="listbox" aria-label={label}
          className={cn("absolute top-full z-50 mt-1.5 max-h-72 min-w-full overflow-y-auto rounded-2xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] p-1.5 shadow-xl", align === "right" ? "right-0" : "left-0")}>
          {options.map((o, i) => {
            const on = String(o.value) === String(value);
            return (
              <li key={String(o.value)} role="option" aria-selected={on} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                className={cn("flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-base", i === active && "bg-[rgb(var(--vx-cell))]", on && "font-semibold")}>
                <Check size={16} className={cn("shrink-0 text-[rgb(var(--vx-accent-text))]", !on && "invisible")} />
                <span className="flex-1">{o.label}</span>
                {o.hint != null && <span className="text-sm text-[rgb(var(--vx-muted))]">{o.hint}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A small percentage ring for table cells (after ci's mini-ring); null draws an empty ring. */
export function MiniRing({ value, size = 28 }) {
  const r = (size - 4) / 2, c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className="stroke-[rgb(var(--vx-cell))]" />
      {value != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="stroke-[rgb(var(--vx-accent))]" />}
    </svg>
  );
}

/**
 * One-time walkthrough for a screen (after ci's education intros): a few short steps, shown once
 * per browser. `id` names the screen; "Show me around" from the ? sheet can bring them back.
 */
export function Intro({ id, steps }) {
  const key = `vps.intro.${id}`;
  const [i, setI] = useState(() => { try { return localStorage.getItem(key) ? -1 : 0; } catch { return -1; } });
  if (i < 0 || !steps?.length) return null;
  const done = () => { try { localStorage.setItem(key, "1"); } catch { /* private window */ } setI(-1); };
  const s = steps[i];
  return (
    <div className="vx fixed bottom-6 left-1/2 z-[65] w-[min(92vw,30rem)] -translate-x-1/2 rounded-3xl border border-[rgb(var(--vx-accent)/0.5)] bg-[rgb(var(--vx-card))] p-5 shadow-2xl" role="dialog" aria-label="Quick tour">
      <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--vx-accent-text))]">Quick tour · {i + 1} of {steps.length}</p>
      <h3 className="mt-1 text-xl font-semibold">{s.title}</h3>
      <p className="mt-1 text-base text-[rgb(var(--vx-muted))]">{s.body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={done} className="text-sm font-medium text-[rgb(var(--vx-muted))] hover:text-[rgb(var(--vx-ink))]">Skip</button>
        <div className="flex items-center gap-3">
          <span className="flex gap-1">{steps.map((_, j) => <span key={j} className={cn("size-1.5 rounded-full", j === i ? "bg-[rgb(var(--vx-accent))]" : "bg-[rgb(var(--vx-line))]")} />)}</span>
          <button type="button" onClick={() => (i + 1 < steps.length ? setI(i + 1) : done())}
            className="h-9 rounded-full bg-[rgb(var(--vx-accent))] px-4 text-sm font-semibold text-[rgb(var(--vx-on-accent))]">{i + 1 < steps.length ? "Next" : "Got it"}</button>
        </div>
      </div>
    </div>
  );
}

/*
 * "How is this calculated?" (VPS dashboard review, UI17): a small i next to a number that opens a
 * plain-language rule. `title` names the measure; children are the explanation. Closes on outside click or Escape.
 */
export function Info({ title, children, align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex print:hidden" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label={`How is ${title || "this"} calculated?`} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={cn("grid size-5 place-items-center rounded-full border text-[11px] font-semibold leading-none transition-colors",
          open ? "border-[rgb(var(--vx-accent))] bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "border-[rgb(var(--vx-line))] text-[rgb(var(--vx-muted))] hover:border-[rgb(var(--vx-accent))] hover:text-[rgb(var(--vx-ink))]")}>
        i
      </button>
      {open && (
        <span role="dialog" className={cn("absolute top-7 z-50 w-[28rem] max-w-[85vw] rounded-2xl border border-[rgb(var(--vx-line)/0.8)] bg-[rgb(var(--vx-card))] p-4 text-left shadow-xl",
          align === "right" ? "right-0" : "left-0")}>
          {title && <span className="mb-1 block text-sm font-semibold text-[rgb(var(--vx-ink))]">{title}</span>}
          <span className="block text-sm font-normal leading-relaxed text-[rgb(var(--vx-muted))]">{children}</span>
          <Link to="/definitions" className="mt-2 inline-block text-sm font-medium text-[rgb(var(--vx-accent-text))] hover:underline">All definitions →</Link>
        </span>
      )}
    </span>
  );
}

/* Activity from the last scored session: active ≤14 days, at risk 15–30, inactive >30 (backend/utils/learning.js). */
export const ACTIVITY = {
  active: { label: "Active", dot: "bg-[rgb(var(--vx-ok))]", text: "text-[rgb(var(--vx-ok))]" },
  atrisk: { label: "At risk", dot: "bg-[rgb(var(--vx-warn))]", text: "text-[rgb(var(--vx-warn))]" },
  inactive: { label: "Inactive", dot: "bg-[rgb(var(--vx-danger))]", text: "text-[rgb(var(--vx-danger))]" },
  new: { label: "Not started", dot: "bg-[rgb(var(--vx-line))]", text: "text-[rgb(var(--vx-muted))]" },
};
export function activityOf(lastAt) {
  if (!lastAt) return "new";
  const days = (Date.now() - new Date(lastAt).getTime()) / 86400000;
  return days <= 14 ? "active" : days <= 30 ? "atrisk" : "inactive";
}
export function ActivityDot({ lastAt, status, withLabel = false, className }) {
  const k = status || activityOf(lastAt);
  const a = ACTIVITY[k];
  const tip = lastAt ? `${a.label} · last session ${timeAgo(lastAt)}` : a.label;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={tip}>
      <span className={cn("size-2 shrink-0 rounded-full", a.dot)} aria-hidden />
      {withLabel ? <span className={cn("text-sm font-medium", a.text)}>{a.label}</span> : <span className="sr-only">{a.label}</span>}
    </span>
  );
}
