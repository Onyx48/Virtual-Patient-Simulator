// src/components/Schools/SchoolsPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../../../AuthContext";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { parse, format } from "date-fns";

import SchoolManagementControls from "./SchoolManagementControls.jsx";
import SchoolTable from "./SchoolTable.jsx";

function SchoolsPage() {
  const { user } = useAuth();
  const navigate = useNavigate(); // For navigation

  const [schools, setSchools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch Schools
  const fetchSchools = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/schools", {
        params: { searchTerm },
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
  const handleDeleteClick = async (schoolId) => {
    if (window.confirm("Are you sure you want to delete this school?")) {
      try {
        await axios.delete(`/api/schools/${schoolId}`);
        fetchSchools(); // Refresh list
      } catch (err) {
        console.error(err);
        alert("Failed to delete school.");
      }
    }
  };

  if (isLoading) return <div className="p-8">Loading schools...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">School Management</h1>
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
    </div>
  );
}

export default SchoolsPage;
