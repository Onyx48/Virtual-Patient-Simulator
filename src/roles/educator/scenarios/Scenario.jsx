import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

// --- Components ---
import ScenarioManagementControls from "./ScenarioManagementControls.jsx";
import ScenarioTable from "./ScenarioTable.jsx";

// --- Mock Data ---
// Ensure this file exists in the same folder with the data I gave you previously
import initialScenarios from "./initialScenarios.json";

function ScenariosPage() {
  const navigate = useNavigate();

  // --- STATE: Initialize directly with Mock Data ---
  const [scenarios, setScenarios] = useState(initialScenarios);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCriteria, setFilterCriteria] = useState({});
  const [sortConfig, setSortConfig] = useState(null);

  // --- NAVIGATION HANDLERS ---
  const handleAddNewClick = () => {
    navigate("/scenarios/add");
  };

  const handleEditClick = (scenario) => {
    // Navigate to edit page with ID
    navigate(`/scenarios/edit/${scenario.id}`);
  };

  // --- FILTERING LOGIC ---
  const filteredScenarios = useMemo(() => {
    let currentData = scenarios;

    // 1. Search Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(
        (s) =>
          s.scenarioName.toLowerCase().includes(lowerTerm) ||
          s.description.toLowerCase().includes(lowerTerm) ||
          s.creator.toLowerCase().includes(lowerTerm)
      );
    }

    // 2. Dropdown Filters
    if (filterCriteria.status) {
      currentData = currentData.filter(
        (s) => s.status === filterCriteria.status
      );
    }
    // Add other filters here if needed (e.g. Creator)

    return currentData;
  }, [scenarios, searchTerm, filterCriteria]);

  // --- SORTING LOGIC ---
  const filteredAndSortedScenarios = useMemo(() => {
    let items = [...filteredScenarios];
    if (sortConfig !== null) {
      items.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // Handle nulls
        if (aValue == null) return sortConfig.direction === "asc" ? 1 : -1;
        if (bValue == null) return sortConfig.direction === "asc" ? -1 : 1;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [filteredScenarios, sortConfig]);

  // --- CONTROLS HANDLERS ---
  const handleSearchChange = (term) => {
    setSearchTerm(term);
  };

  const handleApplyFilters = (filters) => {
    setFilterCriteria(filters);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Scenarios Management
      </h1>

      <ScenarioManagementControls
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onAddNewClick={handleAddNewClick}
        onApplyFilters={handleApplyFilters}
        initialFilters={filterCriteria}
      />

      <ScenarioTable
        data={filteredAndSortedScenarios}
        onEditClick={handleEditClick}
        sortConfig={sortConfig}
        onSort={handleSort}
      />
    </div>
  );
}

export default ScenariosPage;
