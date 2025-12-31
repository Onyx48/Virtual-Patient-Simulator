import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

// Import Modal
import EducatorModal from "./EducatorModal";
import ConfirmationModal from "./ui/ConfirmationModal.jsx";
import { toast } from "react-hot-toast";
import { useAuth } from "../AuthContext";

// Helper for Auth Headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

function EducatorsPage() {
  const { user } = useAuth();
  // --- State ---
  const [educators, setEducators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEducator, setEditingEducator] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState(() => {});

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // --- API ---
  const fetchEducators = async () => {
    try {
      setLoading(true);
      // Fetch users with role='educator'
      const response = await axios.get(
        "/api/users?role=educator",
        getAuthHeaders()
      );

      const mappedData = response.data.map((user) => ({
        id: user._id,
        visualId: `VS${user._id.slice(-6).toUpperCase()}`,
        name: user.name,
        email: user.email,
        department: user.department, // Ensure this maps correctly
      }));
      setEducators(mappedData);
    } catch (error) {
      console.error("Error fetching educators:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEducators();
  }, []);

  // --- Handlers ---
  const handleAddNew = () => {
    setEditingEducator(null);
    setIsModalOpen(true);
  };

  const handleEdit = (educator) => {
    setEditingEducator(educator);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setConfirmTitle("Delete Educator");
    setConfirmMessage("Are you sure you want to delete this educator?");
    setOnConfirmAction(() => async () => {
      try {
        await axios.delete(`/api/users/${id}`, getAuthHeaders());
        // Optimistic UI update
        setEducators((prev) => prev.filter((e) => e.id !== id));
        toast.success("Educator deleted successfully");
      } catch (error) {
        toast.error(
          "Failed to delete educator: " +
            (error.response?.data?.message || error.message)
        );
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleSave = async (formData) => {
    try {
      if (formData.id) {
        // Edit Existing Educator
        await axios.put(
          `/api/users/${formData.id}`,
          {
            name: formData.educatorName,
            email: formData.emailAddress,
            department: formData.department,
          },
          getAuthHeaders()
        );
        toast.success("Educator updated successfully");
      } else {
        // Add New Educator
        await axios.post(
          "/api/users",
          {
            name: formData.educatorName,
            email: formData.emailAddress,
            password: formData.password,
            role: "educator",
            department: formData.department,
          },
          getAuthHeaders()
        );
        toast.success("Educator created successfully");
      }
      // Refresh list
      await fetchEducators();
      setIsModalOpen(false);
    } catch (error) {
      toast.error(
        "Error saving: " + (error.response?.data?.message || error.message)
      );
    }
  };

  // --- Filter & Pagination ---
  const filteredData = useMemo(() => {
    return educators
      .filter(
        (e) =>
          e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter(
        (e) => departmentFilter === "" || e.department === departmentFilter
      );
  }, [educators, searchTerm, departmentFilter]);

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
          Educators Management
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
              placeholder="Search for a educator"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors appearance-none bg-white cursor-pointer"
            >
              <option value="">All Departments</option>
              <option value="Science">Science</option>
              <option value="History">History</option>
              <option value="English">English</option>
              <option value="Mathematics">Mathematics</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
          >
            <PlusIcon className="h-5 w-5" />
            New Educator
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
                Educator Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Email Address
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Department
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
                  colSpan="5"
                  className="px-6 py-12 text-center text-gray-500"
                >
                  Loading educators...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No educators found.
                </td>
              </tr>
            ) : (
              paginatedData.map((educator) => (
                <tr
                  key={educator.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {educator.visualId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                    {educator.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {educator.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {educator.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleEdit(educator)}
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(educator.id)}
                        className="flex items-center gap-1 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <EducatorModal
            educatorData={editingEducator}
            onSave={handleSave}
            onClose={() => setIsModalOpen(false)}
          />
        </div>
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

export default EducatorsPage;
