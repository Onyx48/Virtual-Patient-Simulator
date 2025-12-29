import React from "react";
// import { useAuth } from '@/AuthContext'; // Keeping original context reference
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BookOpen, GraduationCap, Users } from "lucide-react";

// --- MOCK DATA ---

const chartData = [
  { name: "April", value: 15 },
  { name: "May", value: 72 },
  // Adding extra points to make the line look smooth if needed,
  // but based on image it looks like a straight interpolation between two points
];

function SchoolAdminDashboard() {
  // Mock user for display
  const user = { name: "" }; // Image shows "Welcome Back, !" with no name initially
  // const { user } = useAuth();

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans text-gray-800">
      {/* 1. WELCOME HEADER */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome Back, {user?.name ? user.name : ""}!
        </h2>
      </div>

      {/* 2. STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Active Scenarios */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center h-40">
          <div className="mb-4 text-gray-600">
            <BookOpen size={24} />
          </div>
          <div className="text-sm font-medium text-gray-600 mb-1">
            Active Scenarios
          </div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>

        {/* Card 2: Active Educators */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center h-40">
          <div className="mb-4 text-gray-600">
            <GraduationCap size={24} />
          </div>
          <div className="text-sm font-medium text-gray-600 mb-1">
            Active Educators
          </div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>

        {/* Card 3: Active Students */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center h-40">
          <div className="mb-4 text-gray-600">
            <Users size={24} />
          </div>
          <div className="text-sm font-medium text-gray-600 mb-1">
            Active Students
          </div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>
      </div>

      {/* 3. CHART SECTION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-800">Active Scenarios</h3>
          <select className="text-xs text-gray-500 border-none bg-transparent outline-none cursor-pointer">
            <option>Monthly</option>
            <option>Weekly</option>
          </select>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f3f4f6"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                domain={[0, 80]}
                ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80]}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#0ea5e9"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
                dot={{ r: 4, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default SchoolAdminDashboard;
