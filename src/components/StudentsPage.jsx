// src/components/StudentsPage.jsx
import React, { useState } from 'react';
import StudentManagementControls from '../roles/educator/students/StudentManagementControls.jsx'; // Temporarily import
import StudentTable from '../roles/educator/students/StudentTable.jsx';
import StudentModal from './StudentModal.jsx';
import AssignScenarios from '../components/shared/AssignScenarios.jsx';
import { useEntityFilters } from '../lib/hooks/useEntityFilters.js';
import { useSorting } from '../lib/hooks/useSorting.js';

function StudentsPage({ students, onAdd, onEdit, onDelete, canEdit = true, canAdd = true, canAssign = true }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCriteria, setFilterCriteria] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isAssigningScenarios, setIsAssigningScenarios] = useState(false);

  // Filter students
  const filteredStudents = useEntityFilters(
    students,
    searchTerm,
    filterCriteria,
    ['studentName', 'emailAddress', 'schoolName']
  );

  // Sort students
  const { sortedData, handleSort } = useSorting(filteredStudents);

  const handleAddClick = () => {
    if (canAdd) {
      setEditingStudent(null);
      setIsModalOpen(true);
    }
  };

  const handleEditClick = (student) => {
    if (canEdit) {
      setEditingStudent(student);
      setIsModalOpen(true);
    }
  };

  const handleAssignClick = () => {
    if (canAssign) {
      setIsAssigningScenarios(true);
    }
  };

  const handleModalSave = (data) => {
    if (editingStudent) {
      onEdit(editingStudent.id, data);
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
      <StudentManagementControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onApplyFilters={handleApplyFilters}
        onAddNewClick={handleAddClick}
        onAssignScenariosClick={handleAssignClick}
        initialFilters={filterCriteria}
      />
      <StudentTable
        data={sortedData}
        onEditClick={handleEditClick}
        onDeleteClick={onDelete}
        onViewTranscriptClick={() => {}}
        onViewProfileClick={() => {}}
        onSort={handleSort}
        canEdit={canEdit}
      />
      {isModalOpen && (
        <StudentModal
          student={editingStudent}
          onSave={handleModalSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      {isAssigningScenarios && (
        <AssignScenarios
          onClose={() => setIsAssigningScenarios(false)}
        />
      )}
    </div>
  );
}

export default StudentsPage;