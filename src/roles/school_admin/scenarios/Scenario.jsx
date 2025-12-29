import React, { useState, useMemo } from "react";

import ScenarioManagementControls from "./ScenarioManagementControls.jsx";
import ScenarioTable from "./ScenarioTable.jsx";
import ScenarioModal from "./ScenarioModal.jsx";
import initialScenarios from "./initialScenarios.json"




function ScenarioPage() {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [filterCriteria, setFilterCriteria] = useState({});

  const handleSaveScenario = (scenarioData) => {
    console.log("Saving scenario:", scenarioData);
    if (scenarioData.id) {
      // Update
      setScenarios((prevScenarios) =>
        prevScenarios.map((scenario) =>
          scenario.id === scenarioData.id
            ? { ...scenario, ...scenarioData }
            : scenario
        )
      );
    } else {
      // Add
      const newScenarioWithId = {
        ...scenarioData,
        id: Date.now() + Math.random(),
      };
      setScenarios((prevScenarios) => [...prevScenarios, newScenarioWithId]);
    }
    setModalOpen(false);
    setIsEdit(false);
    setCurrentScenario(null);
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
    setCurrentScenario(scenario);
    setIsEdit(true);
    setModalOpen(true);
  };

  const handleAddNewClick = () => {
    console.log("handleAddNewClick triggered!");
    setCurrentScenario(null);
    setIsEdit(false);
    setModalOpen(true);
  };

  const handleApplyFilters = (filters) => {
    console.log("Applying filter criteria:", filters);
    setFilterCriteria(filters);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setIsEdit(false);
    setCurrentScenario(null);
  };

  return (
    <div className="p-4">
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
          <ScenarioModal
            isEdit={isEdit}
            scenarioData={currentScenario}
            onSave={handleSaveScenario}
            onClose={handleCloseModal}
          />
        </div>
      )}
    </div>
  );
}

export default ScenarioPage;
