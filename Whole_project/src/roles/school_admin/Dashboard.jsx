import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '@/AuthContext';
import { fetchDashboardData } from '../../redux/slices/dashboardSlice';
import DashbordStats from '../../components/Dashboard/DashbordStats';
import EducatorPage from './educators/Educator';
import ScenarioPage from './scenarios/index';
import StudentPage from './students/Student';

function SchoolAdminDashboard() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const { stats, loading } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  if (loading) return <div>Loading school admin dashboard...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        School Admin Dashboard, {user ? user.name : 'School Admin'}!
      </h2>
      <p className="text-gray-600 mb-6">
        Manage your school's educators, students, and scenarios.
      </p>
      <DashbordStats stats={stats} />
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Educator Management</h3>
        <EducatorPage />
      </div>
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Scenario Management</h3>
        <ScenarioPage />
      </div>
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Student Management</h3>
        <StudentPage />
      </div>
    </div>
  );
}

export default SchoolAdminDashboard;