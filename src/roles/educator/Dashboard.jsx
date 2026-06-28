import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext.jsx";
import axios from "axios";
import { getAuthHeaders } from "../../lib/utils.js";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Plus,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

function EducatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [teachingEffectiveness, setTeachingEffectiveness] = useState(null);
  const [popularityData, setPopularityData] = useState([]);
  const [educatorStats, setEducatorStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [
          studentsRes,
          scenariosRes,
          activityRes,
          effectivenessRes,
          popularityRes,
          statsRes,
        ] = await Promise.all([
          axios.get("/api/students", getAuthHeaders()),
          axios.get("/api/scenarios", getAuthHeaders()),
          axios.get("/api/dashboard/monthly-activity", getAuthHeaders()),
          axios.get("/api/dashboard/teaching-effectiveness", getAuthHeaders()),
          axios.get("/api/dashboard/scenario-popularity", getAuthHeaders()),
          axios.get("/api/dashboard/educator-stats", getAuthHeaders()),
        ]);

        const mappedStudents = studentsRes.data.map((student) => ({
          ...student,
          studentName: student.name || "Unnamed Student",
          emailAddress: student.email || "No Email",
          assignedScenariosCount: student.assignedScenariosCount || 0,
          bestScore: student.bestScore || null,
          avgScore: student.avgScore || null,
          totalSessions: student.totalSessions || 0,
        }));

        setStudents(mappedStudents);
        setScenarios(scenariosRes.data);
        setActivityData(activityRes.data);
        setTeachingEffectiveness(effectivenessRes.data);
        setPopularityData(popularityRes.data);
        setEducatorStats(statsRes.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const totalStudents = students.length;
  const totalScenarios = scenarios.length;
  const activeScenariosCount =
    scenarios.filter((s) => s.status === "Published").length || 0;

  const recentStudents = students.slice(0, 5);
  const recentScenarios = [...scenarios].reverse().slice(0, 3);

  if (loading) {
    return (
      <div className="p-8 w-full bg-gray-50 min-h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const DashboardContent = (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome Back, {user ? user.name : "Teacher"}!
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Here is what's happening with your scenarios today.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/scenarios/add")}
              className="flex items-center gap-2 bg-[#1a1a1a] text-white px-5 py-2.5 rounded-lg hover:bg-black transition shadow-lg text-sm font-medium"
            >
              <Plus size={18} /> New Scenario
            </button>
          </div>
        </div>

        {/* Stats Cards Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Large Orange Hero Card (Left Side) */}
          <div className="lg:col-span-4 bg-[#f59e0b] rounded-2xl p-6 text-white relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[220px]">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <h3 className="text-base font-medium text-white/90">
                Teaching Effectiveness
              </h3>
              <div className="mt-6 flex items-center gap-5">
                <div className="relative w-16 h-16">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      className="text-white/30"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray="175.9"
                      strokeDashoffset="17.59"
                      className="text-white"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-4xl font-bold tracking-tight">
                    {teachingEffectiveness?.effectiveness || 0}%
                  </div>
                  <div className="text-xs text-white/80 mt-1">
                    Completion Rate
                  </div>
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-6 pt-4 border-t border-white/20">
              <p className="text-xs font-medium leading-relaxed text-white/90">
                {teachingEffectiveness?.engagementChange > 0 ? (
                  <>
                    Student engagement rose{" "}
                    {teachingEffectiveness.engagementChange}% this month, great
                    improvement!
                  </>
                ) : (
                  <>
                    Engagement change:{" "}
                    {teachingEffectiveness?.engagementChange || 0}%
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Small Stats Cards (2x2 Grid) */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Card 1: Active Students */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <p className="text-gray-500 text-sm font-medium">
                Active Students
              </p>
              <div className="mt-2">
                <div className="text-3xl font-bold text-gray-900">
                  {totalStudents}
                </div>
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium mt-2 ${educatorStats?.studentGrowth >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {educatorStats?.studentGrowth >= 0 ? (
                    <ArrowUpRight size={16} />
                  ) : (
                    <ArrowDownRight size={16} />
                  )}
                  <span>
                    {Math.abs(educatorStats?.studentGrowth || 0)}%{" "}
                    {educatorStats?.studentGrowth >= 0
                      ? "increased"
                      : "decreased"}
                  </span>
                  <span className="text-gray-400 font-normal">
                    vs last month
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Scenarios */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <p className="text-gray-500 text-sm font-medium">
                Total Scenarios
              </p>
              <div className="mt-2">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-gray-900">
                    {totalScenarios}
                  </span>
                  {/* Vertical Separator */}
                  <span className="h-6 w-px bg-gray-200"></span>
                  <span className="text-sm text-gray-500 font-medium">
                    {activeScenariosCount} Active
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium mt-2 ${educatorStats?.scenarioGrowth >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {educatorStats?.scenarioGrowth >= 0 ? (
                    <ArrowUpRight size={16} />
                  ) : (
                    <ArrowDownRight size={16} />
                  )}
                  <span>
                    {Math.abs(educatorStats?.scenarioGrowth || 0)}{" "}
                    {educatorStats?.scenarioGrowth >= 0
                      ? "increased"
                      : "decreased"}
                  </span>
                  <span className="text-gray-400 font-normal">
                    vs last month
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Avg. Progress */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <p className="text-gray-500 text-sm font-medium">Avg. Progress</p>
              <div className="mt-2">
                <div className="text-3xl font-bold text-gray-900">
                  {educatorStats?.avgProgress || 0}%
                </div>
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium mt-2 ${educatorStats?.avgProgressChange >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {educatorStats?.avgProgressChange >= 0 ? (
                    <ArrowUpRight size={16} />
                  ) : (
                    <ArrowDownRight size={16} />
                  )}
                  <span>
                    {Math.abs(educatorStats?.avgProgressChange || 0)}%{" "}
                    {educatorStats?.avgProgressChange >= 0
                      ? "increased"
                      : "decreased"}
                  </span>
                  <span className="text-gray-400 font-normal">
                    vs last month
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Avg. Time Spent */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <p className="text-gray-500 text-sm font-medium">
                Avg. Time Spent
              </p>
              <div className="mt-2">
                <div className="text-3xl font-bold text-gray-900">
                  {educatorStats?.avgTimeSpent || 0}h{" "}
                  {Math.round((educatorStats?.avgTimeSpent % 1) * 60) || 0}m
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-500 mt-2">
                  <ArrowUpRight size={16} /> <span>Based on sessions</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[380px]">
          {/* Bar Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-800 text-sm">
                Monthly Student Activity
              </h3>
              <div className="flex gap-4 text-[10px] font-medium text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  Completed
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Active
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-900"></span>
                  Inactive
                </div>
              </div>
            </div>
            <div className="w-full" style={{ height: 260 }}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={300}
                minHeight={200}
              >
                <BarChart
                  data={activityData}
                  barGap={4}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3f4f6"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f9fafb" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="completed"
                    fill="#2563eb"
                    radius={[3, 3, 0, 0]}
                    barSize={8}
                  />
                  <Bar
                    dataKey="active"
                    fill="#10b981"
                    radius={[3, 3, 0, 0]}
                    barSize={8}
                  />
                  <Bar
                    dataKey="inactive"
                    fill="#111827"
                    radius={[3, 3, 0, 0]}
                    barSize={8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="font-bold text-gray-800 text-sm mb-4">
              Scenario Popularity
            </h3>
            <div className="flex-1 relative flex items-center justify-center">
              <div className="w-full h-[200px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={200}
                  minHeight={200}
                >
                  <PieChart>
                    <Pie
                      data={popularityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {popularityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white shadow-sm border border-gray-100 rounded-full w-10 h-10 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-800">
                      {popularityData.reduce(
                        (sum, item) => sum + item.value,
                        0,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-1 mt-4">
              {popularityData.slice(0, 4).map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  ></span>
                  <span className="text-[10px] text-gray-500 font-medium truncate">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
          {/* Student Progress List */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-800 text-sm">
                Student Progress
              </h3>
              <button
                onClick={() => navigate("/students")}
                className="text-[10px] font-medium text-gray-500 border border-gray-200 rounded px-2.5 py-1 hover:bg-gray-50 transition"
              >
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-2 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      # Name
                    </th>
                    <th className="px-2 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Email Address
                    </th>
                    <th className="px-2 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-2 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Avg. Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentStudents.map((student, idx) => (
                    <tr
                      key={student._id}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
                      <td className="px-2 py-3.5 text-xs font-semibold text-gray-900 flex items-center gap-2">
                        <span className="text-gray-400 font-normal w-4">
                          {idx + 1}
                        </span>{" "}
                        {student.studentName}
                      </td>
                      <td className="px-2 py-3.5 text-xs text-gray-500">
                        {student.emailAddress}
                      </td>
                      <td className="px-2 py-3.5 text-xs text-gray-700 font-medium">
                        {student.bestScore !== null
                          ? `${Math.round(student.bestScore * 100)}%`
                          : "-"}
                      </td>
                      <td className="px-2 py-3.5 text-xs text-gray-700 font-medium">
                        {student.avgScore !== null
                          ? `${Math.round(student.avgScore * 100)}%`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Scenarios List */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-800 text-sm">
                Recent Scenario
              </h3>
              <button
                onClick={() => navigate("/scenarios")}
                className="text-[10px] font-medium text-gray-500 border border-gray-200 rounded px-2.5 py-1 hover:bg-gray-50 transition"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentScenarios.map((scenario) => (
                <div
                  key={scenario._id}
                  className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer bg-white"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {scenario.scenarioName}
                    </h4>
                    <MoreHorizontal
                      size={16}
                      className="text-gray-300 hover:text-gray-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        scenario.status === "Published"
                          ? "bg-green-50 text-green-700 border-green-100"
                          : scenario.status === "Draft"
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : "bg-gray-50 text-gray-600 border-gray-100"
                      }`}
                    >
                      {scenario.status || "Draft"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
  );

  return (
    <div className="p-8 w-full bg-gray-50 min-h-full">
      {DashboardContent}
    </div>
  );
}

export default EducatorDashboard;
