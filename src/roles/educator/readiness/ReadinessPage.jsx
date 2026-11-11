// CPE / placement readiness (after ci/internal-shortlisting: "the product proposes, the educator
// disposes"). Each student arrives with a proposed status and its reasons; the educator overrides
// only where they know better. GET /api/students/readiness, PATCH /api/students/:id/readiness.
import React, { useEffect, useMemo, useState } from "react";
import { useCached, useData } from "../../../lib/query";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Mail, FileSpreadsheet, Undo2, Loader2 } from "lucide-react";
import { Button } from "../../../components/vx/ui";
import { ListToolbar, ToolbarToggle, Pagination } from "../../../components/vx/list";
import { usePagedRows } from "../../../lib/hooks/usePagedRows";
import { Ago, Select, downloadCsv } from "../../../components/vx/bits";
import ComposeEmail from "../../../components/shared/ComposeEmail";
import { useAuth } from "../../../AuthContext";
import { getAuthHeaders, cn } from "../../../lib/utils";
import "../../../components/vx/vx.css";

const muted = "text-[rgb(var(--vx-muted))]";
const STATUS = {
  ready: { label: "Ready", cls: "bg-[rgb(var(--vx-ok)/0.12)] text-[rgb(var(--vx-ok))]" },
  almost: { label: "Almost", cls: "bg-[rgb(var(--vx-warn)/0.14)] text-[rgb(var(--vx-warn))]" },
  notyet: { label: "Not yet", cls: "bg-[rgb(var(--vx-cell))] text-[rgb(var(--vx-ink))]" },
};

