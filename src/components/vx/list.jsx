// List furniture after ci/internal-shortlisting: ListToolbar (components/ui/list-toolbar.tsx)
// and TablePagination (components/education/table-pagination.tsx), in our accent.
import React from "react";
import { usePagedRows } from "../../lib/hooks/usePagedRows";
import { Search, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import "./vx.css";
import { Select } from "./bits";

/*
 * One bar: view switch, search taking the spare width, then filters, each a cell 2px apart
 * with small inner corners and round outer ends. The page's action sits on the right.
 */
export function ListToolbar({ view, search, filters, actions }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" className={cn(
        "flex min-w-0 flex-1 flex-wrap items-stretch gap-0.5",
        "[&>*]:flex [&>*]:min-h-11 [&>*]:items-center [&>*]:rounded-[8px] [&>*]:bg-[rgb(var(--vx-cell))] [&>*]:ring-1 [&>*]:ring-inset [&>*]:ring-[rgb(var(--vx-line)/0.7)]",
        "[&>*:first-child]:rounded-l-[22px] [&>*:last-child]:rounded-r-[22px]",
      )}>
        {view}
        {search && (
          <label className="relative min-w-[12rem] flex-1 cursor-text px-0 focus-within:ring-2 focus-within:ring-[rgb(var(--vx-accent))] max-md:basis-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[rgb(var(--vx-muted))]" />
            <input value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder}
              aria-label={search.placeholder} autoComplete="off"
              className="h-11 w-full border-0 bg-transparent pl-11 pr-10 text-base outline-none placeholder:text-[rgb(var(--vx-muted)/0.8)] focus:ring-0" />
            {search.value && (
              <button type="button" onClick={() => search.onChange("")} aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[rgb(var(--vx-muted))] hover:bg-[rgb(var(--vx-bg))]">
                <X size={16} />
              </button>
            )}
          </label>
        )}
        {filters}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * A toggle whose buttons become cells of the toolbar themselves. The pressed one rounds
 * fully and fills with the accent. `icon` items show only their icon, with the label for
 * screen readers.
 */
export function ToolbarToggle({ value, onChange, options, label }) {
  return (
    // Joined segments (the app's ButtonGroup): 2px apart, inner corners 8px, the two ends round.
    // !important on the group so older wrappers that painted a pill "track" behind it stay clear.
    <div role="group" aria-label={label} className="!flex !h-auto !gap-0.5 !rounded-none !bg-transparent !p-0">
      {options.map((o, i) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button key={o.value} type="button" aria-pressed={on} aria-label={Icon ? o.label : undefined} title={Icon ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-4 text-base font-medium leading-none transition-[background-color,border-radius,color] duration-200 active:rounded-[4px]",
              i === 0 && "rounded-l-[20px]", i === options.length - 1 && "rounded-r-[20px]",
              on ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "bg-[rgb(var(--vx-cell))] text-[rgb(var(--vx-ink))] hover:bg-[rgb(var(--vx-ink)/0.1)]",
              Icon && "w-11 px-0",
            )}>
            {Icon ? <Icon size={18} /> : o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Up to `span` page numbers around the current one, with a gap where pages are hidden. 1-based. */
function pageWindow(page, pages, span = 5) {
  if (pages <= span + 2) return Array.from({ length: pages }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(page - Math.floor(span / 2), pages - span + 1));
  const run = Array.from({ length: span }, (_, i) => start + i);
  return [...(start > 1 ? ["gap-a"] : []), ...run, ...(start + span <= pages ? ["gap-b"] : [])];
}

function PageButton({ onClick, disabled, label, active, children }) {
  return (
    <button type="button" aria-label={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick}
      className={cn(
        "grid size-10 place-items-center rounded-full text-base font-medium tabular-nums transition-[background-color,transform] active:scale-95 disabled:pointer-events-none disabled:opacity-35",
        active ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))] shadow-sm" : "hover:bg-[rgb(var(--vx-card))]",
      )}>
      {children}
    </button>
  );
}

/** Rows per page on the left, "Showing 9–16 of 40" and the page buttons on the right. */
export function Pagination({ page, pageSize, total, onPage, onPageSize, sizes = [10, 20, 50, 100] }) {
  if (total <= sizes[0] && pageSize <= sizes[0]) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 border-t border-[rgb(var(--vx-line)/0.7)] py-4">
      {onPageSize && (
        <label className="vx-join h-11">
          <span className="flex items-center bg-[rgb(var(--vx-cell))] px-4 text-sm text-[rgb(var(--vx-muted))]">Rows</span>
          <Select size="sm" label="Rows per page" value={pageSize} onChange={(n) => onPageSize(Number(n))} className="[&>button]:bg-[rgb(var(--vx-card))]"
              options={sizes.map((n) => ({ value: n, label: String(n) }))} />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <p className="whitespace-nowrap text-sm text-[rgb(var(--vx-muted))]" aria-live="polite">
          Showing <span className="font-semibold tabular-nums text-[rgb(var(--vx-ink))]">{from}–{to}</span> of{" "}
          <span className="font-semibold tabular-nums text-[rgb(var(--vx-ink))]">{total}</span>
        </p>
        <nav aria-label="Pages" className="flex items-center gap-1 rounded-full bg-[rgb(var(--vx-cell))] p-1">
          <PageButton label="First page" disabled={page === 1} onClick={() => onPage(1)}><ChevronsLeft size={18} /></PageButton>
          <PageButton label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft size={18} /></PageButton>
          {pageWindow(page, pages).map((n) =>
            typeof n === "string" ? (
              <span key={n} className="grid size-10 place-items-center text-[rgb(var(--vx-muted))]" aria-hidden><MoreHorizontal size={18} /></span>
            ) : (
              <PageButton key={n} label={`Page ${n}`} active={n === page} onClick={() => onPage(n)}>{n}</PageButton>
            ))}
          <PageButton label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={18} /></PageButton>
          <PageButton label="Last page" disabled={page >= pages} onClick={() => onPage(pages)}><ChevronsRight size={18} /></PageButton>
        </nav>
      </div>
    </div>
  );
}

/**
 * Pages any in-memory list without a hook in the caller (safe below an early return):
 *   <Paged rows={list} size={16}>{(page) => <table>…{page.map(…)}…</table>}</Paged>
 */
export function Paged({ rows, size = 10, children }) {
  const pg = usePagedRows(rows, size);
  return (
    <>
      {children(pg.rows)}
      <Pagination {...pg.bind} />
    </>
  );
}
