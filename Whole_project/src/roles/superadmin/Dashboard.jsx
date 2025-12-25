import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '@/AuthContext';
import { fetchDashboardData } from '../../redux/slices/dashboardSlice';
import { Link } from 'react-router-dom';
import DashbordStats from '../../components/Dashboard/DashbordStats';
import AllSchoolsSection from '../../components/Dashboard/AllSchoolsSection';
import SchoolManagementControls from './schools/SchoolManagementControls.jsx';
import SchoolTable from './schools/SchoolTable.jsx';
import SchoolModal from './schools/SchoolModal.jsx';

function SuperAdminDashboard() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const { stats, loading } = useSelector((state) => state.dashboard);

  // Local state for schools (matching original)
  const [schools, setSchools] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [editingSchool, setEditingSchool] = useState(null);
  const [isAddingSchool, setIsAddingSchool] = useState(false);


  useEffect(() => {
    dispatch(fetchDashboardData());
    // TODO: Fetch schools from API or use mock
  }, [dispatch]);

  if (loading) return <div>Loading super admin dashboard...</div>;

  // School handlers (simplified)
  const handleAddSchool = (newSchoolData) => {
    console.log("Adding new school:", newSchoolData);
    // Add to state
    setIsAddingSchool(false);
  };

  const handleUpdateSchool = (updatedSchoolData) => {
    console.log("Updating school:", updatedSchoolData);
    setEditingSchool(null);
  };

  const handleSchoolEditClick = (school) => {
    setEditingSchool(school);
  };

  const handleSchoolAddNewClick = () => {
    setIsAddingSchool(true);
  };

  const handleSchoolCloseEditDialog = () => {
    setEditingSchool(null);
  };
  const handleSchoolCloseAddDialog = () => {
    setIsAddingSchool(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Super Admin Dashboard, {user ? user.name : 'Super Admin'}!
      </h2>
      <p className="text-gray-600 mb-6">
        Oversee all schools, users, and system settings.
      </p>
      <DashbordStats stats={stats} />
      <AllSchoolsSection schools={schools} />
      <div className="mt-8">
        <SchoolManagementControls
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAddNewClick={handleSchoolAddNewClick}
        />

        <SchoolTable
          data={schools}
          onEditClick={handleSchoolEditClick}
          sortConfig={sortConfig}
          onSort={() => {}}
        />

        {editingSchool && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
            <SchoolModal
              schoolData={editingSchool}
              onSave={handleUpdateSchool}
              onClose={handleSchoolCloseEditDialog}
            />
          </div>
        )}

        {isAddingSchool && (
          <div className="fixed inset-0 z-50 bg-gray-800 bg-opacity-50 flex justify-center items-center p-4">
            <SchoolModal
              onSave={handleAddSchool}
              onClose={handleSchoolCloseAddDialog}
            />
          </div>
        )}


      </div>
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Scenario Management</h3>
          <Link to="/scenarios" className="px-4 py-2 bg-green-500 text-white rounded">
            Manage Scenarios
          </Link>
        </div>
        <p>Access all scenarios.</p>
      </div>
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Student Management</h3>
          <Link to="/students" className="px-4 py-2 bg-purple-500 text-white rounded">
            Manage Students
          </Link>
        </div>
        <p>Manage all students.</p>
      </div>
    </div>
  );
}

export default SuperAdminDashboard;