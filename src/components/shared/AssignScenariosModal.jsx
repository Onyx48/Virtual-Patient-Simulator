import { getAccessToken } from "../../lib/authToken.js";
import { fetchCached } from "../../lib/query";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import { Check, ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { Button, ButtonGroup, Dialog } from "../vx/ui";
import { cn } from "../../lib/utils";
import { Select } from "../vx/bits";
import { Paged } from "../vx/list";
import { toast } from 'react-hot-toast';
import { assignScenarios } from "../../redux/slices/scenarioSlice";

function AssignScenariosModal({ onClose, onAssignSuccess, focusStudent = "", initialScenarioId = null }) {
  // Opened from a student: the list starts filtered to them. From a scenario: that scenario starts open.
  const [studentQuery, setStudentQuery] = useState(focusStudent);
  const [groupFilter, setGroupFilter] = useState("");
  const dispatch = useDispatch();
  const [scenarios, setScenarios] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupsError, setGroupsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selections, setSelections] = useState({});
  // Groups assigned per scenario, kept separate from the student selections:
  // a group is stored on the scenario, not expanded into a list of students.
  const [groupSelections, setGroupSelections] = useState({});
  const [expanded, setExpanded] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [assignmentSummary, setAssignmentSummary] = useState([]);

  const getAuthHeaders = () => {
    const token = getAccessToken();
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchData = async () => {
    try {
      const [scenariosRes, studentsRes, groupsRes] = await Promise.all([
        fetchCached("/api/scenarios").then((data) => ({ data })),
        fetchCached("/api/students").then((data) => ({ data })),
        fetchCached("/api/groups").then((data) => ({ data })).catch((err) => {
          console.warn("[AssignScenariosModal] Failed to fetch groups:", err?.response?.data || err.message);
          setGroupsError(true);
          return { data: [] };
        }),
      ]);
      setScenarios(scenariosRes.data);
      setStudents(studentsRes.data);
      setGroups(groupsRes.data);
      if (groupsRes.data.length > 0) setGroupsError(false);

      const initialSelections = {};
      const initialGroups = {};
      scenariosRes.data.forEach((scenario) => {
        initialSelections[scenario._id] = (scenario.assignedTo || []).map(u => u._id);
        initialGroups[scenario._id] = (scenario.assignedGroups || []).map(
          (g) => (g._id ?? g).toString(),
        );
      });
      setSelections(initialSelections);
      setGroupSelections(initialGroups);

      const initialExpanded = {};
      scenariosRes.data.forEach((scenario) => {
        initialExpanded[scenario._id] = String(scenario._id) === String(initialScenarioId);
      });
      setExpanded(initialExpanded);
    } catch (error) {
      if (error.response?.status === 401) {
        setError("Authentication failed. Please log in again.");
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("Failed to load data. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);


  const toggleExpanded = (scenarioId) => {
    setExpanded((prev) => ({ ...prev, [scenarioId]: !prev[scenarioId] }));
  };

  const handleStudentToggle = (scenarioId, studentId) => {
    setSelections((prev) => {
      const current = prev[scenarioId] || [];
      const isSelected = current.includes(studentId);
      return {
        ...prev,
        [scenarioId]: isSelected
          ? current.filter((id) => id !== studentId)
          : [...current, studentId],
      };
    });
  };

  // Students the search and group filter leave visible. Select all acts on these only.
  const visibleStudents = students.filter((st) => {
    const q = studentQuery.trim().toLowerCase();
    if (q && !`${st.name || ""} ${st.email || ""}`.toLowerCase().includes(q)) return false;
    const gid = (st.groupId?._id ?? st.groupId)?.toString() || "none";
    return !groupFilter || gid === groupFilter;
  });

  const handleSelectAll = (scenarioId) => {
    const ids = visibleStudents.map((s) => s._id);
    const current = selections[scenarioId] || [];
    const allSelected = ids.every((id) => current.includes(id));
    setSelections((prev) => ({
      ...prev,
      [scenarioId]: allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])],
    }));
  };

  /*
   * Assign or unassign a whole group. This stores the group on the scenario
   * rather than ticking its members, so a student who joins the group later is
   * covered automatically and one who leaves it stops being.
   */
  const handleGroupToggle = (scenarioId, groupId) => {
    if (!groupId) return;
    setGroupSelections((prev) => {
      const current = prev[scenarioId] || [];
      return {
        ...prev,
        [scenarioId]: current.includes(groupId)
          ? current.filter((id) => id !== groupId)
          : [...current, groupId],
      };
    });
  };

  const studentGroupId = (student) =>
    (student.groupId?._id ?? student.groupId)?.toString();

  /*
   * The group covering this student for this scenario, if any. A covered student
   * is shown ticked but not editable — the way to change it is to unassign the
   * group, not to fight the checkbox.
   */
  const coveringGroup = (scenarioId, student) => {
    const gid = studentGroupId(student);
    if (!gid) return null;
    if (!(groupSelections[scenarioId] || []).includes(gid)) return null;
    return groups.find((g) => g._id.toString() === gid) || null;
  };

  const countCovered = (scenarioId) =>
    students.filter((s) => coveringGroup(scenarioId, s)).length;

  const handleAssign = () => {
    const nameMap = {};
    students.forEach(s => { nameMap[s._id] = s.name || s.email; });
    scenarios.forEach(s => (s.assignedTo || []).forEach(a => { nameMap[a._id] = a.name || a.email; }));

    const groupNameMap = {};
    groups.forEach((g) => { groupNameMap[g._id.toString()] = g.name; });

    const changes = [];
    scenarios.forEach((scenario) => {
      const currentAssigned = (scenario.assignedTo || []).map(u => u._id);
      const newAssigned = selections[scenario._id] || [];
      const added = newAssigned.filter((id) => !currentAssigned.includes(id));
      const removed = currentAssigned.filter((id) => !newAssigned.includes(id));

      const currentGroups = (scenario.assignedGroups || []).map((g) =>
        (g._id ?? g).toString(),
      );
      const newGroups = groupSelections[scenario._id] || [];
      const groupsAdded = newGroups.filter((id) => !currentGroups.includes(id));
      const groupsRemoved = currentGroups.filter((id) => !newGroups.includes(id));

      if (
        added.length > 0 ||
        removed.length > 0 ||
        groupsAdded.length > 0 ||
        groupsRemoved.length > 0
      ) {
        const studentUpdates = [
          ...added.map((userId) => ({ studentId: userId, addScenarios: [scenario._id], removeScenarios: [] })),
          ...removed.map((userId) => ({ studentId: userId, addScenarios: [], removeScenarios: [scenario._id] })),
        ];
        changes.push({
          scenarioId: scenario._id,
          scenarioName: scenario.scenarioName,
          assignedToIds: newAssigned,
          assignedGroupIds: newGroups,
          studentUpdates,
          addedStudents: added.map((id) => nameMap[id] || id),
          removedStudents: removed.map((id) => nameMap[id] || id),
          addedGroups: groupsAdded.map((id) => groupNameMap[id] || id),
          removedGroups: groupsRemoved.map((id) => groupNameMap[id] || id),
        });
      }
    });

    if (changes.length === 0) { toast("No changes to assign."); return; }
    setAssignmentSummary(changes);
    setShowConfirm(true);
  };

  const confirmAssign = async () => {
    setShowConfirm(false);
    try {
      await dispatch(assignScenarios(assignmentSummary)).unwrap();
      if (onAssignSuccess) onAssignSuccess();
      onClose();
    } catch {
      toast.error("Failed to update assignments.");
    }
  };

  const muted = "text-[rgb(var(--vx-muted))]";

  if (loading || error)
    return (
      <Dialog title="Assign scenarios" onClose={onClose} size="sm">
        {loading ? (
          <div className="flex items-center gap-3 py-6 text-base"><Loader2 className="animate-spin" size={20} /> Loading scenarios…</div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="rounded-2xl bg-[rgb(var(--vx-danger)/0.1)] px-4 py-3 text-base text-[rgb(var(--vx-danger))]">{error}</p>
            <div className="flex justify-end">
              <ButtonGroup>
                <Button variant="secondary" size="lg" onClick={onClose}>Close</Button>
                <Button size="lg" onClick={() => { setError(null); setLoading(true); fetchData(); }}><RotateCcw /> Retry</Button>
              </ButtonGroup>
            </div>
          </div>
        )}
      </Dialog>
    );

  return (
    <>
      <Dialog title="Assign scenarios" subtitle="Open a scenario, then give it to whole groups or to single students." onClose={onClose} size="lg"
        footer={
          <ButtonGroup>
            <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
            <Button size="lg" onClick={handleAssign}>Review changes</Button>
          </ButtonGroup>
        }>
        {scenarios.length === 0 ? (
          <p className={cn("py-10 text-center text-base", muted)}>No scenarios to assign yet.</p>
        ) : (
          <Paged rows={initialScenarioId ? [...scenarios].sort((a, b) => (String(b._id) === String(initialScenarioId)) - (String(a._id) === String(initialScenarioId))) : scenarios} size={20} sizes={[20, 50, 100]}>{(scenarioPage) => (
          <ul className="flex flex-col gap-2">
            {scenarioPage.map((scenario) => {
              const id = scenario._id;
              const open = !!expanded[id];
              const picked = (selections[id] || []).length;
              const gcount = (groupSelections[id] || []).length;
              const covered = countCovered(id);
              const allOn = visibleStudents.length > 0 && visibleStudents.every((s) => (selections[id] || []).includes(s._id));
              return (
                <li key={id} className={cn("overflow-hidden rounded-2xl border bg-[rgb(var(--vx-card))] transition-colors",
                  open ? "border-[rgb(var(--vx-accent)/0.6)]" : "border-[rgb(var(--vx-line)/0.7)]")}>
                  <button type="button" onClick={() => toggleExpanded(id)} aria-expanded={open}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[rgb(var(--vx-cell)/0.4)]">
                    <span className="min-w-0 flex-1 truncate text-lg font-semibold">{scenario.scenarioName}</span>
                    {gcount > 0 && <span className="shrink-0 rounded-full bg-[rgb(var(--vx-accent)/0.18)] px-3 py-0.5 text-sm font-medium">{gcount} group{gcount === 1 ? "" : "s"}</span>}
                    {picked > 0 && <span className="shrink-0 rounded-full bg-[rgb(var(--vx-cell))] px-3 py-0.5 text-sm font-medium tabular-nums">{picked} student{picked === 1 ? "" : "s"}</span>}
                    <ChevronDown size={20} className={cn("shrink-0 transition-transform", muted, open && "rotate-180")} />
                  </button>

                  {open && (
                    <div className="flex flex-col gap-4 border-t border-[rgb(var(--vx-line)/0.7)] px-5 py-4">
                      {groupsError && (
                        <p className="rounded-xl bg-[rgb(var(--vx-warn)/0.12)] px-4 py-2 text-sm text-[rgb(var(--vx-warn))]">
                          Groups could not be loaded. Restart the backend, then open this again.
                        </p>
                      )}
                      {students.length === 0 ? (
                        <p className={cn("py-4 text-center text-base", muted)}>No students yet.</p>
                      ) : (
                        <>
                          {groups.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <span className="text-sm font-medium">Groups</span>
                              <div className="flex flex-wrap gap-2">
                                {groups.map((group) => {
                                  const gid = group._id.toString();
                                  const on = (groupSelections[id] || []).includes(gid);
                                  return (
                                    <button key={gid} type="button" aria-pressed={on} onClick={() => handleGroupToggle(id, gid)}
                                      className={cn("inline-flex h-10 items-center gap-2 rounded-full px-4 text-base font-medium transition-colors",
                                        on ? "bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "bg-[rgb(var(--vx-cell))] hover:bg-[rgb(var(--vx-accent)/0.15)]")}>
                                      {on && <Check size={16} />}
                                      {group.name}
                                      <span className={cn("tabular-nums", on ? "opacity-70" : muted)}>{group.studentCount ?? 0}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">
                                Students <span className={cn("font-normal tabular-nums", muted)}>{picked} of {students.length}{covered > 0 ? ` · ${covered} through groups` : ""}</span>
                              </span>
                              <Button variant="secondary" size="sm" onClick={() => handleSelectAll(id)}>
                                {allOn ? "Clear" : "Select"} {studentQuery || groupFilter ? `these ${visibleStudents.length}` : "all"}
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Find a student" aria-label="Find a student"
                                className="h-9 min-w-[12rem] flex-1 rounded-full border-0 bg-[rgb(var(--vx-cell))] px-4 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--vx-accent))]" />
                              {groups.length > 0 && (
                                <Select size="sm" label="Group" value={groupFilter} onChange={setGroupFilter}
                                  options={[{ value: "", label: "All groups" }, ...groups.map((g) => ({ value: g._id.toString(), label: g.name })), { value: "none", label: "No group" }]} />
                              )}
                            </div>
                            {visibleStudents.length === 0 && <p className={cn("py-2 text-sm", muted)}>No students match.</p>}
                            <Paged rows={visibleStudents} size={60} sizes={[60, 120, 240]}>{(studentPage) => (
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                              {studentPage.map((student) => {
                                const rawGid = student.groupId?._id ?? student.groupId;
                                const groupName = student.groupId?.name || groups.find((g) => rawGid && g._id.toString() === rawGid.toString())?.name;
                                // Covered by an assigned group: ticked and locked; unassign the group to change it.
                                const covering = coveringGroup(id, student);
                                const on = (selections[id] || []).includes(student._id) || !!covering;
                                return (
                                  <label key={student._id}
                                    title={covering ? `Assigned through ${covering.name}. Unassign the group to change this.` : undefined}
                                    className={cn("flex select-none items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                                      covering ? "cursor-default bg-[rgb(var(--vx-accent)/0.08)]" : on ? "cursor-pointer bg-[rgb(var(--vx-accent)/0.12)]" : "cursor-pointer hover:bg-[rgb(var(--vx-cell)/0.6)]")}>
                                    <input type="checkbox" checked={on} disabled={!!covering} onChange={() => handleStudentToggle(id, student._id)} className="sr-only" />
                                    <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
                                      on ? "border-[rgb(var(--vx-accent))] bg-[rgb(var(--vx-accent))] text-[rgb(var(--vx-on-accent))]" : "border-[rgb(var(--vx-muted)/0.5)]",
                                      covering && "opacity-60")}>
                                      {on && <Check size={14} strokeWidth={3} />}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-base font-medium">{student.name || student.email}</span>
                                      {covering
                                        ? <span className="block truncate text-sm text-[rgb(var(--vx-accent-text))]">through {covering.name}</span>
                                        : groupName && <span className={cn("block truncate text-sm", muted)}>{groupName}</span>}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            )}</Paged>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          )}</Paged>
        )}
      </Dialog>

      {showConfirm && (
        <Dialog title="Review changes" onClose={() => setShowConfirm(false)} size="md" z="z-[60]"
          footer={
            <ButtonGroup>
              <Button variant="secondary" size="lg" onClick={() => setShowConfirm(false)}>Back</Button>
              <Button size="lg" onClick={confirmAssign}><Check /> Save</Button>
            </ButtonGroup>
          }>
          <ul className="flex flex-col gap-3">
            {assignmentSummary.map((c) => (
              <li key={c.scenarioId} className="rounded-2xl bg-[rgb(var(--vx-card))] p-4">
                <div className="mb-1 text-base font-semibold">{c.scenarioName}</div>
                {[
                  [c.addedGroups, "Groups added", true],
                  [c.addedStudents, "Students added", true],
                  [c.removedGroups, "Groups removed", false],
                  [c.removedStudents, "Students removed", false],
                ].filter(([l]) => l?.length).map(([l, label, ok]) => (
                  <p key={label} className="text-sm">
                    <span className={cn("font-medium", ok ? "text-[rgb(var(--vx-ok))]" : "text-[rgb(var(--vx-danger))]")}>{label}:</span>{" "}
                    <span className={muted}>{l.join(", ")}</span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </>
  );
}

export default AssignScenariosModal;
