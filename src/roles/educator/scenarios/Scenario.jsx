import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import ScenarioManagementControls from "./CourseManagementControl.jsx";
import ScenarioTable from "./ScenarioTable.jsx";

import initialScenarios from "./initialScenarios.json";

function ScenariosPage() {
  const navigate = useNavigate();

  const [scenarios, setScenarios] = useState(initialScenarios);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCriteria, setFilterCriteria] = useState({});
  const [sortConfig, setSortConfig] = useState(null);

  const handleAddNewClick = () => {
    navigate("/scenarios/add");
  };

  const handleEditClick = (scenario) => {
    navigate(`/scenarios/edit/${scenario.id}`);
  };

  const filteredScenarios = useMemo(() => {
    let currentData = scenarios;

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(
        (s) =>
          s.scenarioName.toLowerCase().includes(lowerTerm) ||
          s.description.toLowerCase().includes(lowerTerm) ||
          s.educator.toLowerCase().includes(lowerTerm),
      );
    }

    if (filterCriteria.status) {
      currentData = currentData.filter(
        (s) => s.status === filterCriteria.status,
      );
    }

    return currentData;
  }, [scenarios, searchTerm, filterCriteria]);

  const filteredAndSortedScenarios = useMemo(() => {
    let items = [...filteredScenarios];
    if (sortConfig !== null) {
      items.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue == null) return sortConfig.direction === "asc" ? 1 : -1;
        if (bValue == null) return sortConfig.direction === "asc" ? -1 : 1;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [filteredScenarios, sortConfig]);

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
