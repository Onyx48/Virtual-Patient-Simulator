// Shared controls after ci/internal-shortlisting (docs/DESIGN_SYSTEM.md §4-6), in our own accent.
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "../../lib/utils";
import "./vx.css";

const VARIANTS = {
  default: "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]",
  soft: "border border-[rgb(var(--vx-accent))] bg-[rgb(var(--vx-accent)/0.12)] text-[rgb(var(--vx-ink))]",
  secondary: "bg-[rgb(var(--vx-cell))] text-[rgb(var(--vx-ink))]",
  outline: "border border-[rgb(var(--vx-ink)/0.25)] bg-transparent hover:border-[rgb(var(--vx-accent))] hover:bg-[rgb(var(--vx-accent)/0.10)]",
  ghost: "bg-transparent text-[rgb(var(--vx-ink))]",
  destructive: "bg-[rgb(var(--vx-danger)/0.12)] text-[rgb(var(--vx-danger))]",
};
const SIZES = {
  sm: "h-9 rounded-[18px] px-4 text-sm [&_svg]:size-[18px]",
  default: "h-10 rounded-[20px] px-6 text-sm [&_svg]:size-[18px]",
  lg: "h-12 rounded-[24px] px-6 text-base [&_svg]:size-5",
};

/** M3 pill: squares off while pressed, with a state layer on hover and press. */
export function Button({ variant = "default", size = "default", className, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap font-medium",
        "transition-[border-radius,background-color,box-shadow] duration-200 ease-out",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-current after:opacity-0 after:transition-opacity hover:after:opacity-[.08] active:after:opacity-[.10]",
        "active:!rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--vx-ink))] focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:border-transparent disabled:bg-[rgb(var(--vx-ink)/0.12)] disabled:text-[rgb(var(--vx-ink)/0.38)]",
        VARIANTS[variant], SIZES[size], className,
      )}
    />
  );
}

/** Joined buttons: 2px apart, inner corners 8px, the outer ends stay round. */
export function ButtonGroup({ className, children }) {
  return (
    <div role="group" className={cn(
      "inline-flex items-stretch gap-0.5",
      "[&>*:not(:first-child)]:rounded-l-[8px] [&>*:not(:last-child)]:rounded-r-[8px]",
      className,
    )}>{children}</div>
  );
}

/** A joined toggle of two or three options. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <ButtonGroup className="w-full">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Button key={o.value} size="lg" variant={on ? "default" : "secondary"} aria-pressed={on}
            aria-label={label ? `${label}: ${o.label}` : undefined}
            className={cn("flex-1 px-5 text-base", !on && "bg-[rgb(var(--vx-card))]")} onClick={() => onChange(o.value)}>
            {o.label}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

/** Joined fields: stacked on phones, a row from md; outer ends rounded-2xl, inner 8px. */
export function InputGroup({ className, children, vertical }) {
  return (
    <div className={cn(
      "flex flex-col gap-0.5",
      "[&>*]:rounded-[8px] [&>*:first-child]:rounded-t-2xl [&>*:last-child]:rounded-b-2xl",
      !vertical && "md:flex-row md:[&>*:first-child]:rounded-[8px] md:[&>*:last-child]:rounded-[8px] md:[&>*:first-child]:rounded-l-2xl md:[&>*:last-child]:rounded-r-2xl",
      "[&>*:only-child]:!rounded-2xl",
      className,
    )}>{children}</div>
  );
}

/** A cell with its label inside. A press anywhere on it focuses its input. */
export function InputCell({ label, labelClass, hint, guide, className, children, htmlFor, as: Tag = "label" }) {
  return (
    <Tag htmlFor={Tag === "label" ? htmlFor : undefined} className={cn(
      "flex min-w-0 flex-col gap-1 bg-[rgb(var(--vx-cell)/0.6)] px-4 pb-2 pt-2.5 transition-[background-color,box-shadow]",
      "focus-within:bg-[rgb(var(--vx-cell))] focus-within:ring-2 focus-within:ring-[rgb(var(--vx-accent))]",
      Tag === "label" && "cursor-text",
      guide && "bg-[rgb(var(--vx-accent)/0.05)] ring-2 ring-[rgb(var(--vx-accent)/0.4)]",
      className,
    )}>
      <span className={cn("text-sm font-medium text-[rgb(var(--vx-muted))]", labelClass)}>{label}</span>
      {children}
      {hint && <span className="text-xs text-[rgb(var(--vx-muted))]">{hint}</span>}
    </Tag>
  );
}

export const controlClass =
  "w-full border-0 bg-transparent p-0 text-[rgb(var(--vx-ink))] shadow-none outline-none placeholder:text-[rgb(var(--vx-muted)/0.8)] focus:ring-0";

