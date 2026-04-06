import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../../AuthContext";
import axios from "axios";
import { getAuthHeaders } from "../../lib/utils.js";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  AlertCircle,
  Calendar,
  Bell,
  CheckCircle,
  MoreHorizontal,
  ChevronLeft,
} from "lucide-react";
import ScenarioManagementControlsStudent from "./scenarios/ScenarioManagementControlsStudent";
import ScenarioTableStudent from "./scenarios/ScenrioGridStudent";
import StudentScenarioDetails from "./scenarios/StudentScenarioDetails";

const notices = [
  {
    title: "New Scenario Available",
    sub: '"Cardiac Assessment"',
    icon: "alert",
    color: "bg-red-100 text-red-500",
  },
  {
    title: "Upcoming Group Play Session",
    sub: "March 5th, 2025, At 3 PM",
    icon: "calendar",
    color: "bg-orange-100 text-orange-500",
  },
  {
    title: "Update",
    sub: "System Maintenance On March 7th, 2025",
    icon: "bell",
    color: "bg-gray-200 text-gray-600",
  },
  {
    title: "Exciting Team-Building Event!",
    sub: "April 10th, 2025, At 2 PM",
    icon: "star",
    color: "bg-yellow-100 text-yellow-500",
  },
];

function StudentDashboard() {
  const { user } = useAuth();
  const [scenariosList, setScenariosList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({});
  const [sortConfig, setSortConfig] = useState(null);
  const [studentStats, setStudentStats] = useState({
    completedCount: 0,
    availableCount: 0,
    averageScore: null,
    scenarioScores: [],
    totalAssigned: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResponse, scenariosResponse] = await Promise.all([
          axios.get("/api/dashboard/student-stats", getAuthHeaders()),
          axios.get("/api/scenarios", getAuthHeaders()),
        ]);

        const stats = statsResponse.data;
        setStudentStats(stats);

        const allScenarios = scenariosResponse.data;
        const assignedScenarios = allScenarios.filter(
          (scenario) =>
            scenario.assignedTo && scenario.assignedTo.some(a => a._id === user._id)
        );

        const mapped = assignedScenarios.map((scenario) => {
          const scenarioStat = stats.scenarioScores.find(
            (s) => s.scenarioId === scenario._id
          );
          return {
            id: scenario._id,
            scenarioName: scenario.scenarioName,
            description: scenario.description || "",
            difficulty: scenario.difficulty || "Medium",
            highestScore: scenarioStat?.bestScore !== null
              ? Math.round(scenarioStat.bestScore * 100)
              : null,
            status: scenarioStat?.isCompleted ? "Completed" : "Available",
          };
        });
        setScenariosList(mapped);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user]);

  const filteredScenarios = useMemo(() => {
    let filtered = scenariosList;
    if (searchTerm) {
      filtered = filtered.filter((s) =>
        s.scenarioName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [scenariosList, searchTerm, sortConfig]);

  const hasRealData = studentStats.totalAssigned > 0;

  const performanceData = useMemo(() => {
    if (!studentStats.scenarioScores.length) return [];
    return studentStats.scenarioScores
      .filter((s) => s.bestScore !== null)
      .map((s, idx) => ({
        name: `Scenario ${idx + 1}`,
        score: Math.round(s.bestScore * 100),
      }));
  }, [studentStats.scenarioScores]);

  const learningContentData = useMemo(() => {
    if (!hasRealData) return [];
    return [
      { name: "Completed", value: studentStats.completedCount },
      { name: "Remaining", value: studentStats.availableCount },
    ];
  }, [studentStats, hasRealData]);

  if (loading) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      {currentView === "dashboard" && (
        <React.Fragment>
          {/* 1. WELCOME SECTION */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800">
              Welcome Back, {user.name.split(" ")[0]}!
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {hasRealData
                ? "Here's an overview of your learning progress."
                : "Start a scenario to begin your learning journey."}
            </p>
          </div>

          {/* 2. STATS CARDS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard
              title="Completed Scenarios"
              value={studentStats.completedCount}
              sub={hasRealData ? "Total assigned" : "No scenarios yet"}
              subValue={studentStats.totalAssigned > 0 ? studentStats.totalAssigned : null}
            />
            <StatCard
              title="Available Scenarios"
              value={studentStats.availableCount}
              sub="Remaining scenarios"
              trend={null}
            />
            <StatCard
              title="Avg Score"
              value={studentStats.averageScore !== null ? `${studentStats.averageScore}%` : "N/A"}
              sub={hasRealData ? "Across all completed" : "No scores yet"}
            />
          </div>

          {/* 3. CHARTS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Chart 1: Learning Content (Gauge Style) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <h3 className="font-semibold text-gray-800 mb-4">
                Learning Content
              </h3>

              {hasRealData && studentStats.totalAssigned > 0 ? (
                <>
                  <div className="h-48 relative flex justify-center items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={learningContentData}
                          cx="50%"
                          cy="70%"
                          startAngle={180}
                          endAngle={0}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={0}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell key="cell-0" fill="#0ea5e9" />
                          <Cell key="cell-1" fill="#22c55e" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="absolute top-2/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center mt-6">
                      <div className="text-xs text-gray-400">Total Scenarios</div>
                      <div className="text-3xl font-bold text-gray-800">
                        {studentStats.totalAssigned}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between px-4 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                      <div className="flex flex-col leading-none">
                        <span className="text-xs text-gray-500">Completed</span>
                        <span className="text-xs font-bold text-gray-800">
                          {studentStats.completedCount}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                      <div className="flex flex-col leading-none">
                        <span className="text-xs text-gray-500">Available</span>
                        <span className="text-xs font-bold text-gray-800">
                          {studentStats.availableCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-gray-400 text-sm">No data available</p>
                </div>
              )}
            </div>

            {/* Chart 2: Performance Trend (Bar Chart) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-gray-800">
                  Performance Trend
                </h3>
              </div>

              {performanceData.length > 0 ? (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData} barSize={32}>
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
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                      />
                      <Tooltip
                        cursor={{ fill: "#f9fafb" }}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Bar dataKey="score" fill="#ea580c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-60 flex items-center justify-center">
                  <p className="text-gray-400 text-sm">No scores available yet</p>
                </div>
              )}
            </div>
          </div>

          {/* 4. BOTTOM SECTION: TABLE & NOTICES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Table: Scenarios */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Scenarios</h3>
                <button
                  onClick={() => setCurrentView("scenarios")}
                  className="text-xs text-gray-500 border border-gray-200 px-3 py-1 rounded hover:bg-gray-50 transition-colors"
                >
                  View All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="p-3 font-medium first:rounded-tl-lg first:pl-4">
                        Name
                      </th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right last:rounded-tr-lg last:pr-4">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredScenarios.length > 0 ? (
                      filteredScenarios.map((scenario, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 transition-colors group cursor-pointer"
                          onClick={() => {
                            setSelectedScenario(scenario);
                            setCurrentView("scenario-details");
                          }}
                        >
                          <td className="p-3 pl-4 text-sm font-medium text-gray-800">
                            {scenario.scenarioName}
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                scenario.status === "Completed"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-blue-50 text-blue-600"
                              }`}
                            >
                              {scenario.status}
                            </span>
                          </td>
                          <td className="p-3 pr-4 text-sm font-bold text-gray-800 text-right">
                            {scenario.highestScore !== null
                              ? `${scenario.highestScore}%`
                              : "N/A"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="p-8 text-center text-gray-400">
                          No scenarios assigned yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* List: Notice Board */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4">Notice Board</h3>
              <div className="space-y-5">
                {notices.map((notice, index) => (
                  <div
                    key={index}
                    className="flex gap-4 items-start relative group"
                  >
                    {/* Icon Box */}
                    <div
                      className={`p-2.5 rounded-lg shrink-0 ${notice.color}`}
                    >
                      {notice.icon === "alert" && <AlertCircle size={18} />}
                      {notice.icon === "calendar" && <Calendar size={18} />}
                      {notice.icon === "bell" && <Bell size={18} />}
                      {notice.icon === "star" && <CheckCircle size={18} />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">
                        {notice.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {notice.sub}
                      </div>
                    </div>
                    {/* Menu Dots */}
                    <button className="text-gray-300 hover:text-gray-600 transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </React.Fragment>
      )}

      {currentView === "scenarios" && (
        <div className="animate-in fade-in duration-300">
          <button
            onClick={() => setCurrentView("dashboard")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
          >
            <ChevronLeft size={16} /> Back to Dashboard
          </button>
          <ScenarioManagementControlsStudent
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onApplyFilters={setFilters}
            initialFilters={filters}
            sortConfig={sortConfig}
            onSortChange={(key, direction) =>
              setSortConfig(key ? { key, direction } : null)
            }
          />
          <ScenarioTableStudent data={filteredScenarios} />
        </div>
      )}

      {currentView === "scenario-details" && (
        <div className="animate-in fade-in duration-300">
          <StudentScenarioDetails onBack={() => setCurrentView("scenarios")} />
        </div>
      )}
    </div>
  );
}

// --- HELPER COMPONENT: STAT CARD ---

function StatCard({ title, value, sub, subValue }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <h4 className="text-sm text-gray-500 font-medium mb-2">{title}</h4>
      <div className="text-3xl font-bold text-gray-900 mb-2">{value}</div>
      <div className="text-xs text-gray-400">
        {sub}
        {subValue !== null && (
          <span className="font-medium text-gray-600"> ({subValue})</span>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;
