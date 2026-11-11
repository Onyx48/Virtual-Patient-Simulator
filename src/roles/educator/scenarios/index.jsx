// Scenarios list in the vx design: one toolbar (view, search, status), cards or a table,
// and the pagination footer, after ci/internal-shortlisting's openings board.
import React, { useEffect, useState } from "react";
import { useData, fetchCached } from "../../../lib/query";
import { useDispatch } from "react-redux";
import { useNavigate } from "../../../lib/router";
import axios from "axios";
import toast from "react-hot-toast";
import { Plus, Pencil, Eye, Play, Loader2, LayoutGrid, Rows3, ArrowUp, ArrowDown, CopyPlus, Send, EyeOff, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Menu, Ago, Select } from "../../../components/vx/bits";
import ConfirmationModal from "../../../components/ui/ConfirmationModal";
import { BarChart3, ClipboardList } from "lucide-react";
import ScenarioInsights from "../../../components/shared/ScenarioInsights";
import AssignScenariosModal from "../../../components/shared/AssignScenariosModal";
import { useAuth } from "../../../AuthContext";
import { useServerPagination } from "../../../lib/hooks/useServerPagination";
import { snapSize } from "../../../lib/hooks/usePagedRows";
import { setSelectedScenario } from "../../../redux/slices/scenarioSlice.js";
import { Button, ButtonGroup, RowActions } from "../../../components/vx/ui";
import { ListToolbar, ToolbarToggle, Pagination } from "../../../components/vx/list";
import { cn } from "../../../lib/utils";

const muted = "text-[rgb(var(--vx-muted))]";
const VIEW_KEY = "vps.scenarios.view";

// Only scenarios the backend has enabled can open in the simulator (backend/utils/testableScenarios.js).
const isTestable = (s) => s?.testable === true;
const idOf = (s) => s._id || s.id;
const norm = (t) => String(t || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const blurb = (s) => (s.description && norm(s.description) !== norm(s.scenarioName) ? s.description : "");

const STATUS_STYLE = {
  published: "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]",
  draft: "bg-[rgb(var(--vx-cell))] text-[rgb(var(--vx-ink))]",
  archived: "bg-[rgb(var(--vx-cell))] text-[rgb(var(--vx-muted))]",
};
function StatusChip({ status }) {
  const k = String(status || "Draft").toLowerCase();
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-medium", STATUS_STYLE[k] || STATUS_STYLE.draft)}>
      {k === "published" && <span className="size-2 rounded-full bg-current" />}
      {k.charAt(0).toUpperCase() + k.slice(1)}
    </span>
  );
}

const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;
const facts = (s) => [
  plural(s.assignedTo?.length || 0, "student"),
  s.assignedGroups?.length ? plural(s.assignedGroups.length, "group") : null,
  s.totalSessions > 0 ? plural(s.totalSessions, "session") : null,
  s.avgScore != null && s.totalSessions > 0 ? `avg ${Math.round(s.avgScore)}%` : null,
].filter(Boolean).join(" · ");

// What kind of case it is, at a glance: PT/OT, Singapore, difficulty.
function KindChips({ s }) {
  const chip = "rounded-full bg-[rgb(var(--vx-cell))] px-2.5 py-0.5 text-sm font-medium";
  const prof = s.profession === "occupational_therapy" ? "OT" : s.profession === "physiotherapy" ? "PT" : null;
  const diff = s.difficulty === "High" ? "Hard" : s.difficulty;
  return (
    <span className="flex flex-wrap gap-1.5">
      {prof && <span className={chip}>{prof}</span>}
      {s.locale === "sg" && <span className={chip}>Singapore</span>}
      {diff && <span className={cn(chip, "bg-transparent px-1 text-[rgb(var(--vx-muted))]")}>{diff}</span>}
    </span>
  );
}

// Fields a copy keeps. Assignments and status do not carry over: a copy starts as a private draft.
const COPY_FIELDS = ["description", "permissions", "template", "scenarioPrompt", "aiAvatarRole", "aiInstructions", "aiQuestions",
  "learningObjectives", "difficulty", "animationTriggers", "profession", "locale", "patientName", "patientGender", "language",
  "environment", "avatarModel", "html"];

