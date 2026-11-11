// A student's scenarios in the vx design: one toolbar (search, to do / done, sort), cards, pages.
// Same data as before: /api/scenarios filtered to this student, plus /api/dashboard/student-stats.
import React, { useState, useEffect, useMemo } from "react";
import { fetchCached } from "../lib/query";
import axios from "axios";
import { useAuth } from "../AuthContext.jsx";
import { getAuthHeaders, cn } from "../lib/utils.js";
import { isAssignedToStudent } from "../lib/assignment.js";
import ScenarioGridStudent from "../roles/student/scenarios/ScenrioGridStudent.jsx";
import { ListToolbar, ToolbarToggle, Pagination } from "./vx/list";
import { Select } from "./vx/bits";
import "./vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";

export default function StudentScenariosPage() {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState(null);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("");
  const [sort, setSort] = useState("todo");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      // Through the TanStack cache: shared with the dashboard, so no second load.
      fetchCached("/api/dashboard/student-stats").then((data) => ({ data })),
      fetchCached("/api/scenarios", { fields: "lite" }).then((data) => ({ data })),
      fetchCached("/api/sessions/mine").then((data) => ({ data })).catch(() => ({ data: [] })),
    ]).then(([statsRes, scenRes, mineRes]) => {
      const mine = mineRes.data || [];
      const stats = statsRes.data;
      const list = Array.isArray(scenRes.data) ? scenRes.data : scenRes.data?.items || [];
      setScenarios(list.filter((s) => isAssignedToStudent(s, user)).map((s) => {
        const st = stats.scenarioScores?.find((x) => x.scenarioId === s._id);
        return {
          id: s._id, scenarioName: s.scenarioName, description: s.description || "", difficulty: s.difficulty,
          highestScore: st?.bestScore != null ? Math.round(st.bestScore * 100) : null,
          status: st?.isCompleted ? "Completed" : "Available", testable: s.testable === true,
          attempts: mine.filter((m) => m.scenarioId === s._id).length,
          lastAt: mine.find((m) => m.scenarioId === s._id)?.createdAt || null,
        };
      }));
    }).catch(() => setScenarios([]));
  }, [user]);

  const rows = useMemo(() => {
    let r = [...(scenarios || [])];
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((s) => `${s.scenarioName} ${s.description}`.toLowerCase().includes(q));
    if (show === "todo") r = r.filter((s) => s.status !== "Completed");
    if (show === "done") r = r.filter((s) => s.status === "Completed");
    const by = {
      todo: (a, b) => (a.status === "Completed") - (b.status === "Completed") || (b.testable - a.testable),
      best: (a, b) => (b.highestScore ?? -1) - (a.highestScore ?? -1),
      low: (a, b) => (a.highestScore ?? 101) - (b.highestScore ?? 101),
      name: (a, b) => a.scenarioName.localeCompare(b.scenarioName),
      recent: (a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0),
    }[sort];
    return r.sort(by);
  }, [scenarios, search, show, sort]);

  useEffect(() => setPage(1), [search, show, sort, pageSize]);
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);
  const done = (scenarios || []).filter((s) => s.status === "Completed").length;

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="flex items-baseline gap-3 text-3xl font-semibold tracking-tight">
            Scenarios {scenarios?.length > 0 && <span className={cn("tabular-nums", muted)}>{done} of {scenarios.length} done</span>}
          </h1>
        </header>

        <ListToolbar
          search={{ value: search, onChange: setSearch, placeholder: "Search scenarios" }}
          filters={
            <>
              <ToolbarToggle label="Show" value={show} onChange={setShow}
                options={[{ value: "", label: "All" }, { value: "todo", label: "To do" }, { value: "done", label: "Done" }]} />
              <div className="px-1">
                <Select variant="ghost" label="Sort" value={sort} onChange={setSort}
                  options={[{ value: "todo", label: "To do first" }, { value: "best", label: "Best score" }, { value: "low", label: "Lowest score" }, { value: "recent", label: "Recently practised" }, { value: "name", label: "Name" }]} />
              </div>
            </>
          }
        />

        {scenarios === null ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]" />)}
          </div>
        ) : (
          <div>
            <ScenarioGridStudent data={shown} />
            <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={setPageSize} />
          </div>
        )}
      </div>
    </div>
  );
}
