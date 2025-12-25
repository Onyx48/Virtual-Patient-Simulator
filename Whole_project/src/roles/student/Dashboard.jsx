import React from 'react';
import { useAuth } from '@/AuthContext';
import DashbordStats from '../../components/Dashboard/DashbordStats';

function StudentDashboard() {
  const { user } = useAuth();

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Welcome, {user ? user.name : 'Student'}!
      </h2>
      <p className="text-gray-600 mb-6">
        Your student dashboard. Scenario viewing coming soon.
      </p>
      <DashbordStats />
    </div>
  );
}

export default StudentDashboard;