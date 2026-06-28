import React, { useState, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../AuthContext";

import ScenarioManagementControls from "./ScenarioManagementControls.jsx";
import ScenarioTable from "./ScenarioTable.jsx";
import PaginationBar from "../../../components/ui/PaginationBar";
// import AssignScenariosModal from "../../components/shared/AssignScenariosModal";

import { usePagination } from "../../../lib/hooks/usePagination";
import { Spinner } from "../../../lib/hooks/useLoading";

import {
  fetchScenarios,
  setSelectedScenario,
} from "../../../redux/slices/scenarioSlice.js";

function ScenariosPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { scenarios, loading, error } = useSelector((state) => state.scenarios);

  const canEditScenarios =
    user?.role === "educator" || user?.role === "superadmin";

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [filterCriteria, setFilterCriteria] = useState({});
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchScenarios());
  }, [dispatch]);

  const filteredScenarios = useMemo(() => {
    if (!scenarios) return [];
    let currentData = [...scenarios];

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(
        (scenario) =>
          scenario.scenarioName?.toLowerCase().includes(lowerCaseSearchTerm) ||
          scenario.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
          scenario.educator?.name?.toLowerCase().includes(lowerCaseSearchTerm),
      );
    }

    const hasActiveFilters = Object.values(filterCriteria).some(
      (value) => value !== "" && value !== null && value !== undefined,
    );

    if (hasActiveFilters) {
      currentData = currentData.filter((scenario) => {
        let matchesFilters = true;
        if (filterCriteria.status && filterCriteria.status !== "") {
          if (scenario.status !== filterCriteria.status) matchesFilters = false;
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

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredScenarios, sortConfig]);

  const {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    pageNumbers,
    handlePageChange,
    nextPage,
    prevPage,
    isFirstPage,
    isLastPage,
    rangeStart,
    rangeEnd,
    resetPage,
  } = usePagination(filteredAndSortedScenarios, 8);

  useEffect(() => {
    resetPage();
  }, [searchTerm, filterCriteria]);

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

  const handleAddNewClick = () => {
    if (!canEditScenarios) return;
    navigate("/scenarios/add");
  };

  const handleEditClick = (scenario) => {
    if (!canEditScenarios) return;
    dispatch(setSelectedScenario(scenario));
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
      <div className="p-8 text-center"><Spinner size={32} /></div>
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
        data={paginatedData}
        onEditClick={canEditScenarios ? handleEditClick : null}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <PaginationBar
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageNumbers={pageNumbers}
        onPageChange={handlePageChange}
        onPrevPage={prevPage}
        onNextPage={nextPage}
        isFirstPage={isFirstPage}
        isLastPage={isLastPage}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />

      {isAssignModalOpen && (
        <AssignScenariosModal
          onClose={() => setIsAssignModalOpen(false)}
          onAssignSuccess={() => dispatch(fetchScenarios())}
        />
      )}
    </div>
  );
}

export default ScenariosPage;
