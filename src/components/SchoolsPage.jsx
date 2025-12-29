// src/components/SchoolsPage.jsx
import React, { useState } from 'react';
import SchoolManagementControls from '../roles/superadmin/schools/SchoolManagementControls.jsx'; // Temporarily import
import SchoolTable from '../roles/superadmin/schools/SchoolTable.jsx';
import SchoolModal from './SchoolModal.jsx';
import { useEntityFilters } from '../lib/hooks/useEntityFilters.js';
import { useSorting } from '../lib/hooks/useSorting.js';

function SchoolsPage({ schools, onAdd, onEdit, onDelete, canEdit = true, canAdd = true }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCriteria, setFilterCriteria] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);

  // Filter schools
  const filteredSchools = useEntityFilters(
    schools,
    searchTerm,
    filterCriteria,
    ['schoolName', 'email', 'description']
  );

  // Sort schools
  const { sortedData, handleSort } = useSorting(filteredSchools);

  const handleAddClick = () => {
    if (canAdd) {
      setEditingSchool(null);
      setIsModalOpen(true);
    }
  };

  const handleEditClick = (school) => {
    if (canEdit) {
      setEditingSchool(school);
      setIsModalOpen(true);
    }
  };

  const handleModalSave = (data) => {
    if (editingSchool) {
      onEdit(editingSchool._id, data);
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
      <SchoolManagementControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onApplyFilters={handleApplyFilters}
        onAddNewClick={handleAddClick}
        initialFilters={filterCriteria}
      />
      <SchoolTable
        data={sortedData}
        onEditClick={handleEditClick}
        onDeleteClick={onDelete}
        onSort={handleSort}
        canEdit={canEdit}
      />
      {isModalOpen && (
        <SchoolModal
          school={editingSchool}
          onSave={handleModalSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default SchoolsPage;