import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import Papa from "papaparse";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

import StudentModal from "../StudentModal";
import AssignScenariosModal from "./AssignScenariosModal";
import TranscriptViewerModal from "../ui/TranscriptViewerModal";
import ConfirmationModal from "../ui/ConfirmationModal";
import { toast } from "react-hot-toast";
import { useAuth } from "../../AuthContext";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

function StudentPage({ role }) {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState(() => {});

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "/api/users?role=student",
        getAuthHeaders(),
      );
      const mappedData = response.data.map((student) => ({
        id: student._id,
        visualId: `VS${student._id.slice(-6).toUpperCase()}`,
        user_id: student._id,
        name: student.name || "Unknown",
        email: student.email || "No Email",
        schoolName: student.schoolId?.schoolName || "Unassigned",
        progress: "N/A",
        assignedScenariosCount: 0,
        isAssigned: false,
        originalData: student,
      }));
      setStudents(mappedData);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Could not load students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
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
          { name: formData.name, email: formData.email },
          getAuthHeaders(),
        );
        toast.success("Student updated successfully.");
      } else {
        await axios.post(
          "/api/users",
          { name: formData.name, email: formData.email, role: "student" },
          getAuthHeaders(),
        );
        toast.success("Student created successfully.");
      }
      await fetchStudents();
      setIsStudentModalOpen(false);
    } catch (error) {
      toast.error(
        "Error saving student: " +
          (error.response?.data?.message || error.message),
      );
    }
  };

  const filteredData = useMemo(() => {
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [students, searchTerm]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

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
          <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <FunnelIcon className="h-5 w-5" />
            Filters
          </button>
        </div>

        <div className="flex gap-3">
          {role !== "school_admin" && (
            <>
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-lg transition-colors"
              >
                Assign Scenarios
              </button>
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
            </>
          )}
        </div>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Student Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Email Address
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                School Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Assigned Scenarios
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Transcript
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td
                  colSpan="8"
                  className="px-6 py-12 text-center text-gray-500"
                >
                  Loading students...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.progress}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {student.isAssigned ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Assigned ({student.assignedScenariosCount})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Not Assigned
                      </span>
                    )}
                  </td>
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
                      {role !== "school_admin" && (
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

      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-500">
          Showing{" "}
          <span className="font-medium">
            {(currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          to{" "}
          <span className="font-medium">
            {Math.min(currentPage * itemsPerPage, filteredData.length)}
          </span>{" "}
          of <span className="font-medium">{filteredData.length}</span> total
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          {[...Array(Math.ceil(filteredData.length / itemsPerPage))].map(
            (_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === idx + 1
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {idx + 1}
              </button>
            ),
          )}
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(
                  prev + 1,
                  Math.ceil(filteredData.length / itemsPerPage),
                ),
              )
            }
            disabled={
              currentPage >= Math.ceil(filteredData.length / itemsPerPage)
            }
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {isStudentModalOpen && role !== "school_admin" && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center">
          <StudentModal
            studentData={editingStudent}
            onSave={handleSaveStudent}
            onClose={() => setIsStudentModalOpen(false)}
            role={role}
            defaultSchoolName={user?.schoolName || ""}
          />
        </div>
      )}
      {isAssignModalOpen && role !== "school_admin" && (
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
