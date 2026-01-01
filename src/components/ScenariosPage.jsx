// src/components/ScenariosPage.jsx
import React, { useState } from 'react';
import ScenarioManagementControls from '../roles/educator/scenarios/ScenarioManagementControls.jsx'; // Temporarily import, later make shared
import ScenarioTable from '../roles/educator/scenarios/ScenarioTable.jsx';
import ScenarioModal from './ScenarioModal.jsx';
import { useEntityFilters } from '../lib/hooks/useEntityFilters.js';
import { useSorting } from '../lib/hooks/useSorting.js';

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
        data={sortedData}
        onEditClick={handleEditClick}
        onSort={handleSort}
        canEdit={canEdit}
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