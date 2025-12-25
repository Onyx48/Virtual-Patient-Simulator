import React, { useState, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../AuthContext';

import ScenarioManagementControls from "./ScenarioManagementControls.jsx";
import ScenarioTable from "./ScenarioTable.jsx";
import ScenarioModal from "./ScenarioModal.jsx";

import { fetchScenarios, setSelectedScenario, clearSelectedScenario } from '../../../redux/slices/scenarioSlice.js';

function ScenariosPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scenarios, loading, error } = useSelector((state) => state.scenarios);

  const canEditScenarios = user?.role === 'educator' || user?.role === 'superadmin';

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [editingScenario, setEditingScenario] = useState(null);
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({});

  useEffect(() => {
    dispatch(fetchScenarios());
  }, [dispatch]);

  const handleAddScenario = (newScenarioData) => {
    console.log("Adding new scenario:", newScenarioData);
    // Dispatch addScenario thunk here when backend is ready
    setIsAddingScenario(false);
  };

  const handleUpdateScenario = (updatedScenarioData) => {
    console.log("Updating scenario:", updatedScenarioData);
    // Dispatch updateScenario thunk here
    setEditingScenario(null);
  };

  const filteredScenarios = useMemo(() => {
    let currentData = scenarios;

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(
        (scenario) =>
          scenario.scenarioName.toLowerCase().includes(lowerCaseSearchTerm) ||
          scenario.description.toLowerCase().includes(lowerCaseSearchTerm) ||
          scenario.creator.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    const hasActiveFilters = Object.values(filterCriteria).some(
      (value) => value !== "" && value !== null && value !== undefined
    );
    if (hasActiveFilters) {
      currentData = currentData.filter((scenario) => {
        let matchesFilters = true;
        if (filterCriteria.status && filterCriteria.status !== "") {
          if (scenario.status !== filterCriteria.status) {
            matchesFilters = false;
          }
        }
        if (filterCriteria.creator && filterCriteria.creator !== "") {
          if (
            !scenario.creator
              .toLowerCase()
              .includes(filterCriteria.creator.toLowerCase())
          ) {
            matchesFilters = false;
          }
        }
        return matchesFilters;
      });
    }

    return currentData;
  }, [scenarios, searchTerm, filterCriteria]);

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
        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredScenarios, sortConfig]);

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

  const handleEditClick = (scenario) => {
    if (!canEditScenarios) return; // Students have read-only access
    dispatch(setSelectedScenario(scenario));
    navigate(`/scenarios/edit/${scenario.id}`);
  };

  const handleAddNewClick = () => {
    if (!canEditScenarios) return; // Students have read-only access
    console.log("handleAddNewClick triggered!");
    navigate('/scenarios/add');
  };

  const handleApplyFilters = (filters) => {
    console.log("Applying filter criteria:", filters);
    setFilterCriteria(filters);
  };

  const handleCloseEditDialog = () => {
    setEditingScenario(null);
    dispatch(clearSelectedScenario());
  };
  const handleCloseAddDialog = () => {
    setIsAddingScenario(false);
  };

  if (loading) return <div>Loading scenarios...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4">
      <ScenarioManagementControls
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onAddNewClick={canEditScenarios ? handleAddNewClick : null}
        initialFilters={filterCriteria}
        onApplyFilters={handleApplyFilters}
      />

      <ScenarioTable
        data={filteredAndSortedScenarios}
        onEditClick={canEditScenarios ? handleEditClick : null}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      {editingScenario && (
        <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
          <ScenarioModal
            scenarioData={editingScenario}
            onSave={handleUpdateScenario}
            onClose={handleCloseEditDialog}
          />
        </div>
      )}

      {isAddingScenario && (
        <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
          <ScenarioModal
            onSave={handleAddScenario}
            onClose={handleCloseAddDialog}
          />
        </div>
      )}


    </div>
  );
}

export default ScenariosPage;