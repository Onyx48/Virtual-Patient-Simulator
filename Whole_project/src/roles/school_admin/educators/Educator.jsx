import React, { useState, useMemo } from "react";

import EducatorManagementControls from "./EducatorManagementControls.jsx";
import EducatorTable from "./EducatorTable.jsx";
import initialEducators from "./initialEducators.json"
import EducatorModal from "./EducatorModal.jsx";
// import ViewTranscript from "./ViewTranscript";
// import ViewProfile from "./ViewProfile";





function EducatorPage() {
  const [educators, setEducators] = useState(initialEducators);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);

  const [editingEducator, setEditingEducator] = useState(null);
  const [isAddingEducator, setIsAddingEducator] = useState(false);

  const [filterCriteria, setFilterCriteria] = useState({});

  const handleAddEducator = (newEducatorData) => {
    console.log("Adding new educator:", newEducatorData);
    const newEducatorWithId = {
      ...newEducatorData,
      id: Date.now() + Math.random(),
    };
    setEducators((prevEducators) => [...prevEducators, newEducatorWithId]);
    setIsAddingEducator(false);
  };

  const handleUpdateEducator = (updatedEducatorData) => {
    console.log("Updating educator:", updatedEducatorData);
    setEducators((prevEducators) =>
      prevEducators.map((educator) =>
        educator.id === updatedEducatorData.id
          ? { ...educator, ...updatedEducatorData }
          : educator
      )
    );
    setEditingEducator(null);
  };

  const filteredEducators = useMemo(() => {
    let currentData = educators;

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(
        (educator) =>
          educator.educatorName.toLowerCase().includes(lowerCaseSearchTerm) ||
          educator.emailAddress.toLowerCase().includes(lowerCaseSearchTerm) ||
          educator.schoolName.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    const hasActiveFilters = Object.values(filterCriteria).some(
      (value) =>
        value !== "" &&
        value !== null &&
        value !== undefined &&
        !(typeof value === "number" && isNaN(value))
    );

    if (hasActiveFilters) {
      currentData = currentData.filter((educator) => {
        let matchesFilters = true;

        if (filterCriteria.educatorName && filterCriteria.educatorName !== "") {
          if (
            !educator.educatorName
              .toLowerCase()
              .includes(filterCriteria.educatorName.toLowerCase())
          ) {
            matchesFilters = false;
          }
        }

        if (filterCriteria.schoolName && filterCriteria.schoolName !== "") {
          if (
            !educator.schoolName
              .toLowerCase()
              .includes(filterCriteria.schoolName.toLowerCase())
          ) {
            matchesFilters = false;
          }
        }

        if (
          filterCriteria.numberOfStudentsMin !== undefined &&
          filterCriteria.numberOfStudentsMin !== null &&
          !isNaN(filterCriteria.numberOfStudentsMin)
        ) {
          const educatorStudents = parseInt(educator.numberOfStudents);
          if (
            isNaN(educatorStudents) ||
            educatorStudents < filterCriteria.numberOfStudentsMin
          ) {
            matchesFilters = false;
          }
        }
        if (
          filterCriteria.numberOfStudentsMax !== undefined &&
          filterCriteria.numberOfStudentsMax !== null &&
          !isNaN(filterCriteria.numberOfStudentsMax)
        ) {
          const educatorStudents = parseInt(educator.numberOfStudents);
          if (
            isNaN(educatorStudents) ||
            educatorStudents > filterCriteria.numberOfStudentsMax
          ) {
            matchesFilters = false;
          }
        }



        return matchesFilters;
      });
    }

    return currentData;
  }, [educators, searchTerm, filterCriteria]);

  const filteredAndSortedEducators = useMemo(() => {
    let sortableItems = [...filteredEducators];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined)
          return sortConfig.direction === "asc" ? 1 : -1;
        if (bValue === null || bValue === undefined)
          return sortConfig.direction === "asc" ? -1 : 1;

        if (sortConfig.key === "numberOfStudents") {
          const numA = parseInt(aValue);
          const numB = parseInt(bValue);

          if (isNaN(numA) && isNaN(numB)) return 0;
          if (isNaN(numA)) return sortConfig.direction === "asc" ? 1 : -1;
          if (isNaN(numB)) return sortConfig.direction === "asc" ? -1 : 1;

          if (numA < numB) return sortConfig.direction === "asc" ? -1 : 1;
          if (numA > numB) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredEducators, sortConfig]);

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

  const handleEditClick = (educator) => {
    setEditingEducator(educator);
  };



  const handleAddNewClick = () => {
    console.log("Educator Page: handleAddNewClick triggered!");
    setIsAddingEducator(true);
  };





  const handleApplyFilters = (filters) => {
    console.log("Applying Educator filter criteria:", filters);
    setFilterCriteria(filters);
  };

  const handleCloseEditDialog = () => {
    setEditingEducator(null);
  };
  const handleCloseAddDialog = () => {
    setIsAddingEducator(false);
  };

  return (
    <div className="p-4">
      <EducatorManagementControls
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onAddNewClick={handleAddNewClick}
        initialFilters={filterCriteria}
        onApplyFilters={handleApplyFilters}
      />
      <EducatorTable
        data={filteredAndSortedEducators}
        onEditClick={handleEditClick}
        sortConfig={sortConfig}
        onSort={handleSort}
      />
      {isAddingEducator && (
        <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
          <EducatorModal
            onSave={handleAddEducator}
            onClose={handleCloseAddDialog}
          />
        </div>
      )}
      {editingEducator && (
        <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
          <EducatorModal
            educatorData={editingEducator}
            onSave={handleUpdateEducator}
            onClose={handleCloseEditDialog}
          />
        </div>
      )}



    </div>
  );
}

export default EducatorPage;
