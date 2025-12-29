import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  PencilSquareIcon,
  UserCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

// Import Modals (Ensure these exist in src/components/)
import StudentModal from "../StudentModal";
import AssignScenariosModal from "./AssignScenariosModal";

// Helper for Auth Headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

function StudentPage({ role }) {
  // Accepting role as prop if specific logic is needed later
  // --- State Management ---
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal States
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // --- API Functions ---
  const fetchStudents = async () => {
    try {
      setLoading(true);
      // The backend automatically filters this based on the logged-in user's role/scope
      const response = await axios.get("/api/students", getAuthHeaders());

      // Map Backend Data to UI Structure
      const mappedData = response.data.map((student) => ({
        id: student._id, // Internal ID
        visualId: `VS${student._id.slice(-6).toUpperCase()}`, // Visual ID (VS987654)
        user_id: student.user?._id,
        name: student.user?.name || "Unknown",
        email: student.user?.email || "No Email",
        schoolName: student.school || "Unassigned",
        progress: student.grade || "0%", // Mapping Grade to Progress
        originalData: student,
      }));
      setStudents(mappedData);
    } catch (error) {
      console.error("Error loading students:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // --- Handlers ---
  const handleAddNew = () => {
    setEditingStudent(null);
    setIsStudentModalOpen(true);
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = async (formData) => {
    try {
      if (formData.id) {
        // Update Existing
        if (formData.user_id) {
          await axios.put(
            `/api/users/${formData.user_id}`,
            {
              name: formData.name,
              email: formData.email,
            },
            getAuthHeaders()
          );
        }
        await axios.put(
          `/api/students/${formData.id}`,
          {
            grade: formData.progress,
            school: formData.schoolName,
          },
          getAuthHeaders()
        );
      } else {
        // Create New
        await axios.post(
          "/api/users",
          {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: "student",
            grade: formData.progress,
            schoolId: formData.schoolName,
          },
          getAuthHeaders()
        );
      }
      await fetchStudents(); // Refresh table
      setIsStudentModalOpen(false);
    } catch (error) {
      alert(
        "Error saving student: " +
          (error.response?.data?.message || error.message)
      );
    }
  };

  // --- Filtering & Pagination Logic ---
  const filteredData = useMemo(() => {
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  // --- Render ---
  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Students Management
        </h1>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div className="flex gap-3 flex-1">
          {/* Search */}
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

          {/* Filter Button */}
          <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <FunnelIcon className="h-5 w-5" />
            Filters
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-lg transition-colors"
          >
            Assign Scenarios
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

      {/* Table */}
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
                  colSpan="7"
                  className="px-6 py-12 text-center text-gray-500"
                >
                  Loading students...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
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
                    <button className="text-blue-600 hover:text-blue-800 font-medium underline decoration-blue-300 underline-offset-2">
                      View
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleEdit(student)}
                        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                        Edit
                      </button>
                      <button className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors">
                        <UserCircleIcon className="w-4 h-4" />
                        Profile
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
            )
          )}
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(
                  prev + 1,
                  Math.ceil(filteredData.length / itemsPerPage)
                )
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

      {/* Modals */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <StudentModal
            studentData={editingStudent}
            onSave={handleSaveStudent}
            onClose={() => setIsStudentModalOpen(false)}
          />
        </div>
      )}

      {isAssignModalOpen && (
        <AssignScenariosModal
          onClose={() => setIsAssignModalOpen(false)}
          onAssignSuccess={() => {
            /* Add toast notification here if desired */
          }}
        />
      )}
    </div>
  );
}

export default StudentPage;
