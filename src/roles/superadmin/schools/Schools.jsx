import React, { useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../../../AuthContext";
import { useNavigate } from "react-router-dom";
import { parse, format } from "date-fns";
import { getAuthHeaders } from "../../../lib/utils.js";

import SchoolManagementControls from "./SchoolManagementControls.jsx";
import SchoolTable from "./SchoolTable.jsx";
import SchoolAdminModal from "../../../components/SchoolAdminModal.jsx";
import ConfirmationModal from "../../../components/ui/ConfirmationModal.jsx";
import PaginationBar from "../../../components/ui/PaginationBar";
import { toast } from "react-hot-toast";
import { useServerPagination } from "../../../lib/hooks/useServerPagination";
import { Spinner } from "../../../lib/hooks/useLoading";

const toSchoolRow = (school) => ({
  ...school,
  startDate: school.startDate ? new Date(school.startDate) : null,
  expireDate: school.expireDate ? new Date(school.expireDate) : null,
});

function SchoolsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [isSchoolAdminModalOpen, setIsSchoolAdminModalOpen] = useState(false);
  const [availableSchools, setAvailableSchools] = useState([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState(() => {});
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [isInvitingId, setIsInvitingId] = useState(null);

  const [sortConfig, setSortConfig] = useState(null);
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };

  const fetchAvailableSchools = useCallback(async () => {
    try {
      const response = await axios.get("/api/schools", {
        params: { availableForSchoolAdmin: true },
        ...getAuthHeaders(),
      });
      return response.data.map(toSchoolRow);
    } catch (err) {
      console.error("Error fetching available schools:", err);
      return [];
    }
  }, []);

  // Only the visible page is fetched; search and sort run server-side.
  const {
    paginatedData,
    isInitialLoading,
    refetch: fetchSchools,
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
  } = useServerPagination("/api/schools", {
    params: { searchTerm },
    pageSize: 15,
    sortConfig,
    mapItem: toSchoolRow,
  });

  const handleAddNewClick = () => {
    navigate("/schools/add");
  };

  const handleEditClick = (school) => {
    navigate(`/schools/edit/${school._id}`);
  };

  // Handle Delete
  const handleDeleteClick = (schoolId) => {
    setConfirmTitle("Delete School");
    setConfirmMessage(
      "Are you sure you want to delete this school? This action cannot be undone.",
    );
    setOnConfirmAction(() => async () => {
      setIsDeletingId(schoolId);
      try {
        await axios.delete(`/api/schools/${schoolId}`, getAuthHeaders());
        toast.success("School deleted successfully.");
        fetchSchools();
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || "Failed to delete school.");
      } finally {
        setIsDeletingId(null);
      }
    });
    setIsConfirmModalOpen(true);
  };

  // Sending credentials always issues a NEW password (the stored one is a hash
  // and cannot be re-read), so confirm before invalidating the existing one.
  const handleInviteClick = (school) => {
    const invited = school.inviteStatus === "invited";
    const target = school.assignedAdmin?.email || school.email;

    setConfirmTitle(invited ? "Send a new password" : "Send invite");
    setConfirmMessage(
      invited
        ? `Generate a new password for ${target} and email it? Their current password will stop working.`
        : school.assignedAdmin?.id
          ? `Email login credentials to ${target}?`
          : `${school.schoolName} has no admin yet. A school admin account will be created for ${target} and the credentials emailed to them.`,
    );
    setOnConfirmAction(() => async () => {
      setIsInvitingId(school._id);
      try {
        const { data } = await axios.post(
          `/api/schools/${school._id}/invite`,
          {},
          getAuthHeaders(),
        );
        toast.success(data.message || "Credentials sent.");
        fetchSchools();
      } catch (err) {
        console.error(err);
        toast.error(
          err.response?.data?.message || "Failed to send the credentials.",
        );
      } finally {
        setIsInvitingId(null);
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleCreateSchoolAdmin = async (data) => {
    try {
      await axios.post("/api/users", data, getAuthHeaders());
      toast.success("School Admin created successfully.");
      fetchSchools();
      setIsSchoolAdminModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create school admin.");
    }
  };

  if (isInitialLoading)
    return (
      <div className="p-8 flex justify-center">
        <Spinner size={40} />
      </div>
    );

  return (
    <div className="p-6 w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">School Management</h1>
        {user?.role === "superadmin" && (
          <button
            onClick={async () => {
              const schools = await fetchAvailableSchools();
              setAvailableSchools(schools);
              setIsSchoolAdminModalOpen(true);
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            New School Admin
          </button>
        )}
      </div>

      <SchoolManagementControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onAddNewClick={handleAddNewClick}
      />

      <SchoolTable
        data={paginatedData}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onSort={handleSort}
        canEdit={user?.role === "superadmin"}
        isDeletingId={isDeletingId}
        onInviteClick={handleInviteClick}
        isInvitingId={isInvitingId}
      />
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

      {isSchoolAdminModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <SchoolAdminModal
            schools={availableSchools}
            onSave={handleCreateSchoolAdmin}
            onClose={() => setIsSchoolAdminModalOpen(false)}
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

export default SchoolsPage;
