import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import Papa from "papaparse";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

import StudentModal from "../StudentModal";
import AssignScenariosModal from "./AssignScenariosModal";
import TranscriptViewerModal from "../ui/TranscriptViewerModal";
import ConfirmationModal from "../ui/ConfirmationModal";
import PaginationBar from "../ui/PaginationBar";
import { toast } from "react-hot-toast";
import { useAuth } from "../../AuthContext";
import { usePagination } from "../../lib/hooks/usePagination";
import { useLoading, Spinner, FullPageSpinner } from "../../lib/hooks/useLoading";
import { useSorting } from "../../lib/hooks/useSorting";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

function StudentPage({ role }) {
  const { user } = useAuth();

  // A school_admin does not assign scenarios (that stays with educators), so
  // neither the Scenarios column nor its filter is shown to them.
  // Groups are per-school, and GET /api/groups already scopes a school_admin to
  // their own school, so they get the same grouping tools an educator has.
  const showGroupColumn = role === "educator" || role === "school_admin";
  const showScenariosColumn = role !== "school_admin";
  const canManageStudents = role !== "school_admin";
  // ID, Name, Email, School, Progress, Transcript, Action are always present.
  const columnCount =
    7 + (showGroupColumn ? 1 : 0) + (showScenariosColumn ? 1 : 0);

  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { isLoading, withLoading } = useLoading(true);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAssigned, setFilterAssigned] = useState("");
  const [filterProgress, setFilterProgress] = useState("");
  const filterRef = useRef(null);

  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState(() => {});

  const fetchStudents = async () => {
    await withLoading(async () => {
      const response = await axios.get("/api/students", getAuthHeaders());
      const mappedData = response.data.map((student) => ({
        id: student._id,
        visualId: `VS${student._id.slice(-6).toUpperCase()}`,
        user_id: student._id,
        name: student.name || "Unknown",
        email: student.email || "No Email",
        schoolName: student.schoolId?.schoolName || "Unassigned",
        groupName: student.groupId?.name || null,
        groupId: student.groupId || null,
        progress: student.avgScore != null
          ? `${Math.round(student.avgScore * 100)}%`
          : "N/A",
        assignedScenariosCount: student.assignedScenariosCount || 0,
        isAssigned: (student.assignedScenariosCount || 0) > 0,
        bestScore: student.bestScore != null
          ? `${Math.round(student.bestScore * 100)}%`
          : null,
        totalSessions: student.totalSessions || 0,
        originalData: student,
      }));
      setStudents(mappedData);
    });
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get("/api/groups", getAuthHeaders());
      setGroups(response.data);
    } catch {
      // groups are optional; silently ignore
    }
  };

  useEffect(() => {
    fetchStudents();
    if (showGroupColumn) fetchGroups();
  }, []);

  useEffect(() => {
    const handleScenarioAssignmentsChanged = () => {
      fetchStudents();
    };
    window.addEventListener(
      "scenarioAssignmentsChanged",
      handleScenarioAssignmentsChanged,
    );
    return () => {
      window.removeEventListener(
        "scenarioAssignmentsChanged",
        handleScenarioAssignmentsChanged,
      );
    };
  }, []);

  const handleAddNew = () => {
    setEditingStudent(null);
    setIsStudentModalOpen(true);
  };

  const handleBulkUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const uploadToast = toast.loading("Parsing CSV file...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const nameAliases = ["name", "full name", "fullname"];
        const emailAliases = ["email", "email address"];

        const firstRow = results.data[0] || {};
        const actualHeaders = Object.keys(firstRow).map((h) => h.toLowerCase());

        const hasHeader = (aliases) =>
          aliases.some((alias) => actualHeaders.includes(alias));

        let missingHeaders = [];
        if (!hasHeader(nameAliases))
          missingHeaders.push("'name' or 'full name'");
        if (!hasHeader(emailAliases))
          missingHeaders.push("'email' or 'email address'");

        if (missingHeaders.length > 0) {
          toast.error(
            `CSV is missing required columns: ${missingHeaders.join(", ")}`,
            { id: uploadToast, duration: 6000 },
          );
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const findValue = (row, aliases) => {
          for (const key in row) {
            if (aliases.includes(key.toLowerCase())) {
              return row[key];
            }
          }
          return undefined;
        };

        const processedData = results.data.map((row) => ({
          name: findValue(row, nameAliases),
          email: findValue(row, emailAliases),
        }));

        toast.loading("Uploading students...", { id: uploadToast });
        try {
          const response = await axios.post(
            "/api/users/bulk",
            { users: processedData, role: "student" },
            getAuthHeaders(),
          );
          toast.success(
            `Upload complete! ${response.data.successCount} created.`,
            { id: uploadToast, duration: 5000 },
          );
          if (response.data.failureCount > 0) {
            console.error("Bulk upload failures:", response.data.errors);
            toast.error(
              `${response.data.failureCount} students failed to upload. Check console.`,
            );
          }
          await fetchStudents();
        } catch (error) {
          toast.error(
            "Bulk upload failed: " +
              (error.response?.data?.message || "Server error"),
            { id: uploadToast },
          );
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        toast.error("Failed to parse CSV: " + error.message, {
          id: uploadToast,
        });
        setIsUploading(false);
      },
    });
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setIsStudentModalOpen(true);
  };

  const handleDelete = (id) => {
    setConfirmTitle("Delete Student");
    setConfirmMessage("Are you sure you want to delete this student?");
    setOnConfirmAction(() => async () => {
      try {
        await axios.delete(`/api/users/${id}`, getAuthHeaders());
        setStudents((prev) => prev.filter((s) => s.id !== id));
        toast.success("Student deleted successfully");
      } catch (error) {
        toast.error(
          "Failed to delete student: " +
            (error.response?.data?.message || error.message),
        );
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleSaveStudent = async (formData) => {
    try {
      if (formData.id) {
        await axios.put(
          `/api/users/${formData.user_id}`,
          {
            name: formData.name,
            email: formData.email,
            // Pass null through, so clearing the group is not mistaken for
            // "field not supplied".
            ...(formData.groupId !== undefined && {
              groupId: formData.groupId,
            }),
          },
          getAuthHeaders(),
        );
        toast.success("Student updated successfully.");
      } else {
        await axios.post(
          "/api/users",
          {
            name: formData.name,
            email: formData.email,
            role: "student",
            ...(formData.groupId && { groupId: formData.groupId }),
            ...(formData.newGroupName && { newGroupName: formData.newGroupName }),
          },
          getAuthHeaders(),
        );
        toast.success("Student created successfully.");
      }
      await Promise.all([fetchStudents(), showGroupColumn ? fetchGroups() : Promise.resolve()]);
      setIsStudentModalOpen(false);
    } catch (error) {
      toast.error(
        "Error saving student: " +
          (error.response?.data?.message || error.message),
      );
    }
  };

  const filteredData = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAssigned =
        filterAssigned === ""
          ? true
          : filterAssigned === "assigned"
          ? student.isAssigned
          : !student.isAssigned;

      const matchesProgress =
        filterProgress === ""
          ? true
          : filterProgress === "active"
          ? student.totalSessions > 0
          : student.totalSessions === 0;

      return matchesSearch && matchesAssigned && matchesProgress;
    });
  }, [students, searchTerm, filterAssigned, filterProgress]);

  const { sortedData, sortConfig, handleSort } = useSorting(filteredData);

  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  const {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    pageNumbers,
    handlePageChange,
    nextPage,
    prevPage,
    isFirstPage,
    isLastPage,
    rangeStart,
    rangeEnd,
    resetPage,
  } = usePagination(sortedData, 8);

  useEffect(() => {
    resetPage();
  }, [searchTerm, sortConfig, filterAssigned, filterProgress]);

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Students Management
        </h1>
      </div>

      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div className="flex gap-3 flex-1">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search student name or email"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                filterAssigned || filterProgress
                  ? "border-orange-400 bg-orange-50 text-orange-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FunnelIcon className="h-5 w-5" />
              Filters
              {(filterAssigned || filterProgress) && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-400 text-white rounded-full">
                  {[filterAssigned, filterProgress].filter(Boolean).length}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3 space-y-3">
                {showScenariosColumn && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Scenarios</p>
                    <select
                      value={filterAssigned}
                      onChange={(e) => setFilterAssigned(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">All students</option>
                      <option value="assigned">Has assigned scenarios</option>
                      <option value="unassigned">Not assigned</option>
                    </select>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Progress</p>
                  <select
                    value={filterProgress}
                    onChange={(e) => setFilterProgress(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="">All progress</option>
                    <option value="active">Has sessions</option>
                    <option value="inactive">No sessions yet</option>
                  </select>
                </div>
                {(filterAssigned || filterProgress) && (
                  <button
                    onClick={() => { setFilterAssigned(""); setFilterProgress(""); }}
                    className="w-full text-xs text-gray-500 hover:text-gray-800 underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {showScenariosColumn && (
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-lg transition-colors"
            >
              Assign Scenarios
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            style={{ display: "none" }}
            disabled={isUploading}
          />
          <button
            onClick={handleBulkUploadClick}
            disabled={isUploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <ArrowUpTrayIcon className="h-5 w-5" />
            {isUploading ? "Uploading..." : "Upload Bulk Students"}
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
          >
            <PlusIcon className="h-5 w-5" />
            New Student
          </button>
        </div>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/50">
            <tr>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                onClick={() => handleSort("visualId")}
              >
                ID{getSortIcon("visualId")}
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                onClick={() => handleSort("name")}
              >
                Student Name{getSortIcon("name")}
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                onClick={() => handleSort("email")}
              >
                Email Address{getSortIcon("email")}
              </th>
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                onClick={() => handleSort("schoolName")}
              >
                School Name{getSortIcon("schoolName")}
              </th>
              {showGroupColumn && (
                <th
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSort("groupName")}
                >
                  Group{getSortIcon("groupName")}
                </th>
              )}
              <th
                className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                onClick={() => handleSort("totalSessions")}
              >
                Progress{getSortIcon("totalSessions")}
              </th>
              {showScenariosColumn && (
                <th
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSort("assignedScenariosCount")}
                >
                  Scenarios{getSortIcon("assignedScenariosCount")}
                </th>
              )}
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Transcript
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} className="px-6 py-12 text-center">
                  <Spinner size={32} />
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No students found.
                </td>
              </tr>
            ) : (
              paginatedData.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td
                    className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500"
                    title={student.id}
                  >
                    {student.visualId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                    {student.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {student.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 max-w-xs truncate">
                    {student.schoolName}
                  </td>
                  {showGroupColumn && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {student.groupName ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {student.groupName}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {student.progress !== "N/A" ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-gray-900">{student.progress} avg</span>
                        {student.bestScore && (
                          <span className="text-xs text-gray-400">{student.bestScore} best · {student.totalSessions} sessions</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">No sessions yet</span>
                    )}
                  </td>
                  {showScenariosColumn && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {student.isAssigned ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {student.assignedScenariosCount} scenario{student.assignedScenariosCount !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Not Assigned
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() =>
                        setSelectedStudent(student.originalData || student)
                      }
                      className="text-blue-600 hover:text-blue-800 font-medium underline decoration-blue-300 underline-offset-2"
                    >
                      View
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-4">
                      {canManageStudents && (
                        <>
                          <button
                            onClick={() => handleEdit(student)}
                            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                            Edit
                          </button>
                          {/* 5. Replace Profile button with Delete button */}
                          <button
                            onClick={() => handleDelete(student.id)}
                            className="flex items-center gap-1.5 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <PaginationBar
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageNumbers={pageNumbers}
        onPageChange={handlePageChange}
        onPrevPage={prevPage}
        onNextPage={nextPage}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />
      </div>

      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center">
          <StudentModal
            studentData={editingStudent}
            onSave={handleSaveStudent}
            onClose={() => setIsStudentModalOpen(false)}
            role={role}
            defaultSchoolName={user?.schoolName || ""}
            groups={groups}
          />
        </div>
      )}
      {isAssignModalOpen && showScenariosColumn && (
        <AssignScenariosModal
          onClose={() => setIsAssignModalOpen(false)}
          onAssignSuccess={() => {
            fetchStudents();
            toast.success("Scenarios assigned successfully");
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("scenarioAssignmentsChanged"),
              );
            }
          }}
        />
      )}
      {selectedStudent && (
        <TranscriptViewerModal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          student={selectedStudent}
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={() => {
          onConfirmAction();
          setIsConfirmModalOpen(false);
        }}
        title={confirmTitle}
        message={confirmMessage}
      />
    </div>
  );
}

export default StudentPage;
