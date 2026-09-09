import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

import {
  ACCEPTED_EXTENSIONS,
  buildTemplateWorkbook,
  buildUserPayload,
  readRows,
  templateFilename,
} from "../lib/bulkUsers";

import EducatorModal from "./EducatorModal";
import ConfirmationModal from "./ui/ConfirmationModal.jsx";
import PaginationBar from "./ui/PaginationBar";
import { toast } from "react-hot-toast";
import { useAuth } from "../AuthContext";
import { usePagination } from "../lib/hooks/usePagination";
import { useLoading, Spinner } from "../lib/hooks/useLoading";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

function EducatorsPage() {
  const { user } = useAuth();
  const [educators, setEducators] = useState([]);
  const { isLoading, withLoading } = useLoading(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEducator, setEditingEducator] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState(() => {});

  const fetchEducators = async () => {
    await withLoading(async () => {
      const response = await axios.get(
        "/api/users?role=educator",
        getAuthHeaders(),
      );
      const mappedData = response.data.map((user) => ({
        id: user._id,
        visualId: `VS${user._id.slice(-6).toUpperCase()}`,
        name: user.name,
        email: user.email,
        department: user.department,
      }));
      setEducators(mappedData);
    });
  };

  useEffect(() => {
    fetchEducators();
  }, []);

  const handleAddNew = () => {
    setEditingEducator(null);
    setIsModalOpen(true);
  };

  const handleBulkUploadClick = () => {
    fileInputRef.current.click();
  };

  /*
   * Hands the user the exact file the importer wants rather than describing it.
   * Shares every rule with the student importer — see lib/bulkUsers.js — so the
   * two cannot drift apart.
   */
  const handleDownloadTemplate = () => {
    XLSX.writeFile(buildTemplateWorkbook("educator"), templateFilename("educator"));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const clearInput = () => {
      // Reset so picking the same file again re-fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    setIsUploading(true);
    const uploadToast = toast.loading(`Reading ${file.name}...`);

    let parsed;
    try {
      parsed = buildUserPayload(await readRows(file), "educator");
    } catch (error) {
      toast.error(error.message, { id: uploadToast, duration: 6000 });
      setIsUploading(false);
      clearInput();
      return;
    }

    const { users, errors, missing } = parsed;

    if (missing.length > 0) {
      toast.error(
        `That file is missing the ${missing.join(" and ")} column. Download the template to see the expected layout.`,
        { id: uploadToast, duration: 8000 },
      );
      setIsUploading(false);
      clearInput();
      return;
    }

    /*
     * Bad rows are shown to the user, not just logged. The old version put them
     * in the console and said "Check console", which nobody outside this team is
     * going to do — so a failed import looked like a partial success with no
     * explanation.
     */
    const describe = (list) =>
      list
        .slice(0, 5)
        .map((e) => `Row ${e.row}: ${e.reason}`)
        .join("\n") + (list.length > 5 ? `\n...and ${list.length - 5} more.` : "");

    if (users.length === 0) {
      toast.error(
        errors.length > 0
          ? `Nothing could be imported.\n${describe(errors)}`
          : "That file has the right columns but no educator rows.",
        { id: uploadToast, duration: 10000, style: { whiteSpace: "pre-line" } },
      );
      setIsUploading(false);
      clearInput();
      return;
    }

    toast.loading(`Uploading ${users.length} educators...`, { id: uploadToast });
    try {
      const response = await axios.post(
        "/api/users/bulk",
        { users, role: "educator" },
        getAuthHeaders(),
      );
      toast.success(`Upload complete! ${response.data.successCount} created.`, {
        id: uploadToast,
        duration: 5000,
      });

      // Rows the server rejected — an address already in use, most often — are
      // reported the same way as the ones this file failed on.
      const serverErrors = (response.data.errors || []).map((e) => ({
        row: "—",
        reason: `${e.email}: ${e.reason}`,
      }));
      const allErrors = [...errors, ...serverErrors];
      if (allErrors.length > 0) {
        console.error("Bulk upload failures:", allErrors);
        toast.error(`${allErrors.length} row(s) were skipped.\n${describe(allErrors)}`, {
          duration: 10000,
          style: { whiteSpace: "pre-line" },
        });
      }
      await fetchEducators();
    } catch (error) {
      toast.error(
        "Bulk upload failed: " + (error.response?.data?.message || "Server error"),
        { id: uploadToast },
      );
    } finally {
      setIsUploading(false);
      clearInput();
    }
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
        setEducators((prev) => prev.filter((e) => e.id !== id));
        toast.success("Educator deleted successfully");
      } catch (error) {
        toast.error(
          "Failed to delete educator: " +
            (error.response?.data?.message || error.message),
        );
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleSave = async (formData) => {
    try {
      if (formData.id) {
        await axios.put(
          `/api/users/${formData.id}`,
          {
            name: formData.educatorName,
            email: formData.emailAddress,
            department: formData.department,
          },
          getAuthHeaders(),
        );
        toast.success("Educator updated successfully");
      } else {
        await axios.post(
          "/api/users",
          {
            name: formData.educatorName,
            email: formData.emailAddress,
            role: "educator",
            department: formData.department,
            schoolId: user.schoolId,
          },
          getAuthHeaders(),
        );
        toast.success("Educator created successfully");
      }
      await fetchEducators();
      setIsModalOpen(false);
    } catch (error) {
      toast.error(
        "Error saving: " + (error.response?.data?.message || error.message),
      );
    }
  };

  const filteredData = useMemo(() => {
    return educators
      .filter(
        (e) =>
          e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.email.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .filter(
        (e) => departmentFilter === "" || e.department === departmentFilter,
      );
  }, [educators, searchTerm, departmentFilter]);

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
  } = usePagination(filteredData, 8);

  useEffect(() => {
    resetPage();
  }, [searchTerm, departmentFilter]);

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Educators Management
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
              placeholder="Search for an educator"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={ACCEPTED_EXTENSIONS.join(",")}
            style={{ display: "none" }}
            disabled={isUploading}
          />
          <button
            onClick={handleDownloadTemplate}
            title="Download the .xlsx template for bulk upload"
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-bold rounded-lg transition-colors shadow-sm"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Template
          </button>
          <button
            onClick={handleBulkUploadClick}
            disabled={isUploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <ArrowUpTrayIcon className="h-5 w-5" />
            {isUploading ? "Uploading..." : "Upload Bulk Educators"}
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
          >
            <PlusIcon className="h-5 w-5" />
            New Educator
          </button>
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
            {isLoading ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center">
                  <Spinner size={32} />
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
