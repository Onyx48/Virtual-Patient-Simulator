// src/components/StudentsPage.jsx
import React, { useState, useEffect } from 'react';
import StudentManagementControls from '../roles/educator/students/StudentManagementControls.jsx';
import StudentTable from '../roles/educator/students/StudentTable.jsx';
import StudentModal from './StudentModal.jsx';
import AssignScenarios from '../components/shared/AssignScenarios.jsx';
import TranscriptViewerModal from './ui/TranscriptViewerModal.jsx';
import PaginationBar from './ui/PaginationBar';
import { useEntityFilters } from '../lib/hooks/useEntityFilters.js';
import { useSorting } from '../lib/hooks/useSorting.js';
import { usePagination } from '../lib/hooks/usePagination';

function StudentsPage({ students, onAdd, onEdit, onDelete, canEdit = true, canAdd = true, canAssign = true }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCriteria, setFilterCriteria] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isAssigningScenarios, setIsAssigningScenarios] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Filter students
  const filteredStudents = useEntityFilters(
    students,
    searchTerm,
    filterCriteria,
    ['studentName', 'emailAddress', 'schoolName']
  );

  // Sort students
  const { sortedData, handleSort } = useSorting(filteredStudents);

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

  const handleViewTranscriptClick = (student) => {
    setSelectedStudent(student);
  };

  const handleCloseTranscriptModal = () => {
    setSelectedStudent(null);
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
        data={paginatedData}
        onEditClick={handleEditClick}
        onDeleteClick={onDelete}
        onViewTranscriptClick={handleViewTranscriptClick}
        onViewProfileClick={() => {}}
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
      {selectedStudent && (
        <TranscriptViewerModal
          isOpen={!!selectedStudent}
          onClose={handleCloseTranscriptModal}
          student={selectedStudent}
        />
      )}
    </div>
  );
}

export default StudentsPage;