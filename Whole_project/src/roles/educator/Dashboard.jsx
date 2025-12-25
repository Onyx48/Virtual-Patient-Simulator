import React, { useState, useMemo } from 'react';
import { useAuth } from '@/AuthContext';
import DashbordStats from '../../components/Dashboard/DashbordStats';
import ScenarioManagementHeader from './scenarios/ScenarioManagementHeader.jsx';
import ScenarioTable from './scenarios/ScenarioTable.jsx';
import EditScenario from './scenarios/EditScenario.jsx';
import AddScenario from './scenarios/AddScenario.jsx';
import ScenarioFilterForm from './scenarios/ScenarioFilterForm.jsx';
import initialScenarios from './scenarios/initialScenarios.json';
import StudentManagementHeader from './students/StudentManagementHeader.jsx';
import StudentTable from './students/StudentTable.jsx';
import AddStudent from './students/AddStudent.jsx';
import EditStudent from './students/EditStudent.jsx';
import StudentFilterForm from './students/StudentFilterForm.jsx';
import AssignScenarios from '../../components/shared/AssignScenarios.jsx';
import initialStudents from './students/initialStudents.json';

function EducatorDashboard() {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);

  const [editingScenario, setEditingScenario] = useState(null);
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({});

  // Student state
  const [students, setStudents] = useState(initialStudents);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [studentSortConfig, setStudentSortConfig] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isStudentFiltering, setIsStudentFiltering] = useState(false);
  const [studentFilterCriteria, setStudentFilterCriteria] = useState({});
  const [isAssigningScenarios, setIsAssigningScenarios] = useState(false);

  const handleAddScenario = (newScenarioData) => {
    console.log("Adding new scenario:", newScenarioData);
    const newScenarioWithId = {
      ...newScenarioData,
      id: Date.now() + Math.random(),
    };
    setScenarios((prevScenarios) => [...prevScenarios, newScenarioWithId]);
    setIsAddingScenario(false);
  };

  const handleUpdateScenario = (updatedScenarioData) => {
    console.log("Updating scenario:", updatedScenarioData);
    setScenarios((prevScenarios) =>
      prevScenarios.map((scenario) =>
        scenario.id === updatedScenarioData.id
          ? { ...scenario, ...updatedScenarioData }
          : scenario
      )
    );
    setEditingScenario(null);
  };

  const filteredScenarios = useMemo(() => {
    let currentData = scenarios;

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(
        (scenario) =>
          scenario.scenarioName.toLowerCase().includes(lowerCaseSearchTerm) ||
          scenario.description.toLowerCase().includes(lowerCaseSearchTerm) ||
          scenario.creator.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    const hasActiveFilters = Object.values(filterCriteria).some(
      (value) => value !== "" && value !== null && value !== undefined
    );
    if (hasActiveFilters) {
      currentData = currentData.filter((scenario) => {
        let matchesFilters = true;
        if (filterCriteria.status && filterCriteria.status !== "") {
          if (scenario.status !== filterCriteria.status) {
            matchesFilters = false;
          }
        }
        if (filterCriteria.creator && filterCriteria.creator !== "") {
          if (
            !scenario.creator
              .toLowerCase()
              .includes(filterCriteria.creator.toLowerCase())
          ) {
            matchesFilters = false;
          }
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
  }, [filteredScenarios, sortConfig]);

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

  const handleEditClick = (scenario) => {
    setEditingScenario(scenario);
  };

  const handleAddNewClick = () => {
    console.log("handleAddNewClick triggered!");
    setIsAddingScenario(true);
  };

  const handleFilterClick = () => {
    console.log("Scenario Filters button clicked! Opening filter modal.");
    setIsFiltering(true);
  };

  const handleApplyFilters = (filters) => {
    console.log("Applying filter criteria:", filters);
    setFilterCriteria(filters);
    setIsFiltering(false);
  };

  const handleCloseEditDialog = () => {
    setEditingScenario(null);
  };
  const handleCloseAddDialog = () => {
    setIsAddingScenario(false);
  };
  const handleCloseFilterDialog = () => {
    setIsFiltering(false);
  };

  // Student handlers
  const handleAddStudent = (newStudentData) => {
    console.log("Adding new student:", newStudentData);
    const newStudentWithId = {
      ...newStudentData,
      id: Date.now() + Math.random(),
    };
    setStudents((prevStudents) => [...prevStudents, newStudentWithId]);
    setIsAddingStudent(false);
  };

  const handleUpdateStudent = (updatedStudentData) => {
    console.log("Updating student:", updatedStudentData);
    setStudents((prevStudents) =>
      prevStudents.map((student) =>
        student.id === updatedStudentData.id
          ? { ...student, ...updatedStudentData }
          : student
      )
    );
    setEditingStudent(null);
  };

  const handleAssignScenarios = () => {
    console.log("Assign Scenarios button clicked! Opening modal.");
    setIsAssigningScenarios(true);
  };

  const filteredStudents = useMemo(() => {
    let currentData = students;

    if (studentSearchTerm) {
      const lowerCaseSearchTerm = studentSearchTerm.toLowerCase();
      currentData = currentData.filter(
        (student) =>
          student.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
          student.emailAddress.toLowerCase().includes(lowerCaseSearchTerm) ||
          student.schoolName.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    const hasActiveFilters = Object.values(studentFilterCriteria).some(
      (value) =>
        value !== "" &&
        value !== null &&
        value !== undefined &&
        !(typeof value === "number" && isNaN(value))
    );

    if (hasActiveFilters) {
      currentData = currentData.filter((student) => {
        let matchesFilters = true;

        if (studentFilterCriteria.studentName && studentFilterCriteria.studentName !== "") {
          if (
            !student.studentName
              .toLowerCase()
              .includes(studentFilterCriteria.studentName.toLowerCase())
          ) {
            matchesFilters = false;
          }
        }

        if (studentFilterCriteria.schoolName && studentFilterCriteria.schoolName !== "") {
          if (
            !student.schoolName
              .toLowerCase()
              .includes(studentFilterCriteria.schoolName.toLowerCase())
          ) {
            matchesFilters = false;
          }
        }

        return matchesFilters;
      });
    }

    return currentData;
  }, [students, studentSearchTerm, studentFilterCriteria]);

  const filteredAndSortedStudents = useMemo(() => {
    let sortableItems = [...filteredStudents];
    if (studentSortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[studentSortConfig.key];
        const bValue = b[studentSortConfig.key];
        if (aValue === null || aValue === undefined)
          return studentSortConfig.direction === "asc" ? 1 : -1;
        if (bValue === null || bValue === undefined)
          return studentSortConfig.direction === "asc" ? -1 : 1;
        if (aValue < bValue) {
          return studentSortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return studentSortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredStudents, studentSortConfig]);

  const handleStudentSearchChange = (term) => {
    setStudentSearchTerm(term);
  };

  const handleStudentSort = (key) => {
    let direction = "asc";
    if (
      studentSortConfig &&
      studentSortConfig.key === key &&
      studentSortConfig.direction === "asc"
    ) {
      direction = "desc";
    } else if (
      studentSortConfig &&
      studentSortConfig.key === key &&
      studentSortConfig.direction === "desc"
    ) {
      setStudentSortConfig(null);
      return;
    }
    setStudentSortConfig({ key, direction });
  };

  const handleStudentEditClick = (student) => {
    setEditingStudent(student);
  };

  const handleStudentAddNewClick = () => {
    console.log("Add new student clicked!");
    setIsAddingStudent(true);
  };

  const handleStudentFilterClick = () => {
    console.log("Student Filters button clicked! Opening filter modal.");
    setIsStudentFiltering(true);
  };

  const handleStudentApplyFilters = (filters) => {
    console.log("Applying student filter criteria:", filters);
    setStudentFilterCriteria(filters);
    setIsStudentFiltering(false);
  };

  const handleStudentCloseEditDialog = () => {
    setEditingStudent(null);
  };
  const handleStudentCloseAddDialog = () => {
    setIsAddingStudent(false);
  };
  const handleStudentCloseFilterDialog = () => {
    setIsStudentFiltering(false);
  };
  const handleStudentCloseAssignDialog = () => {
    setIsAssigningScenarios(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Educator Dashboard, {user ? user.name : 'Educator'}!
      </h2>
      <p className="text-gray-600 mb-6">
        Manage your scenarios and students.
      </p>
      <DashbordStats />
      <div className="mt-8">
        <ScenarioManagementHeader
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onAddNewClick={handleAddNewClick}
          onFilterClick={handleFilterClick}
        />

        <ScenarioTable
          data={filteredAndSortedScenarios}
          onEditClick={handleEditClick}
          sortConfig={sortConfig}
          onSort={handleSort}
        />

        {editingScenario && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
            <EditScenario
              scenarioData={editingScenario}
              onSave={handleUpdateScenario}
              onClose={handleCloseEditDialog}
            />
          </div>
        )}

        {isAddingScenario && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
            <AddScenario
              onSave={handleAddScenario}
              onClose={handleCloseAddDialog}
            />
          </div>
        )}

        {isFiltering && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
            <ScenarioFilterForm
              initialFilters={filterCriteria}
              onApplyFilters={handleApplyFilters}
              onClose={handleCloseFilterDialog}
            />
          </div>
        )}
      </div>
      {/* Student Management Section */}
      <div className="mt-8">
        <StudentManagementHeader
          searchTerm={studentSearchTerm}
          onSearchChange={handleStudentSearchChange}
          onAddNewClick={handleStudentAddNewClick}
          onFilterClick={handleStudentFilterClick}
          onAssignScenarios={handleAssignScenarios}
        />

        <StudentTable
          data={filteredAndSortedStudents}
          onEditClick={handleStudentEditClick}
          sortConfig={studentSortConfig}
          onSort={handleStudentSort}
        />

        {editingStudent && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
            <EditStudent
              studentData={editingStudent}
              onSave={handleUpdateStudent}
              onClose={handleStudentCloseEditDialog}
            />
          </div>
        )}

        {isAddingStudent && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
            <AddStudent
              onSave={handleAddStudent}
              onClose={handleStudentCloseAddDialog}
            />
          </div>
        )}

        {isStudentFiltering && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
            <StudentFilterForm
              initialFilters={studentFilterCriteria}
              onApplyFilters={handleStudentApplyFilters}
              onClose={handleStudentCloseFilterDialog}
            />
          </div>
        )}

        {isAssigningScenarios && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
            <AssignScenarios
              onClose={handleStudentCloseAssignDialog}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default EducatorDashboard;