function readView() {
  try { return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards"; } catch { return "cards"; }
}

export default function ScenariosPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "educator" || user?.role === "superadmin" || user?.role === "school_admin";
  // A school admin moderates (edit, archive, delete) but does not author or assign (rolePermissions.js).
  const isAdmin = user?.role === "school_admin";
  const canAuthor = canEdit && !isAdmin;
  const [educator, setEducator] = useState("");
  const educators = useData("/api/users", { params: { role: "educator" }, enabled: isAdmin, fallback: [], select: (r) => (r || []).map((u) => u.name).filter(Boolean).sort() }) || [];
  const [toDelete, setToDelete] = useState(null);

  const [view, setView] = useState(readView);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [pageSize, setPageSize] = useState(() => { try { return snapSize(Number(localStorage.getItem("vps.pageSize")) || 10); } catch { return 10; } });
  const [openingId, setOpeningId] = useState(null);

  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch { /* private window */ } }, [view]);

  const { paginatedData: rows, isInitialLoading, isLoading, error, currentPage, totalItems, handlePageChange, refetch } =
    useServerPagination("/api/scenarios", { params: { searchTerm: search, status, educatorName: educator }, pageSize, sortConfig });

  const edit = (s) => {
    if (!canEdit) return;
    dispatch(setSelectedScenario(s));
    navigate(`/scenarios/edit/${idOf(s)}`);
  };

  // The simulator reads whatever /api/scenarios/json last published, so Test publishes this one first.
  const test = async (s) => {
    if (openingId || !isTestable(s)) return;
    setOpeningId(idOf(s));
    try {
      const { data } = await axios.post("/api/scenarios/json", { scenarioId: idOf(s) });
      if (!data?.simulatorUrl) throw new Error("The server did not say where the simulator is.");
      window.location.assign(data.simulatorUrl);
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Could not open this scenario in the simulator.");
    } finally {
      setOpeningId(null);
    }
  };

  const [busyId, setBusyId] = useState(null);
  const [insight, setInsight] = useState(null);
  const [assignId, setAssignId] = useState(null);
  const setStatusOf = async (s, next) => {
    setBusyId(idOf(s));
    try {
      await axios.put(`/api/scenarios/${idOf(s)}`, { status: next });
      toast.success(next === "Published" ? "Published. Assigned students can practise it now." : next === "Archived" ? "Archived." : "Moved back to draft.");
      refetch();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not change the status.");
    } finally {
      setBusyId(null);
    }
  };
  const duplicate = async (s) => {
    setBusyId(idOf(s));
    try {
      const full = await fetchCached(`/api/scenarios/${idOf(s)}`);
      const body = { scenarioName: `${full.scenarioName || "Untitled"} (copy)`, status: "Draft" };
      COPY_FIELDS.forEach((k) => { if (full[k] !== undefined && full[k] !== null) body[k] = full[k]; });
      const { data: made } = await axios.post("/api/scenarios", body);
      toast.success("Copied as a draft.");
      const newId = made?._id || made?.scenario?._id;
      if (newId) navigate(`/scenarios/edit/${newId}`); else refetch();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not copy this scenario.");
    } finally {
      setBusyId(null);
    }
  };
  const menuFor = (s) => {
    const st = s.status || "Draft";
    return [
      { label: "Analytics", icon: BarChart3, onClick: () => navigate(`/scenarios/view/${idOf(s)}`) },
      { label: "Assign", icon: ClipboardList, onClick: () => setAssignId(idOf(s)), hidden: !canAuthor },
      { label: "Duplicate", icon: CopyPlus, onClick: () => duplicate(s), hidden: !canAuthor },
      { label: "Publish", icon: Send, onClick: () => setStatusOf(s, "Published"), hidden: !canEdit || st === "Published" },
      { label: "Move to draft", icon: EyeOff, onClick: () => setStatusOf(s, "Draft"), hidden: !canEdit || st !== "Published" },
      { label: "Archive", icon: Archive, onClick: () => setStatusOf(s, "Archived"), hidden: !canEdit || st === "Archived" },
      { label: "Restore to draft", icon: ArchiveRestore, onClick: () => setStatusOf(s, "Draft"), hidden: !canEdit || st !== "Archived" },
      { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(s), hidden: !isAdmin },
    ];
  };

  const sortBy = (key) =>
    setSortConfig((c) => (!c || c.key !== key ? { key, direction: "asc" } : c.direction === "asc" ? { key, direction: "desc" } : null));

  const Actions = ({ s, size = "default", full }) => (
    <ButtonGroup className={cn(full && "w-full")}>
      {canEdit && <Button variant="secondary" size={size} className={cn(full && "flex-1")} onClick={(e) => { e.stopPropagation(); if (s.status === "Published") navigate(`/scenarios/view/${idOf(s)}`); else edit(s); }}>{s.status === "Published" ? <><Eye /> View</> : <><Pencil /> Edit</>}</Button>}
      <Button size={size} className={cn(full && "flex-1")} disabled={!isTestable(s) || openingId === idOf(s)}
        title={isTestable(s) ? "Open this scenario in the simulator" : "Not enabled for the simulator yet."}
        onClick={(e) => { e.stopPropagation(); test(s); }}>
        {openingId === idOf(s) ? <><Loader2 className="animate-spin" /> Opening</> : <><Play /> Test</>}
      </Button>
    </ButtonGroup>
  );

  const SortHead = ({ k, children, className }) => {
    const on = sortConfig?.key === k;
    return (
      <th className={cn("px-5 py-3 text-left text-sm font-medium", muted, className)}>
        <button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-1 hover:text-[rgb(var(--vx-ink))]">
          {children}
          {on && (sortConfig.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
        </button>
      </th>
    );
  };

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="flex items-baseline gap-3 text-3xl font-semibold tracking-tight">
            Scenarios {totalItems > 0 && <span className={cn("tabular-nums", muted)}>{totalItems}</span>}
          </h1>
        </header>

        <ListToolbar
          view={<ToolbarToggle label="View" value={view} onChange={setView}
            options={[{ value: "cards", label: "Cards", icon: LayoutGrid }, { value: "table", label: "Table", icon: Rows3 }]} />}
          search={{ value: search, onChange: setSearch, placeholder: "Search scenarios" }}
          filters={<><ToolbarToggle label="Status" value={status} onChange={setStatus}
            options={[{ value: "", label: "All" }, { value: "Published", label: "Published" }, { value: "Draft", label: "Draft" }, { value: "Archived", label: "Archived" }]} />
            {isAdmin && educators.length > 0 && (
              <div className="px-1">
                <Select variant="ghost" label="Educator" value={educator} onChange={setEducator}
                  options={[{ value: "", label: "All educators" }, ...educators.map((n) => ({ value: n, label: n }))]} />
              </div>
            )}</>}
          actions={canAuthor && <Button size="lg" className="h-11 rounded-[22px]" onClick={() => navigate("/scenarios/add")}><Plus /> New scenario</Button>}
        />

        {error ? (
          <p className="rounded-2xl bg-[rgb(var(--vx-danger)/0.1)] px-5 py-3 text-base text-[rgb(var(--vx-danger))]">
            {typeof error === "object" ? error.message : String(error)}
          </p>
        ) : isInitialLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] px-5 py-16 text-center">
            <p className={cn("text-base", muted)}>
              {search || status ? "No scenarios match." : "No scenarios yet. Describe a patient in a few words and the AI writes the case."}
            </p>
            {canAuthor && !search && !status && <Button size="lg" onClick={() => navigate("/scenarios/add")}><Plus /> Make your first scenario</Button>}
            {(search || status) && <Button variant="secondary" onClick={() => { setSearch(""); setStatus(""); }}>Clear search and filter</Button>}
          </div>
        ) : (
          <div aria-busy={isLoading} className={cn("transition-opacity", isLoading && "opacity-60")}>
            {view === "cards" ? (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {rows.map((s) => (
                  <li key={idOf(s)} onClick={() => edit(s)}
                    className={cn("group flex flex-col gap-4 rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))] p-5 transition-[border-color,box-shadow]",
                      canEdit && "cursor-pointer hover:border-[rgb(var(--vx-accent)/0.6)] hover:shadow-md")}>
                    <div className="-mr-2 -mt-1 flex items-center justify-between gap-3">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StatusChip status={s.status} />
                        <KindChips s={s} />
                      </span>
                      {busyId === idOf(s) ? <Loader2 size={18} className={cn("m-2 animate-spin", muted)} /> : <Menu items={menuFor(s)} />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h3 className="line-clamp-2 text-xl font-semibold leading-snug">{s.scenarioName || "Untitled"}</h3>
                      {isAdmin && s.educator?.name && <p className={cn("text-sm", muted)}>by {s.educator.name}</p>}
                      {blurb(s) && <p className={cn("line-clamp-2 text-sm", muted)}>{blurb(s)}</p>}
                    </div>
                    <div className={cn("flex flex-wrap items-center justify-between gap-2 text-sm", muted)}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setInsight(s); }} className="tabular-nums hover:text-[rgb(var(--vx-ink))] hover:underline" title="See results">{facts(s)}</button>
                      {s.updatedAt && <span>edited <Ago date={s.updatedAt} /></span>}
                    </div>
                    <Actions s={s} full />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]">
                <table className="w-full min-w-[46rem] border-collapse">
                  <thead className="border-b border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-cell)/0.5)]">
                    <tr>
                      <SortHead k="scenarioName">Scenario</SortHead>
                      <SortHead k="status">Status</SortHead>
                      <SortHead k="difficulty">Difficulty</SortHead>
                      <th className={cn("px-5 py-3 text-left text-sm font-medium", muted)}>Students</th>
                      <th className={cn("px-5 py-3 text-left text-sm font-medium", muted)}>Sessions</th>
                      <th className={cn("px-5 py-3 text-left text-sm font-medium", muted)}>Average</th>
                      <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
                    {rows.map((s) => (
                      <tr key={idOf(s)} onClick={() => edit(s)} className={cn("transition-colors", canEdit && "cursor-pointer hover:bg-[rgb(var(--vx-accent)/0.05)]")}>
                        <td className="max-w-md px-5 py-3">
                          <div className="truncate text-base font-semibold">{s.scenarioName || "Untitled"}</div>
                          {blurb(s) && <div className={cn("truncate text-sm", muted)}>{blurb(s)}</div>}
                          <div className="mt-1"><KindChips s={{ ...s, difficulty: null }} /></div>
                          {isAdmin && s.educator?.name && <div className={cn("text-sm", muted)}>by {s.educator.name}</div>}
                        </td>
                        <td className="px-5 py-3"><StatusChip status={s.status} /></td>
                        <td className="px-5 py-3 text-base">{s.difficulty === "High" ? "Hard" : s.difficulty || "—"}</td>
                        <td className="px-5 py-3 text-base tabular-nums">
                          {s.assignedTo?.length || 0}
                          {s.assignedGroups?.length ? <span className={cn("text-sm", muted)}> · {plural(s.assignedGroups.length, "group")}</span> : null}
                        </td>
                        <td className="px-5 py-3 text-base tabular-nums">{s.totalSessions || 0}</td>
                        <td className="px-5 py-3 text-base tabular-nums">{s.avgScore != null && s.totalSessions > 0 ? `${Math.round(s.avgScore)}%` : <span className={muted}>—</span>}</td>
                        <td className="px-5 py-3">
                          <RowActions items={[
                            { icon: s.status === "Published" ? Eye : Pencil, label: s.status === "Published" ? "View" : "Edit", onClick: () => (s.status === "Published" ? navigate(`/scenarios/view/${idOf(s)}`) : edit(s)), hidden: !canEdit },
                            { icon: Play, label: openingId === idOf(s) ? "Opening" : "Test", primary: true, busy: openingId === idOf(s), disabled: !isTestable(s), onClick: () => test(s) },
                            ...menuFor(s).map((m) => ({ ...m, busy: busyId === idOf(s) && m.danger })),
                          ]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={currentPage} pageSize={pageSize} total={totalItems} onPage={handlePageChange}
              onPageSize={(n) => setPageSize(n)} />
          </div>
        )}
      </div>
      {insight && <ScenarioInsights scenario={insight} onClose={() => setInsight(null)} />}
      <ConfirmationModal isOpen={!!toDelete} onClose={() => setToDelete(null)} confirmLabel="Delete" danger
        title="Delete this scenario?" message={toDelete ? `"${toDelete.scenarioName}" is removed for its educator and students. Past sessions stay in the records. This cannot be undone.` : ""}
        onConfirm={async () => {
          const s = toDelete;
          setToDelete(null);
          try { await axios.delete(`/api/scenarios/${idOf(s)}`); toast.success("Scenario deleted."); refetch(); }
          catch (e) { toast.error(e.response?.data?.message || "Could not delete it."); }
        }} />
      {assignId && (
        <AssignScenariosModal initialScenarioId={assignId} onClose={() => setAssignId(null)}
          onAssignSuccess={() => { refetch(); toast.success("Assignments saved."); }} />
      )}
    </div>
  );
}