export default function ReadinessPage() {
  const { user } = useAuth();
  const [groupId, setGroupId] = useState("");
  const groups = useData("/api/groups", { fallback: [] }) || [];
  const [data, setData] = useCached("/api/students/readiness", { params: groupId ? { groupId } : undefined, fallback: { students: [] } });
  const [show, setShow] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [compose, setCompose] = useState(null);


  const rows = useMemo(() => (data?.students || [])
    .filter((s) => !show || s.status === show)
    .filter((s) => !search.trim() || `${s.name} ${s.email}`.toLowerCase().includes(search.trim().toLowerCase())), [data, show, search]);
  const pg = usePagedRows(rows, 16);
  const count = (k) => (data?.students || []).filter((s) => s.status === k).length;

  const decide = async (s, status) => {
    setBusyId(s._id);
    try {
      const { data: r } = await axios.patch(`/api/students/${s._id}/readiness`, { status }, getAuthHeaders());
      setData((d) => ({ ...d, students: d.students.map((x) => (x._id === s._id ? { ...x, override: r.override, status: r.override ? r.override.status : x.proposed } : x)) }));
    } catch (e) { toast.error(e.response?.data?.message || "Could not save that."); } finally { setBusyId(null); }
  };

  const exportCsv = () => downloadCsv(`readiness-${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: "Name", value: (s) => s.name }, { label: "Email", value: (s) => s.email }, { label: "Group", value: (s) => s.group || "" },
    { label: "Status", value: (s) => STATUS[s.status].label }, { label: "Proposed", value: (s) => STATUS[s.proposed].label },
    { label: "Changed by", value: (s) => s.override?.byName || "" }, { label: "Reasons", value: (s) => s.reasons.join("; ") },
    { label: "Practised", value: (s) => `${s.covered}/${s.assigned}` }, { label: "Average", value: (s) => (s.avg == null ? "" : `${s.avg}%`) },
  ], rows);

  return (
    <div className="vx min-h-full px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Readiness</h1>
            <p className={cn("max-w-3xl text-base", muted)}>
              Is each student ready to move on (to placement, or to the assessed OSCE)? The system proposes an answer from their practice and shows why. You decide: change any proposal and your call is what counts.
            </p>
          </div>
          <div className="vx-join">
            <Button variant="secondary" onClick={() => setCompose({ students: rows.map((s) => ({ id: s._id, name: s.name, email: s.email })) })} disabled={!rows.length}><Mail /> Email these {rows.length}</Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}><FileSpreadsheet /> Export</Button>
          </div>
        </header>

        {/* The three rules behind "Ready", in plain words (also on /definitions). */}
        <div className="grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl md:grid-cols-3">
          {[
            ["vx-tint-1", "Practised enough", data?.rules ? `Tried at least ${Math.round(data.rules.cover * 100)}% of the scenarios assigned to them.` : "Tried most of the scenarios assigned to them."],
            ["vx-tint-3", "Scoring well", data?.rules ? `Their best scores average ${data.rules.ready} out of 100 or more.` : "Their best scores average above the target."],
            ["vx-tint-7", "Still practising", data?.rules ? `Practised in the last ${data.rules.recentDays} days.` : "Practised recently."],
          ].map(([tint, title, text], i) => (
            <div key={title} className="flex gap-3 bg-[rgb(var(--vx-card))] p-4">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-base font-semibold", tint)}>{i + 1}</span>
              <span><span className="block text-base font-semibold">{title}</span><span className={cn("block text-sm", muted)}>{text}</span></span>
            </div>
          ))}
        </div>
        <p className={cn("-mt-2 text-sm", muted)}><b className="text-[rgb(var(--vx-ok))]">Ready</b>: all three. <b className="text-[rgb(var(--vx-warn))]">Almost</b>: not all three, but a best-score average of {data?.rules?.almost ?? 50}+ or at least half the scenarios tried. <b className="text-[rgb(var(--vx-danger))]">Not yet</b>: neither. Each row shows the reasons.</p>

        <ListToolbar
          search={{ value: search, onChange: setSearch, placeholder: "Search name or email" }}
          filters={
            <>
              <ToolbarToggle label="Status" value={show} onChange={setShow} options={[
                { value: "", label: `All ${data?.students?.length ?? ""}` },
                { value: "ready", label: `Ready ${count("ready")}` },
                { value: "almost", label: `Almost ${count("almost")}` },
                { value: "notyet", label: `Not yet ${count("notyet")}` },
              ]} />
              {groups.length > 0 && (
                <div className="px-1">
                  <Select variant="ghost" label="Group" value={groupId} onChange={setGroupId}
                    options={[{ value: "", label: "All groups" }, ...groups.map((g) => ({ value: g._id, label: g.name }))]} />
                </div>
              )}
            </>
          }
        />

        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--vx-line)/0.7)] bg-[rgb(var(--vx-card))]">
          {!data ? <div className="m-5 h-40 animate-pulse rounded-2xl bg-[rgb(var(--vx-cell)/0.7)]" /> : rows.length === 0 ? (
            <p className={cn("px-5 py-16 text-center text-base", muted)}>No students here.</p>
          ) : (
            <>
            <ul className="divide-y divide-[rgb(var(--vx-line)/0.7)]">
              {pg.rows.map((s) => (
                <li key={s._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-[14rem] flex-1">
                    <div className="text-base font-semibold">{s.name}</div>
                    <div className={cn("text-sm", muted)}>{s.group ? `${s.group} · ` : ""}{s.lastSessionAt ? <>last practised <Ago date={s.lastSessionAt} /></> : "no practice yet"}</div>
                    <ul className={cn("mt-1 flex flex-wrap gap-x-3 text-sm", muted)}>{s.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="vx-join" role="group" aria-label={`Readiness for ${s.name}`}>
                      {Object.entries(STATUS).map(([k, v]) => (
                        <button key={k} type="button" aria-pressed={s.status === k} disabled={busyId === s._id}
                          onClick={() => (k === s.proposed && !s.override ? null : decide(s, k === s.proposed ? null : k))}
                          className={cn("h-9 px-4 text-sm font-medium transition-colors", s.status === k ? v.cls : "bg-[rgb(var(--vx-cell))] hover:bg-[rgb(var(--vx-ink)/0.1)]")}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <span className={cn("flex items-center gap-1 text-xs", muted)}>
                      {busyId === s._id ? <Loader2 size={12} className="animate-spin" /> : null}
                      {s.override ? (
                        <>Changed by {s.override.byName || "an educator"} (proposed {STATUS[s.proposed].label})
                          <button type="button" onClick={() => decide(s, null)} className="ml-1 inline-flex items-center gap-0.5 font-medium hover:text-[rgb(var(--vx-ink))]"><Undo2 size={12} /> Use proposed</button></>
                      ) : "Proposed from practice"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination {...pg.bind} />
            </>
          )}
        </div>
      </div>
      {compose && <ComposeEmail to={compose} fromName={user?.name} onClose={() => setCompose(null)} />}
    </div>
  );
}
