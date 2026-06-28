// src/components/ScenariosPage.jsx
import React, { useState, useEffect } from 'react';
import ScenarioManagementControls from '../roles/educator/scenarios/ScenarioManagementControls.jsx';
import ScenarioTable from '../roles/educator/scenarios/ScenarioTable.jsx';
import ScenarioModal from './ScenarioModal.jsx';
import PaginationBar from './ui/PaginationBar';
import { useEntityFilters } from '../lib/hooks/useEntityFilters.js';
import { useSorting } from '../lib/hooks/useSorting.js';
import { usePagination } from '../lib/hooks/usePagination';

function ScenariosPage({ scenarios, onAdd, onEdit, canEdit = true, canAdd = true }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCriteria, setFilterCriteria] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);

  // Filter scenarios
  const filteredScenarios = useEntityFilters(
    scenarios,
    searchTerm,
    filterCriteria,
    ['scenarioName', 'description', 'educator']
  );

  // Sort scenarios
  const { sortedData, handleSort } = useSorting(filteredScenarios);

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
  } = usePagination(sortedData, 8);

  useEffect(() => {
    resetPage();
  }, [searchTerm, filterCriteria]);

  const handleAddClick = () => {
    if (canAdd) {
      setEditingScenario(null);
      setIsModalOpen(true);
    }
  };

  const handleEditClick = (scenario) => {
    if (canEdit) {
      setEditingScenario(scenario);
      setIsModalOpen(true);
    }
  };

  const handleModalSave = (data) => {
    if (editingScenario) {
      onEdit(editingScenario._id, data);
    } else {
      onAdd(data);
    }
    setIsModalOpen(false);
  };

  const handleApplyFilters = (filters) => {
    setFilterCriteria(filters);
  };

  return (
    <div>
      <ScenarioManagementControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onApplyFilters={handleApplyFilters}
        onAddNewClick={handleAddClick}
        initialFilters={filterCriteria}
      />
      <ScenarioTable
        data={paginatedData}
        onEditClick={handleEditClick}
        onSort={handleSort}
        canEdit={canEdit}
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
      {isModalOpen && (
        <ScenarioModal
          scenario={editingScenario}
          onSave={handleModalSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default ScenariosPage;