// src/components/Schools/SchoolsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios"; // For API calls
import { useAuth } from "@/AuthContext"; // For user role and token (if JWT)

import SchoolManagementControls from "./SchoolManagementControls.jsx";
import SchoolTable from "./SchoolTable.jsx";

import { parse, format } from "date-fns"; // Make sure format is imported

function SchoolsPage() {
  const { user } = useAuth(); // Get logged-in user to determine permissions
  const [schools, setSchools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);

  const [editingSchool, setEditingSchool] = useState(null);
  const [isAddingSchool, setIsAddingSchool] = useState(false);

  const [filterCriteria, setFilterCriteria] = useState({});

  const fetchSchools = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Construct query params from filterCriteria and searchTerm
      const params = {
        ...filterCriteria,
        searchTerm: searchTerm,
        // Format dates back to DD/MM/YYYY for API if they are Date objects
        startDateAfter: filterCriteria.startDateAfter
          ? format(filterCriteria.startDateAfter, "dd/MM/yyyy")
          : undefined,
        expireDateBefore: filterCriteria.expireDateBefore
          ? format(filterCriteria.expireDateBefore, "dd/MM/yyyy")
          : undefined,
      };
      const response = await axios.get("/api/schools", { params });
      // Ensure dates are parsed back to Date objects from "dd/MM/yyyy" string for frontend components (like DatePicker)
      const fetchedSchools = response.data.map((school) => ({
        ...school,
        startDate: school.startDate
          ? parse(
              format(new Date(school.startDate), "dd/MM/yyyy"),
              "dd/MM/yyyy",
              new Date()
            )
          : null,
        expireDate: school.expireDate
          ? parse(
              format(new Date(school.expireDate), "dd/MM/yyyy"),
              "dd/MM/yyyy",
              new Date()
            )
          : null,
      }));
      setSchools(fetchedSchools);
    } catch (err) {
      console.error("Error fetching schools:", err.response?.data || err);
      setError(err.response?.data?.message || "Failed to load schools.");
    } finally {
      setIsLoading(false);
    }
  }, [filterCriteria, searchTerm]); // Depend on filter/search terms to re-fetch

  useEffect(() => {
    fetchSchools(); // Initial fetch and re-fetch on filter/search changes
  }, [fetchSchools]); // Dependency on fetchSchools to avoid infinite loop

  const handleAddSchool = async (newSchoolData) => {
    try {
      // Format dates to DD/MM/YYYY string for backend
      const formattedData = {
        ...newSchoolData,
        startDate: newSchoolData.startDate
          ? format(newSchoolData.startDate, "dd/MM/yyyy")
          : null,
        expireDate: newSchoolData.expireDate
          ? format(newSchoolData.expireDate, "dd/MM/yyyy")
          : null,
      };
      const response = await axios.post("/api/schools", formattedData);
      alert(response.data.message);
      setIsAddingSchool(false);
      fetchSchools(); // Re-fetch to update the list
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add school.");
      console.error("Add School Error:", err.response?.data || err);
    }
  };

  const handleUpdateSchool = async (updatedSchoolData) => {
    try {
      // Format dates to DD/MM/YYYY string for backend
      const formattedData = {
        ...updatedSchoolData,
        startDate: updatedSchoolData.startDate
          ? format(updatedSchoolData.startDate, "dd/MM/yyyy")
          : null,
        expireDate: updatedSchoolData.expireDate
          ? format(updatedSchoolData.expireDate, "dd/MM/yyyy")
          : null,
      };
      const response = await axios.put(
        `/api/schools/${updatedSchoolData.id}`,
        formattedData
      );
      alert(response.data.message);
      setEditingSchool(null);
      fetchSchools(); // Re-fetch to update the list
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update school.");
      console.error("Update School Error:", err.response?.data || err);
    }
  };

  const handleDeleteSchool = async (schoolId) => {
    if (window.confirm("Are you sure you want to delete this school?")) {
      try {
        const response = await axios.delete(`/api/schools/${schoolId}`);
        alert(response.data.message);
        fetchSchools(); // Re-fetch to update the list
      } catch (err) {
        alert(err.response?.data?.message || "Failed to delete school.");
        console.error("Delete School Error:", err.response?.data || err);
      }
    }
  };

  const filteredAndSortedSchools = useMemo(() => {
    // Since fetching already applies filters, this memoization is primarily for sorting
    let sortableItems = [...schools];

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // Handle null/undefined values for sorting
        if (aValue === null || aValue === undefined)
          return sortConfig.direction === "asc" ? 1 : -1;
        if (bValue === null || bValue === undefined)
          return sortConfig.direction === "asc" ? -1 : 1;

        if (sortConfig.key === "startDate" || sortConfig.key === "expireDate") {
          // Dates are already Date objects from fetchSchools, so direct comparison
          const dateA = aValue;
          const dateB = bValue;

          if (!dateA && !dateB) return 0;
          if (!dateA) return sortConfig.direction === "asc" ? 1 : -1;
          if (!dateB) return sortConfig.direction === "asc" ? -1 : 1;

          const comparison = dateA.getTime() - dateB.getTime();
          return sortConfig.direction === "asc" ? comparison : -comparison;
        }

        if (sortConfig.key === "timeSpent") {
          const numA = parseInt(aValue, 10); // "10h" -> 10
          const numB = parseInt(bValue, 10);
          if (isNaN(numA) && isNaN(numB)) return 0;
          if (isNaN(numA)) return sortConfig.direction === "asc" ? 1 : -1;
          if (isNaN(numB)) return sortConfig.direction === "asc" ? -1 : 1;
          const comparison = numA - numB;
          return sortConfig.direction === "asc" ? comparison : -comparison;
        }

        // Default string/number comparison
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [schools, sortConfig]); // Depend only on schools and sortConfig

  const handleSearchChange = (term) => {
    setSearchTerm(term);
    // fetchSchools will be triggered by searchTerm dependency
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    } else if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "desc"
    ) {
      setSortConfig(null); // Clear sort
      return;
    }
    setSortConfig({ key, direction });
  };

  const handleEditClick = (school) => {
    setEditingSchool(school);
  };

  const handleDeleteClick = (schoolId) => {
    handleDeleteSchool(schoolId);
  };

  const handleAddNewClick = () => {
    setIsAddingSchool(true);
  };

  const handleApplyFilters = (filters) => {
    setFilterCriteria(filters);
    // fetchSchools will be triggered by filterCriteria dependency
  };

  const handleCloseEditDialog = () => {
    setEditingSchool(null);
  };
  const handleCloseAddDialog = () => {
    setIsAddingSchool(false);
  };

  if (isLoading) {
    return <div className="p-4 text-gray-700">Loading schools data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  // Role-based access for SuperAdmin
  const canManageSchools = user && user.role === "superadmin";

  return (
    <div className="p-4">
      <SchoolManagementControls
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onAddNewClick={canManageSchools ? handleAddNewClick : null} // Only allow if SuperAdmin
        initialFilters={filterCriteria}
        onApplyFilters={handleApplyFilters}
      />

      <SchoolTable
        data={filteredAndSortedSchools}
        onEditClick={canManageSchools ? handleEditClick : null} // Only allow if SuperAdmin
        onDeleteClick={canManageSchools ? handleDeleteClick : null} // Only allow if SuperAdmin
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      {editingSchool && (
        <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
          <SchoolModal
            schoolData={editingSchool}
            onSave={handleUpdateSchool}
            onClose={handleCloseEditDialog}
          />
        </div>
      )}

      {isAddingSchool && (
        <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
          <SchoolModal
            onSave={handleAddSchool}
            onClose={handleCloseAddDialog}
          />
        </div>
      )}


    </div>
  );
}

export default SchoolsPage;
