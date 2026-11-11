// Header search across students and scenarios (docs/EDUCATOR_SCREENS.md, "Everywhere").
// "/" focuses it, arrows move, Enter opens, Esc closes. Uses the paged list endpoints, 5 of each.
import React, { useEffect, useRef, useState } from "react";
import { fetchCached } from "../../lib/query";
import { useNavigate } from "../../lib/router";
import axios from "axios";
import { Search, Users, BookOpen, Loader2, Building2 } from "lucide-react";
import { cn } from "../../lib/utils";

const muted = "text-[rgb(var(--vx-muted))]";
const typing = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export default function GlobalSearch({ role }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const canStudents = role === "educator" || role === "school_admin" || role === "superadmin";
  const canScenarios = role !== "superadmin";
  const canSchools = role === "superadmin";

  // "/" anywhere outside a field focuses search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !typing(document.activeElement) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Debounced fetch of both lists.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return undefined; }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const params = { searchTerm: term, page: 1, limit: 5 };
      const [st, sc, sch] = await Promise.all([
        canStudents ? fetchCached("/api/students", params).then((d) => d.items || []).catch(() => []) : [],
        canScenarios ? fetchCached("/api/scenarios", params).then((d) => d.items || []).catch(() => []) : [],
        canSchools ? fetchCached("/api/schools", params).then((d) => d.items || []).catch(() => []) : [],
      ]);
      if (!alive) return;
      setResults([
        ...sch.map((s) => ({ kind: "school", id: s._id, title: s.schoolName, sub: s.status || "", go: () => navigate(`/schools/${s._id}`) })),
        ...st.map((s) => ({ kind: "student", id: s._id, title: s.name || s.email, sub: s.email, go: () => navigate(`/students?q=${encodeURIComponent(s.name || s.email)}`) })),
        ...sc.map((s) => ({ kind: "scenario", id: s._id, title: s.scenarioName || "Untitled", sub: s.status || "Draft",
          go: () => navigate(role === "student" ? `/student/scenario/${s._id}` : `/scenarios/edit/${s._id}`) })),
      ]);
      setActive(0);
      setBusy(false);
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [q, canStudents, canScenarios, canSchools, navigate, role]);

  const pick = (r) => { r.go(); setOpen(false); setQ(""); inputRef.current?.blur(); };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { setOpen(false); e.currentTarget.blur(); return; }
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    if (e.key === "Enter") { e.preventDefault(); pick(results[active]); }
  };

  const groups = [
    ["school", "Schools", Building2],
    ["student", "Students", Users],
    ["scenario", "Scenarios", BookOpen],
  ];

  return (
    <div ref={boxRef} className="relative hidden w-full max-w-sm md:block">
      <Search size={17} className={cn("pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2", muted)} />
      <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
        placeholder={canSchools ? "Search schools and students" : canStudents ? "Search students and scenarios" : "Search scenarios"} aria-label="Search"
        className="h-10 w-full rounded-full border-0 bg-[rgb(var(--vx-cell))] pl-10 pr-10 text-sm outline-none placeholder:text-[rgb(var(--vx-muted))] focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
      <kbd className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-[rgb(var(--vx-line))] px-1.5 text-xs", muted)}>/</kbd>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[rgb(var(--vx-line))] bg-[rgb(var(--vx-card))] p-1.5 shadow-xl">
          {busy && !results.length ? (
            <p className={cn("flex items-center gap-2 px-3 py-3 text-sm", muted)}><Loader2 size={16} className="animate-spin" /> Searching…</p>
          ) : !results.length ? (
            <p className={cn("px-3 py-3 text-sm", muted)}>Nothing matches “{q.trim()}”.</p>
          ) : groups.map(([kind, label, Icon]) => {
            const list = results.filter((r) => r.kind === kind);
            if (!list.length) return null;
            return (
              <div key={kind}>
                <p className={cn("px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide", muted)}>{label}</p>
                {list.map((r) => {
                  const i = results.indexOf(r);
                  return (
                    <button key={`${kind}${r.id}`} type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(r)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", i === active && "bg-[rgb(var(--vx-accent)/0.12)]")}>
                      <Icon size={16} className={muted} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        <span className={cn("block truncate text-xs", muted)}>{r.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
