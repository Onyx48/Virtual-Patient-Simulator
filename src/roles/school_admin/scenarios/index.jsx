import React, { useState, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../AuthContext";

// Import Shared Components
import ScenarioManagementControls from "../../educator/scenarios/ScenarioManagementControls.jsx";
import ScenarioTable from "../../educator/scenarios/ScenarioTable.jsx";
// Import Assign Modal (Ensure this path matches your project structure)
import AssignScenariosModal from "../../../components/shared/AssignScenariosModal.jsx";

import {
  fetchScenarios,
  setSelectedScenario,
} from "../../../redux/slices/scenarioSlice.js";

function SchoolAdminScenariosPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get scenarios from Redux Store
  const { scenarios, loading, error } = useSelector((state) => state.scenarios);

  // Local Component State
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [filterCriteria, setFilterCriteria] = useState({});
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Fetch Data on Component Mount
  useEffect(() => {
    dispatch(fetchScenarios());
  }, [dispatch]);

  // --- FILTERING LOGIC ---
  const filteredScenarios = useMemo(() => {
    if (!scenarios) return [];
    let currentData = [...scenarios];

    // 1. Search Filter (Name, Description, Creator)
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(
        (s) =>
          s.scenarioName?.toLowerCase().includes(lowerTerm) ||
          s.description?.toLowerCase().includes(lowerTerm) ||
          (s.creator?.name || "").toLowerCase().includes(lowerTerm)
      );
    }

    // 2. Status Filter
    if (filterCriteria.status) {
      currentData = currentData.filter(
        (s) => s.status === filterCriteria.status
      );
    }

    // 3. Creator Filter (Optional text input match)
    if (filterCriteria.creator) {
      currentData = currentData.filter((s) =>
        (s.creator?.name || "")
          .toLowerCase()
          .includes(filterCriteria.creator.toLowerCase())
      );
    }

    return currentData;
  }, [scenarios, searchTerm, filterCriteria]);

  // --- SORTING LOGIC ---
  const filteredAndSortedScenarios = useMemo(() => {
    let sortableItems = [...filteredScenarios];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle Creator field which is an object
        if (sortConfig.key === "creator") {
          aValue = typeof aValue === "object" ? aValue?.name : aValue;
          bValue = typeof bValue === "object" ? bValue?.name : bValue;
        }

        // Handle nulls
        if (!aValue) return 1;
        if (!bValue) return -1;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredScenarios, sortConfig]);

  // --- HANDLERS ---
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

  const handleAddNewClick = () => {
    navigate("/scenarios/add");
  };

  const handleEditClick = (scenario) => {
    dispatch(setSelectedScenario(scenario));
    navigate(`/scenarios/edit/${scenario._id || scenario.id}`);
  };

  const handleAssignClick = () => {
    setIsAssignModalOpen(true);
  };

  // Simple filter application (you can expand this to a modal if needed)
  const handleApplyFilters = (filters) => {
    setFilterCriteria((prev) => ({ ...prev, ...filters }));
  };

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">
        Loading school scenarios...
      </div>
    );
  if (error)
    return (
      <div className="p-8 text-center text-red-500">
        Error loading data: {typeof error === "object" ? error.message : error}
      </div>
    );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Scenarios Management
      </h1>

      <ScenarioManagementControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onAddNewClick={handleAddNewClick}
        onAssignScenariosClick={handleAssignClick} // School Admin Feature
        initialFilters={filterCriteria}
        onApplyFilters={handleApplyFilters}
      />

      {/* Renders the Table View for School Admins */}
      <ScenarioTable
        data={filteredAndSortedScenarios}
        onEditClick={handleEditClick}
        variant="table"
        onSort={handleSort}
        sortConfig={sortConfig}
      />

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <AssignScenariosModal
          onClose={() => setIsAssignModalOpen(false)}
          onAssignSuccess={() => dispatch(fetchScenarios())}
        />
      )}
    </div>
  );
}

export default SchoolAdminScenariosPage;
