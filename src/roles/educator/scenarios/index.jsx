import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../AuthContext";

import ScenarioManagementControls from "./ScenarioManagementControls.jsx";
import ScenarioTable from "./ScenarioTable.jsx";
import PaginationBar from "../../../components/ui/PaginationBar";
// import AssignScenariosModal from "../../components/shared/AssignScenariosModal";

import { useServerPagination } from "../../../lib/hooks/useServerPagination";
import { Spinner } from "../../../lib/hooks/useLoading";

import {
  setSelectedScenario,
} from "../../../redux/slices/scenarioSlice.js";

function ScenariosPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();


  const canEditScenarios =
    user?.role === "educator" || user?.role === "superadmin";

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [filterCriteria, setFilterCriteria] = useState({});
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Only the visible page is fetched; search, filters and sort run server-side.
  const {
    paginatedData,
    isInitialLoading: loading,
    error,
    refetch: refetchScenarios,
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
  } = useServerPagination("/api/scenarios", {
    params: { searchTerm, status: filterCriteria.status || "" },
    pageSize: 8,
    sortConfig,
  });

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
          onAssignSuccess={refetchScenarios}
        />
      )}
    </div>
  );
}

export default ScenariosPage;
