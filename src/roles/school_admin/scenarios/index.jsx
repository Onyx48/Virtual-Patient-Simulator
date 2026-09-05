import React, { useState, useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Squares2X2Icon, TableCellsIcon } from "@heroicons/react/24/outline";

import ScenarioManagementControls from "../../educator/scenarios/ScenarioManagementControls.jsx";
import ScenarioTable from "../../educator/scenarios/ScenarioTable.jsx";
import ScenarioListTable from "./ScenarioListTable.jsx";
import PaginationBar from "../../../components/ui/PaginationBar";
import ConfirmationModal from "../../../components/ui/ConfirmationModal";

import { usePagination } from "../../../lib/hooks/usePagination";
import { Spinner } from "../../../lib/hooks/useLoading";

import {
  fetchScenarios,
  deleteScenario,
  setSelectedScenario,
} from "../../../redux/slices/scenarioSlice.js";

const VIEW_STORAGE_KEY = "schoolAdmin.scenarios.view";

function SchoolAdminScenariosPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { scenarios, loading, error } = useSelector((state) => state.scenarios);

  // Table is the default view; the choice is remembered per browser so the
  // page does not snap back to a view the admin just switched away from.
  const [view, setView] = useState(
    () => localStorage.getItem(VIEW_STORAGE_KEY) || "table",
  );

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [filterCriteria, setFilterCriteria] = useState({});

  const [pendingDelete, setPendingDelete] = useState(null);

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
  } = usePagination(filteredAndSortedScenarios, view === "table" ? 15 : 8);

  useEffect(() => {
    resetPage();
  }, [searchTerm, filterCriteria, view]);

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

  const handleEditClick = (scenario) => {
    // ScenarioFormPage reads the record from the store rather than refetching.
    dispatch(setSelectedScenario(scenario));
    navigate(`/scenarios/edit/${scenario._id || scenario.id}`);
  };

  const handleDeleteConfirm = async () => {
    const scenario = pendingDelete;
    setPendingDelete(null);
    if (!scenario) return;
    try {
      await dispatch(deleteScenario(scenario._id || scenario.id)).unwrap();
      toast.success("Scenario deleted.");
    } catch (err) {
      toast.error(err?.message || "Failed to delete the scenario.");
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center"><Spinner size={32} /></div>
    );
  if (error)
    return (
      <div className="p-8 text-center text-red-500">
        Error loading data: {typeof error === "object" ? error.message : error}
      </div>
    );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Scenarios Management
        </h1>

        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {[
            { key: "table", label: "Table", Icon: TableCellsIcon },
            { key: "cards", label: "Cards", Icon: Squares2X2Icon },
          ].map((option) => (
            <button
              key={option.key}
              onClick={() => setView(option.key)}
              aria-pressed={view === option.key}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                view === option.key
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <option.Icon className="w-4 h-4" />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ScenarioManagementControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        initialFilters={filterCriteria}
        onApplyFilters={handleApplyFilters}
      />

      {view === "table" ? (
        <ScenarioListTable
          data={paginatedData}
          sortConfig={sortConfig}
          onSort={handleSort}
          onEditClick={handleEditClick}
          onDeleteClick={setPendingDelete}
          canManage
        />
      ) : (
        <ScenarioTable
          data={paginatedData}
          canEdit
          onEditClick={handleEditClick}
          onSort={handleSort}
          sortConfig={sortConfig}
        />
      )}

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

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Scenario"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.scenarioName}"? This cannot be undone.`
            : ""
        }
      />
    </div>
  );
}

export default SchoolAdminScenariosPage;
