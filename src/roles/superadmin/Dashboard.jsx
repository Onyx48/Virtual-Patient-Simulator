import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchDashboardData } from "../../redux/slices/dashboardSlice"; // Adjust path if needed
import DashboardStats from "../../components/Dashboard/DashbordStats"; // Ensure filename matches (DashbordStats vs DashboardStats)
import SchoolCard from "../../components/Dashboard/SchoolCard";
import { useAuth } from "../../AuthContext";

function SuperAdminDashboard() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { stats, schools, loading, error } = useSelector(
    (state) => state.dashboard
  );

  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">Error loading dashboard: {error}</div>
    );
  }

  return (
    <div className="p-2 space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome Back, {user?.name || "Admin"}!
        </h1>
      </div>

      {/* Top Stats Cards */}
      <section>
        <DashboardStats stats={stats} />
      </section>

      {/* Schools Grid Section */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Schools</h2>

        {schools.length === 0 ? (
          <div className="text-gray-500">No active schools found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {schools.map((school) => (
              <SchoolCard key={school._id} school={school} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default SuperAdminDashboard;
