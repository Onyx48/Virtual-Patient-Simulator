import React, { useState, useEffect } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import { XMarkIcon, PlusIcon, MinusIcon } from "@heroicons/react/24/outline";
import { toast } from 'react-hot-toast';
import { assignScenarios } from "../../redux/slices/scenarioSlice";

function AssignScenariosModal({ onClose, onAssignSuccess }) {
  const dispatch = useDispatch();
  const [scenarios, setScenarios] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selections, setSelections] = useState({});
  const [expanded, setExpanded] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [assignmentSummary, setAssignmentSummary] = useState([]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [scenariosRes, studentsRes] = await Promise.all([
          axios.get("/api/scenarios", getAuthHeaders()),
          axios.get("/api/students", getAuthHeaders()),
        ]);
        setScenarios(scenariosRes.data);
        setStudents(studentsRes.data);

        const initialSelections = {};
        scenariosRes.data.forEach((scenario) => {
          initialSelections[scenario._id] = (scenario.assignedTo || []).map(u => u._id);
        });
        setSelections(initialSelections);

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
    fetchData();
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
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
      const newSelection = isSelected
        ? current.filter((id) => id !== studentId)
        : [...current, studentId];
      return { ...prev, [scenarioId]: newSelection };
    });
  };

  const handleAssign = () => {
    const changes = [];
    scenarios.forEach((scenario) => {
      const currentAssigned = (scenario.assignedTo || []).map(u => u._id);
      const newAssigned = selections[scenario._id] || [];
        const added = newAssigned.filter((userId) => !currentAssigned.includes(userId));
        const removed = currentAssigned.filter((userId) => !newAssigned.includes(userId));
        if (added.length > 0 || removed.length > 0) {
          const assignedToIds = newAssigned;
          console.log("Assigned to IDs for scenario", scenario._id, ":", assignedToIds);
          const studentUpdates = [];
          added.forEach((userId) => {
            const student = students.find(s => s.user._id === userId);
            if (student) {
              studentUpdates.push({ studentId: student._id, addScenarios: [scenario._id], removeScenarios: [] });
            }
          });
          removed.forEach((userId) => {
            const student = students.find(s => s.user._id === userId);
            if (student) {
              studentUpdates.push({ studentId: student._id, addScenarios: [], removeScenarios: [scenario._id] });
            }
          });
        changes.push({
          scenarioId: scenario._id,
          scenarioName: scenario.scenarioName,
          assignedToIds,
          studentUpdates,
          addedStudents: added.map(
            (userId) => students.find((s) => s.user._id === userId)?.user?.name || userId
          ),
          removedStudents: removed.map(
            (userId) => students.find((s) => s.user._id === userId)?.user?.name || userId
          ),
        });
      }
    });

    if (changes.length === 0) {
      toast("No changes to assign.");
      return;
    }

    setAssignmentSummary(changes);
    setShowConfirm(true);
  };

  const confirmAssign = async () => {
    setShowConfirm(false);
    try {
      await dispatch(assignScenarios(assignmentSummary)).unwrap();
      if (onAssignSuccess) onAssignSuccess();
      onClose();
    } catch (error) {
      toast.error("Failed to update assignments.");
    }
  };

  if (loading)
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center">
        <div className="bg-white p-4 rounded">Loading data...</div>
      </div>
    );
  if (error)
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center">
        <div className="bg-white p-6 rounded-lg text-center max-w-md">
          <div className="text-red-500 mb-4">{error}</div>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              // Refetch data
              const fetchData = async () => {
                try {
                  const [scenariosRes, studentsRes] = await Promise.all([
                    axios.get("/api/scenarios", getAuthHeaders()),
                    axios.get("/api/students", getAuthHeaders()),
                  ]);
                  setScenarios(scenariosRes.data);
                  setStudents(studentsRes.data);

                   const initialSelections = {};
                   scenariosRes.data.forEach((scenario) => {
                     initialSelections[scenario._id] = (scenario.assignedTo || []).map(u => u._id);
                   });
                  setSelections(initialSelections);

                  const initialExpanded = {};
                  scenariosRes.data.forEach((scenario) => {
                    initialExpanded[scenario._id] = false;
                  });
                  setExpanded(initialExpanded);
                } catch (retryError) {
                  if (retryError.response?.status === 401) {
                    setError("Authentication failed. Please log in again.");
                  } else if (retryError.code === 'NETWORK_ERROR' || !retryError.response) {
                    setError("Network error. Please check your connection and try again.");
                  } else {
                    setError("Failed to load data. Please try again later.");
                  }
                } finally {
                  setLoading(false);
                }
              };
              fetchData();
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2"
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
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
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-500 mb-6 text-sm">
            Expand a scenario to select students to assign.
          </p>
          <div className="space-y-3">
            {scenarios.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No scenarios available to assign.
              </div>
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
                  <div className="font-semibold text-gray-800">
                    {scenario.scenarioName}
                  </div>
                  <div className="text-gray-500">
                    {expanded[scenario._id] ? (
                      <MinusIcon className="w-5 h-5" />
                    ) : (
                      <PlusIcon className="w-5 h-5" />
                    )}
                  </div>
                </div>
                {expanded[scenario._id] && (
                  <div className="p-4 bg-white border-t border-gray-100">
                    {students.length === 0 ? (
                      <div className="text-center text-gray-500 py-4">
                        No students available to assign.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {students.map((student) => (
                        <label
                          key={student._id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer select-none"
                        >
                           <input
                             type="checkbox"
                             checked={(selections[scenario._id] || []).includes(
                               student.user?._id
                             )}
                             onChange={() =>
                               handleStudentToggle(scenario._id, student.user?._id)
                             }
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">
                            {student.user?.name || "Unnamed Student"}
                          </span>
                        </label>
                        ))}
                      </div>
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
                <div
                  key={change.scenarioId}
                  className="text-sm border-l-2 border-orange-500 pl-3"
                >
                  <div className="font-semibold text-gray-900">
                    {change.scenarioName}
                  </div>
                  {change.addedStudents.length > 0 && (
                    <div className="text-green-600 mt-1">
                      Adding: {change.addedStudents.join(", ")}
                    </div>
                  )}
                  {change.removedStudents.length > 0 && (
                    <div className="text-red-600">
                      Removing: {change.removedStudents.join(", ")}
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
