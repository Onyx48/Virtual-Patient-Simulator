// src/components/Dashboard/DashboardPage.jsx
import React, { useEffect } from "react";
import { useDispatch, useSelector } from 'react-redux';
import DashbordStats from "../Dashboard/DashbordStats";      // Adjust path if needed, assuming sibling
import AllSchoolsSection from "../Dashboard/AllSchoolsSection"; // Adjust path if needed, assuming sibling
import { useAuth } from '../../AuthContext'; // To display user's name
import { fetchDashboardData, enableRealTime } from '../../redux/slices/dashboardSlice';

function DashboardPage() {
  const dispatch = useDispatch();
  const { user } = useAuth(); // Get user from context
  const { stats, schools, loading, realTimeEnabled } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchDashboardData());
    dispatch(enableRealTime());

    // Polling for real-time updates every 30 seconds
    const interval = setInterval(() => {
      if (realTimeEnabled) {
        dispatch(fetchDashboardData());
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch, realTimeEnabled]);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Welcome back, {user ? user.name : 'User'}! {/* Dynamic welcome */}
      </h2>
      <p className="text-gray-600 mb-6">
        This is the main dashboard content. Display overview statistics, recent activities, etc. here.
      </p>
      {/* Assuming these are your actual dashboard content components */}
      <DashbordStats stats={stats} />
      <AllSchoolsSection schools={schools} />
    </div>
  );
}

export default DashboardPage;