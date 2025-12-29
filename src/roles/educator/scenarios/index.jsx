import React, { useState, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../AuthContext";

import ScenarioManagementControls from "./ScenarioManagementControls.jsx";
import ScenarioTable from "./ScenarioTable.jsx";
// import AssignScenariosModal from "../../components/shared/AssignScenariosModal";

// We only need fetchScenarios now. The FormPage handles specific selection via ID.
import {
  fetchScenarios,
  setSelectedScenario,
} from "../../../redux/slices/scenarioSlice.js";

function ScenariosPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get data from Redux
  const { scenarios, loading, error } = useSelector((state) => state.scenarios);

  // Role check
  const canEditScenarios =
    user?.role === "educator" || user?.role === "superadmin";

  // Local state for UI controls
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [filterCriteria, setFilterCriteria] = useState({});
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Load scenarios on mount
  useEffect(() => {
    dispatch(fetchScenarios());
  }, [dispatch]);

  // --- FILTERING LOGIC ---
  const filteredScenarios = useMemo(() => {
    if (!scenarios) return [];
    let currentData = [...scenarios];

    // 1. Search
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(
        (scenario) =>
          scenario.scenarioName?.toLowerCase().includes(lowerCaseSearchTerm) ||
          scenario.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
          scenario.creator?.name?.toLowerCase().includes(lowerCaseSearchTerm) // Handling populated creator object
      );
    }

    // 2. Advanced Filters
    const hasActiveFilters = Object.values(filterCriteria).some(
      (value) => value !== "" && value !== null && value !== undefined
    );

    if (hasActiveFilters) {
      currentData = currentData.filter((scenario) => {
        let matchesFilters = true;
        if (filterCriteria.status && filterCriteria.status !== "") {
          if (scenario.status !== filterCriteria.status) matchesFilters = false;
        }
        // Add other filters here if needed
        return matchesFilters;
      });
    }

    return currentData;
  }, [scenarios, searchTerm, filterCriteria]);

  // --- SORTING LOGIC ---
  const filteredAndSortedScenarios = useMemo(() => {
    let sortableItems = [...filteredScenarios];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined)
          return sortConfig.direction === "asc" ? 1 : -1;
        if (bValue === null || bValue === undefined)
          return sortConfig.direction === "asc" ? -1 : 1;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredScenarios, sortConfig]);

  // --- HANDLERS ---

  const handleSearchChange = (term) => {
    setSearchTerm(term);
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
      setSortConfig(null);
      return;
    }
    setSortConfig({ key, direction });
  };

  // CLEANED UP: Just navigate to the Add Page
  const handleAddNewClick = () => {
    if (!canEditScenarios) return;
    navigate("/scenarios/add");
  };

  // CLEANED UP: Just navigate to the Edit Page
  const handleEditClick = (scenario) => {
    if (!canEditScenarios) return;
    // Optional: Pre-set selected scenario in Redux to avoid loading delay on next page
    dispatch(setSelectedScenario(scenario));
    // Use _id (MongoDB default) or id depending on your backend response
    const scenarioId = scenario._id || scenario.id;
    navigate(`/scenarios/edit/${scenarioId}`);
  };

  const handleApplyFilters = (filters) => {
    setFilterCriteria(filters);
  };

  const handleAssignScenariosClick = () => {
    if (!canEditScenarios) return;
    setIsAssignModalOpen(true);
  };

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">Loading scenarios...</div>
    );
  if (error)
    return (
      <div className="p-8 text-center text-red-500">
        Error: {typeof error === "object" ? error.message : error}
      </div>
    );

  return (
    <div className="p-4">
      <ScenarioManagementControls
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onAddNewClick={canEditScenarios ? handleAddNewClick : null}
        onAssignScenariosClick={
          canEditScenarios ? handleAssignScenariosClick : null
        }
        initialFilters={filterCriteria}
        onApplyFilters={handleApplyFilters}
      />

      <ScenarioTable
        data={filteredAndSortedScenarios}
        onEditClick={canEditScenarios ? handleEditClick : null}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      {/* Only the Assign Modal remains (if you use it for students) */}
      {/* {isAssignModalOpen && (
        <AssignScenariosModal
          onClose={() => setIsAssignModalOpen(false)}
          onAssignSuccess={() => dispatch(fetchScenarios())}
        />
      )} */}
    </div>
  );
}

export default ScenariosPage;
