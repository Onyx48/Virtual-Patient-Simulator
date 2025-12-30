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
// --- MOCK DATA ---

const performanceData = [
  { name: "Scenario 1", score: 55 },
  { name: "Scenario 2", score: 70 },
  { name: "Scenario 3", score: 50 },
  { name: "Scenario 4", score: 85 },
  { name: "Scenario 5", score: 65 },
];

const learningContentData = [
  { name: "Completed", value: 25 }, // Represents 50% roughly
  { name: "Remaining", value: 25 },
];

// scenariosList is now fetched dynamically

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

// --- MAIN COMPONENT ---

function StudentDashboard() {
  const { user } = useAuth();
  const [scenariosList, setScenariosList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({});
  const [sortConfig, setSortConfig] = useState(null);

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const response = await axios.get("/api/scenarios", getAuthHeaders());
        const allScenarios = response.data;
        // Filter scenarios assigned to the current user
        const assignedScenarios = allScenarios.filter(
          (scenario) =>
            scenario.assignedTo && scenario.assignedTo.includes(user._id)
        );
        // Map to the expected format, assuming no completion data, set status to Available
        const mapped = assignedScenarios.map((scenario) => ({
          name: scenario.scenarioName,
          status: "Available",
          score: "N/A",
        }));
        setScenariosList(mapped);
      } catch (error) {
        console.error("Error fetching scenarios:", error);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchScenarios();
  }, [user]);

  const filteredScenarios = useMemo(() => {
    let filtered = scenariosList;
    if (searchTerm) {
      filtered = filtered.filter((s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    // Add more filter logic if needed based on filters object
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
              Lorem ipsum dolor sit amet consectetur facilisi.
            </p>
          </div>

          {/* 2. STATS CARDS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard
              title="Completed Scenarios"
              value="12"
              trend="+12% increased"
              trendType="positive"
              sub="vs last month"
            />
            <StatCard
              title="Available Scenarios"
              value="8"
              trend="+5% increased"
              trendType="positive"
              sub="vs last month"
            />
            <StatCard
              title="Avg Score"
              value="78%"
              trend="-5% decreased"
              trendType="negative"
              sub="vs last month"
            />
          </div>

          {/* 3. CHARTS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Chart 1: Learning Content (Gauge Style) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <h3 className="font-semibold text-gray-800 mb-4">
                Learning Content
              </h3>

              <div className="h-48 relative flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={learningContentData}
                      cx="50%"
                      cy="70%" // Moves the center down to create the semi-circle effect
                      startAngle={180}
                      endAngle={0}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell key="cell-0" fill="#0ea5e9" /> {/* Blue Segment */}
                      <Cell key="cell-1" fill="#22c55e" /> {/* Green Segment */}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Absolute Centered Text for Total */}
                <div className="absolute top-2/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center mt-6">
                  <div className="text-xs text-gray-400">Total Scenarios</div>
                  <div className="text-3xl font-bold text-gray-800">25</div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex justify-between px-4 mt-2">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                  <div className="flex flex-col leading-none">
                    <span className="text-xs text-gray-500">Completed</span>
                    <span className="text-xs font-bold text-gray-800">48%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                  <div className="flex flex-col leading-none">
                    <span className="text-xs text-gray-500">Available</span>
                    <span className="text-xs font-bold text-gray-800">52%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 2: Performance Trend (Bar Chart) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-gray-800">
                  Performance Trend
                </h3>
                <div className="relative">
                  <select className="text-xs border-none bg-transparent text-gray-500 focus:ring-0 cursor-pointer outline-none appearance-none pr-4 font-medium">
                    <option>Monthly</option>
                    <option>Weekly</option>
                  </select>
                </div>
              </div>

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
                    {scenariosList.map((scenario, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedScenario(scenario);
                          setCurrentView("scenario-details");
                        }}
                      >
                        <td className="p-3 pl-4 text-sm font-medium text-gray-800">
                          {scenario.name}
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
                          {scenario.score}
                        </td>
                      </tr>
                    ))}
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

function StatCard({ title, value, trend, trendType, sub }) {
  const isPositive = trendType === "positive";
  const trendColor = isPositive ? "text-green-500" : "text-red-500";
  const arrow = isPositive ? "↗" : "↘";

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <h4 className="text-sm text-gray-500 font-medium mb-2">{title}</h4>
      <div className="text-3xl font-bold text-gray-900 mb-2">{value}</div>
      <div className="text-xs flex items-center gap-1.5">
        <span
          className={`font-medium ${trendColor} bg-opacity-10 px-1 rounded flex items-center gap-1`}
        >
          {arrow} {trend}
        </span>
        <span className="text-gray-400">{sub}</span>
      </div>
    </div>
  );
}

export default StudentDashboard;
