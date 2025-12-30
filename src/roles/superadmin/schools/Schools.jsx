// src/components/Schools/SchoolsPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../../../AuthContext";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { parse, format } from "date-fns";
import { getAuthHeaders } from "../../../lib/utils.js";

import SchoolManagementControls from "./SchoolManagementControls.jsx";
import SchoolTable from "./SchoolTable.jsx";
import SchoolAdminModal from "../../../components/SchoolAdminModal.jsx";
import ConfirmationModal from "../../../components/ui/ConfirmationModal.jsx";
import { toast } from 'react-hot-toast';

function SchoolsPage() {
  const { user } = useAuth();
  const navigate = useNavigate(); // For navigation

  const [schools, setSchools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSchoolAdminModalOpen, setIsSchoolAdminModalOpen] = useState(false);
  const [availableSchools, setAvailableSchools] = useState([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [onConfirmAction, setOnConfirmAction] = useState(() => {});

  // Fetch Schools
  const fetchSchools = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/schools", {
        params: { searchTerm },
        ...getAuthHeaders(),
      });

      const fetchedSchools = response.data.map((school) => ({
        ...school,
        // Ensure dates are parsed correctly for the Table display
        startDate: school.startDate ? new Date(school.startDate) : null,
        expireDate: school.expireDate ? new Date(school.expireDate) : null,
      }));
      setSchools(fetchedSchools);
    } catch (err) {
      console.error("Error fetching schools:", err);
      setError(err.response?.data?.message || "Failed to load schools.");
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  // Fetch Available Schools for School Admin Creation
  const fetchAvailableSchools = useCallback(async () => {
    try {
      const response = await axios.get("/api/schools", {
        params: { availableForSchoolAdmin: true },
        ...getAuthHeaders(),
      });
      return response.data.map((school) => ({
        ...school,
        startDate: school.startDate ? new Date(school.startDate) : null,
        expireDate: school.expireDate ? new Date(school.expireDate) : null,
      }));
    } catch (err) {
      console.error("Error fetching available schools:", err);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  // Handle Add: Navigate to Unified Form Page (Add Mode)
  const handleAddNewClick = () => {
    navigate("/schools/add");
  };

  // Handle Edit: Navigate to Unified Form Page (Edit Mode)
  const handleEditClick = (school) => {
    navigate(`/schools/edit/${school._id}`); // Pass ID in URL
  };

  // Handle Delete
  const handleDeleteClick = (schoolId) => {
    setConfirmTitle('Delete School');
    setConfirmMessage('Are you sure you want to delete this school?');
    setOnConfirmAction(() => async () => {
      try {
        await axios.delete(`/api/schools/${schoolId}`, getAuthHeaders());
        fetchSchools(); // Refresh list
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete school.");
      }
    });
    setIsConfirmModalOpen(true);
  };

  // Handle Create School Admin
  const handleCreateSchoolAdmin = async (data) => {
    try {
      await axios.post("/api/users", data, getAuthHeaders());
      toast.success("School Admin created successfully.");
      fetchSchools(); // Refresh the schools list to show updated assignments
      setIsSchoolAdminModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create school admin.");
    }
  };

  if (isLoading) return <div className="p-8">Loading schools...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
        data={schools}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onSort={() => {}}
        canEdit={user?.role === "superadmin"}
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
