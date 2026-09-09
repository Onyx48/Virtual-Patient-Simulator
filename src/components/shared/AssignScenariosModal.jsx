import React, { useState, useEffect } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import { XMarkIcon, PlusIcon, MinusIcon } from "@heroicons/react/24/outline";
import { toast } from 'react-hot-toast';
import { assignScenarios } from "../../redux/slices/scenarioSlice";
import { Spinner } from "../../lib/hooks/useLoading";

function AssignScenariosModal({ onClose, onAssignSuccess }) {
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
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchData = async () => {
    try {
      const [scenariosRes, studentsRes, groupsRes] = await Promise.all([
        axios.get("/api/scenarios", getAuthHeaders()),
        axios.get("/api/students", getAuthHeaders()),
        axios.get("/api/groups", getAuthHeaders()).catch((err) => {
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
        initialExpanded[scenario._id] = false;
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

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

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

  const handleSelectAll = (scenarioId) => {
    const allIds = students.map((s) => s._id);
    const current = selections[scenarioId] || [];
    const allSelected = allIds.every((id) => current.includes(id));
    setSelections((prev) => ({ ...prev, [scenarioId]: allSelected ? [] : allIds }));
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

  if (loading)
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center">
        <Spinner size={48} colorClass="border-t-orange-500" label="Loading scenarios..." />
      </div>
    );

  if (error)
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center">
        <div className="bg-white p-6 rounded-lg text-center max-w-md">
          <div className="text-red-500 mb-4">{error}</div>
          <button
            onClick={() => { setError(null); setLoading(true); fetchData(); }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2"
          >
            Retry
          </button>
          <button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
            Close
          </button>
        </div>
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Assign Scenarios</h2>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-500 mb-6 text-sm">
            Expand a scenario, then assign whole groups or pick individual
            students. A group keeps covering its members as they change.
          </p>
          <div className="space-y-3">
            {scenarios.length === 0 && (
              <div className="text-center text-gray-500 py-8">No scenarios available to assign.</div>
            )}
            {scenarios.map((scenario) => (
              <div
                key={scenario._id}
                className="border border-gray-200 rounded-xl overflow-hidden transition-all hover:border-gray-300"
              >
                <div
                  className="flex justify-between items-center p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                  onClick={() => toggleExpanded(scenario._id)}
                >
                  <div className="font-semibold text-gray-800">{scenario.scenarioName}</div>
                  <div className="flex items-center gap-3">
                    {(selections[scenario._id] || []).length > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        {(selections[scenario._id] || []).length} selected
                      </span>
                    )}
                    {(groupSelections[scenario._id] || []).length > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {(groupSelections[scenario._id] || []).length} group
                        {(groupSelections[scenario._id] || []).length === 1 ? "" : "s"}
                      </span>
                    )}
                    {expanded[scenario._id] ? <MinusIcon className="w-5 h-5 text-gray-500" /> : <PlusIcon className="w-5 h-5 text-gray-500" />}
                  </div>
                </div>

                {expanded[scenario._id] && (
                  <div className="p-4 bg-white border-t border-gray-100">
                    {students.length === 0 ? (
                      <div className="text-center text-gray-500 py-4">No students available.</div>
                    ) : (
                      <>
                        {/* Group assignment row */}
                        {groupsError && (
                          <p className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Groups could not be loaded — restart the backend server, then reopen this modal.
                          </p>
                        )}
                        {groups.length > 0 && (
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="text-xs font-semibold text-gray-500 uppercase">
                                Assign groups:
                              </span>
                              {groups.map((group) => {
                                const gid = group._id.toString();
                                const isAssigned = (
                                  groupSelections[scenario._id] || []
                                ).includes(gid);
                                /*
                                 * The count comes from the server (studentCount)
                                 * rather than the loaded student list, because a
                                 * school_admin's list may not include every
                                 * educator's students.
                                 */
                                const memberCount = group.studentCount ?? 0;
                                return (
                                  <button
                                    key={group._id}
                                    type="button"
                                    onClick={() => handleGroupToggle(scenario._id, gid)}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                                      isAssigned
                                        ? "bg-orange-500 text-white border-orange-500"
                                        : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-600"
                                    }`}
                                  >
                                    {group.name}
                                    <span className="ml-1 opacity-70">({memberCount})</span>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                              An assigned group covers everyone in it, including
                              students added to it later.
                            </p>
                          </div>
                        )}

                        {/* Select all / count row */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-gray-500">
                            {(selections[scenario._id] || []).length} / {students.length} selected
                            {countCovered(scenario._id) > 0 && (
                              <span className="text-orange-600">
                                {" "}
                                + {countCovered(scenario._id)} via groups
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectAll(scenario._id)}
                            className="text-xs font-semibold text-orange-600 hover:text-orange-800 transition-colors"
                          >
                            {students.every((s) => (selections[scenario._id] || []).includes(s._id))
                              ? "Deselect All"
                              : "Select All"}
                          </button>
                        </div>

                        {/* Student checklist */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {students.map((student) => {
                            const rawGid = student.groupId?._id ?? student.groupId;
                            const groupName =
                              student.groupId?.name ||
                              groups.find((g) => rawGid && g._id.toString() === rawGid.toString())?.name;
                            /*
                             * Covered by an assigned group: shown ticked but
                             * locked, because unticking it here could not be
                             * honoured — the group is what is stored, so the only
                             * real way to drop this student is to unassign it.
                             */
                            const covering = coveringGroup(scenario._id, student);
                            const individually = (
                              selections[scenario._id] || []
                            ).includes(student._id);
                            return (
                              <label
                                key={student._id}
                                title={
                                  covering
                                    ? `Assigned via the group ${covering.name} — unassign the group to change this`
                                    : undefined
                                }
                                className={`flex items-center gap-3 p-2 rounded select-none ${
                                  covering
                                    ? "bg-orange-50/60 cursor-default"
                                    : "hover:bg-gray-50 cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={individually || Boolean(covering)}
                                  disabled={Boolean(covering)}
                                  onChange={() => handleStudentToggle(scenario._id, student._id)}
                                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 disabled:opacity-70"
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-800 truncate">
                                    {student.name || student.email}
                                  </div>
                                  {covering ? (
                                    <div className="text-xs text-orange-600 truncate">
                                      via {covering.name}
                                    </div>
                                  ) : (
                                    groupName && (
                                      <div className="text-xs text-gray-400 truncate">{groupName}</div>
                                    )
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-black hover:bg-gray-800 shadow-md"
          >
            Save Assignments
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold mb-4">Confirm Changes</h3>
            <div className="max-h-60 overflow-y-auto mb-6 space-y-3">
              {assignmentSummary.map((change) => (
                <div key={change.scenarioId} className="text-sm border-l-2 border-orange-500 pl-3">
                  <div className="font-semibold text-gray-900">{change.scenarioName}</div>
                  {change.addedStudents.length > 0 && (
                    <div className="text-green-600 mt-1">Adding: {change.addedStudents.join(", ")}</div>
                  )}
                  {change.removedStudents.length > 0 && (
                    <div className="text-red-600">Removing: {change.removedStudents.join(", ")}</div>
                  )}
                  {change.addedGroups?.length > 0 && (
                    <div className="text-green-600 mt-1">
                      Adding groups: {change.addedGroups.join(", ")}
                    </div>
                  )}
                  {change.removedGroups?.length > 0 && (
                    <div className="text-red-600">
                      Removing groups: {change.removedGroups.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Back
              </button>
              <button
                onClick={confirmAssign}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssignScenariosModal;