/** A textarea that grows with its content up to maxVh of the window. */
export function AutoTextarea({ value, className, maxVh = 40, minPx = 144, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(minPx, Math.min(el.scrollHeight, window.innerHeight * (maxVh / 100))) + "px";
  }, [value, maxVh, minPx]);
  return <textarea ref={ref} value={value} {...props} className={cn(controlClass, "resize-none", className)} />;
}

export function Expand({ open, tall, children }) {
  return (
    <div className={cn("vx-expand", tall && "vx-tall")} data-open={open ? "true" : "false"} inert={open ? undefined : ""}>
      <div>{children}</div>
    </div>
  );
}

export function Section({ title, hint, actions, className, children, open = true, onToggle }) {
  const head = (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {onToggle && <ChevronDown aria-hidden className={cn("size-6 text-[rgb(var(--vx-muted))] transition-transform duration-200", open && "rotate-180")} />}
    </>
  );
  return (
    <section className={cn("rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5 md:p-6", onToggle && !open && "cursor-pointer hover:border-[rgb(var(--vx-accent)/0.6)]", className)}
      onClick={onToggle && !open ? onToggle : undefined}>
      <div className={cn("flex flex-wrap items-start justify-between gap-3 transition-[margin]", open ? "mb-4" : "mb-0", onToggle && "cursor-pointer select-none")}
        onClick={onToggle ? (e) => { e.stopPropagation(); if (!e.target.closest("a,input,textarea,button,[data-no-toggle]")) onToggle(); } : undefined}>
        <div>
          {onToggle
            ? <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-expanded={open} className="flex items-center gap-2 text-left">{head}</button>
            : head}
          {hint && <p className="mt-0.5 text-sm text-[rgb(var(--vx-muted))]">{hint}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Modal shell: blurred backdrop, a cream panel, title + optional subtitle, round close. Esc and a backdrop click close it. */
export function Dialog({ title, subtitle, onClose, footer, size = "md", z = "z-50", children, bodyClass }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-4xl", xl: "max-w-6xl", full: "max-w-[min(96vw,1680px)]" }[size];
  return (
    <div className={cn("vx fixed inset-0 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm", z)} style={{ background: "rgb(0 0 0 / 0.4)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
        className={cn("flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl bg-[rgb(var(--vx-bg))] text-[rgb(var(--vx-ink))] shadow-2xl", width)}>
        <div className="flex shrink-0 items-start justify-between gap-3 px-6 pb-3 pt-6">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-base text-[rgb(var(--vx-muted))]">{subtitle}</p>}
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-full text-[rgb(var(--vx-muted))] transition-colors hover:bg-[rgb(var(--vx-cell))] hover:text-[rgb(var(--vx-ink))]">
              <X size={20} />
            </button>
          )}
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-6", bodyClass)}>{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[rgb(var(--vx-line)/0.7)] px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * A table row action: just the icon, and on hover or keyboard focus the label slides out beside it
 * (after ci/internal-shortlisting). Use several inside a ButtonGroup.
 */
export function ActionButton({ icon: Icon, label, variant = "secondary", busy, className, ...props }) {
  return (
    <Button variant={variant} size="sm" aria-label={label} {...props}
      className={cn("group/act gap-0 px-2.5 [&_svg]:shrink-0", className)}>
      {busy ? <span className="size-[18px] animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Icon />}
      <span className="grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity,margin] duration-300 ease-out group-hover/act:ml-2 group-hover/act:grid-cols-[1fr] group-hover/act:opacity-100 group-focus-visible/act:ml-2 group-focus-visible/act:grid-cols-[1fr] group-focus-visible/act:opacity-100 motion-reduce:transition-none">
        <span className="overflow-hidden whitespace-nowrap">{label}</span>
      </span>
    </Button>
  );
}

/**
 * A table row's actions, the same in every table: icon buttons joined, each sliding its label out on
 * hover. The cell keeps room for one open label, so it never pushes past the table edge.
 *   <RowActions items={[{ icon: Pencil, label: "Edit", onClick }, { icon: Trash2, label: "Delete", danger: true, onClick }]} />
 */
export function RowActions({ items }) {
  const shown = items.filter((a) => a && !a.hidden);
  return (
    <div className="flex justify-end" style={{ minWidth: shown.length * 42 + 120 }} onClick={(e) => e.stopPropagation()}>
      <ButtonGroup>
        {shown.map((a) => (
          <ActionButton key={a.label} icon={a.icon} label={a.label} variant={a.danger ? "destructive" : a.primary ? "default" : "secondary"}
            busy={a.busy} disabled={a.disabled || a.busy} onClick={a.onClick} />
        ))}
      </ButtonGroup>
    </div>
  );
}
