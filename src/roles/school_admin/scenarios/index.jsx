import React, { useState, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import ScenarioManagementControls from "../../educator/scenarios/ScenarioManagementControls.jsx";
import ScenarioTable from "../../educator/scenarios/ScenarioTable.jsx";

import { fetchScenarios } from "../../../redux/slices/scenarioSlice.js";

function SchoolAdminScenariosPage() {
  const dispatch = useDispatch();

  const { scenarios, loading, error } = useSelector((state) => state.scenarios);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [filterCriteria, setFilterCriteria] = useState({});

  useEffect(() => {
    dispatch(fetchScenarios());
  }, [dispatch]);

  const filteredScenarios = useMemo(() => {
    if (!scenarios) return [];
    let currentData = [...scenarios];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(
        (s) =>
          s.scenarioName?.toLowerCase().includes(lowerTerm) ||
          s.description?.toLowerCase().includes(lowerTerm) ||
          (s.educator?.name || "").toLowerCase().includes(lowerTerm),
      );
    }

    if (filterCriteria.status) {
      currentData = currentData.filter(
        (s) => s.status === filterCriteria.status,
      );
    }

    if (filterCriteria.educator) {
      currentData = currentData.filter((s) =>
        (s.educator?.name || "")
          .toLowerCase()
          .includes(filterCriteria.educator.toLowerCase()),
      );
    }

    return currentData;
  }, [scenarios, searchTerm, filterCriteria]);

  const filteredAndSortedScenarios = useMemo(() => {
    let sortableItems = [...filteredScenarios];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === "educator") {
          aValue = typeof aValue === "object" ? aValue?.name : aValue;
          bValue = typeof bValue === "object" ? bValue?.name : bValue;
        }

        if (!aValue) return 1;
        if (!bValue) return -1;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredScenarios, sortConfig]);

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
        initialFilters={filterCriteria}
        onApplyFilters={handleApplyFilters}
      />

      <ScenarioTable
        data={filteredAndSortedScenarios}
        canEdit={false}
        variant="table"
        onSort={handleSort}
        sortConfig={sortConfig}
      />
    </div>
  );
}

export default SchoolAdminScenariosPage;
