import React, { useState } from "react";
import { useAuth } from "@/AuthContext";

// --- External Libraries for UI & Charts ---
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
  ChevronLeft,
} from "lucide-react";

// --- Existing Components Imports ---
import ScenarioManagementControls from "./scenarios/ScenarioManagementControls.jsx";
import ScenarioTable from "./scenarios/ScenarioTable.jsx";
import ScenarioModal from "./scenarios/ScenarioModal.jsx";
import initialScenarios from "./scenarios/initialScenarios.json";
import StudentManagementControls from "./students/StudentManagementControls.jsx";
import StudentTable from "./students/StudentTable.jsx";
import StudentModal from "./students/StudentModal.jsx";
import AssignScenarios from "../../components/shared/AssignScenarios.jsx";
import initialStudents from "./students/initialStudents.json";

// --- MOCK DATA FOR CHARTS (Visual Design Only) ---
const ACTIVITY_DATA = [
  { name: "Jan", completed: 45, active: 30, inactive: 15 },
  { name: "Feb", completed: 55, active: 35, inactive: 10 },
  { name: "Mar", completed: 60, active: 30, inactive: 10 },
  { name: "Apr", completed: 75, active: 45, inactive: 5 },
  { name: "May", completed: 65, active: 50, inactive: 8 },
  { name: "Jun", completed: 80, active: 65, inactive: 15 },
  { name: "Jul", completed: 70, active: 60, inactive: 10 },
  { name: "Aug", completed: 85, active: 70, inactive: 12 },
  { name: "Sep", completed: 60, active: 55, inactive: 15 },
  { name: "Oct", completed: 50, active: 40, inactive: 10 },
  { name: "Nov", completed: 70, active: 60, inactive: 5 },
  { name: "Dec", completed: 90, active: 80, inactive: 5 },
];

const POPULARITY_DATA = [
  { name: "Emergency Response", value: 35, color: "#6b7280" },
  { name: "Clinical Diagnosis", value: 30, color: "#d97706" },
  { name: "Medical Ethics", value: 15, color: "#a16207" },
  { name: "Patient Assessment", value: 20, color: "#e5e7eb" },
];

function EducatorDashboard() {
  const { user } = useAuth();

  // --- VIEW STATE ---
  const [currentView, setCurrentView] = useState("dashboard");

  // --- SCENARIO STATE ---
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(null);
  const [editingScenario, setEditingScenario] = useState(null);
  const [isAddingScenario, setIsAddingScenario] = useState(false);

  // --- STUDENT STATE ---
  const [students, setStudents] = useState(initialStudents);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [studentSortConfig, setStudentSortConfig] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isAssigningScenarios, setIsAssigningScenarios] = useState(false);

  // --- HANDLERS ---
  const handleAddScenario = (data) => {
    // Add new scenario to state
    setScenarios((prev) => [...prev, { ...data, id: Date.now() }]);
    setIsAddingScenario(false);
  };

  const handleUpdateScenario = (data) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === data.id ? { ...s, ...data } : s))
    );
    setEditingScenario(null);
  };

  const handleAddStudent = (data) => {
    setStudents((prev) => [...prev, { ...data, id: Date.now() }]);
    setIsAddingStudent(false);
  };

  const handleUpdateStudent = (data) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === data.id ? { ...s, ...data } : s))
    );
    setEditingStudent(null);
  };

  // --- DASHBOARD HOME COMPONENT ---
  const DashboardHome = () => {
    // -- SYNC: Calculate Real Stats from State --
    const totalStudents = students.length;
    const totalScenarios = scenarios.length;
    const activeScenariosCount =
      scenarios.filter((s) => s.status === "Published").length || 0;

    // Get last 5 students for the list
    const recentStudents = students.slice(0, 5);
    // Get last 3 scenarios for the list (assuming new ones are added to end, we reverse)
    const recentScenarios = [...scenarios].reverse().slice(0, 3);

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome Back, {user ? user.name : "Teacher"}!
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Here is what's happening with your scenarios today.
            </p>
          </div>
          <button
            onClick={() => setIsAddingScenario(true)}
            className="flex items-center gap-2 bg-[#1a1a1a] text-white px-5 py-2.5 rounded-lg hover:bg-black transition shadow-lg text-sm font-medium"
          >
            <Plus size={18} /> New Scenario
          </button>
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
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src="https://i.pravatar.cc/150?img=11"
                      className="w-10 h-10 rounded-full border-2 border-white object-cover"
                      alt="Avatar"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-4xl font-bold tracking-tight">91.2%</div>
                  <div className="text-xs text-white/80 mt-1">
                    Monthly Performance Overview
                  </div>
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-6 pt-4 border-t border-white/20">
              <p className="text-xs font-medium leading-relaxed text-white/90">
                Student engagement rose 32% this month, great improvement!
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
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-500 mt-2">
                  <ArrowUpRight size={16} /> <span>+12% increased</span>
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
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-500 mt-2">
                  <ArrowUpRight size={16} /> <span>+5 increased</span>
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
                <div className="text-3xl font-bold text-gray-900">78%</div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-500 mt-2">
                  <ArrowDownRight size={16} /> <span>-5.4% decreased</span>
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
                <div className="text-3xl font-bold text-gray-900">3h 20m</div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-500 mt-2">
                  <ArrowUpRight size={16} /> <span>22.4% increased</span>
                  <span className="text-gray-400 font-normal">
                    vs last month
                  </span>
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
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ACTIVITY_DATA}
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
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={POPULARITY_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {POPULARITY_DATA.map((entry, index) => (
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
                    <span className="text-xs font-bold text-gray-800">35</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-1 mt-4">
              {POPULARITY_DATA.map((item) => (
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
                onClick={() => setCurrentView("students")}
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
                      key={student.id}
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
                        78%
                      </td>{" "}
                      {/* Placeholder: Add progress to your JSON if needed */}
                      <td className="px-2 py-3.5 text-xs text-gray-700 font-medium">
                        85
                      </td>{" "}
                      {/* Placeholder: Add score to your JSON if needed */}
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
                onClick={() => setCurrentView("scenarios")}
                className="text-[10px] font-medium text-gray-500 border border-gray-200 rounded px-2.5 py-1 hover:bg-gray-50 transition"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentScenarios.map((scenario) => (
                <div
                  key={scenario.id}
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
  };

  return (
    <div className="p-8 w-full bg-gray-50 min-h-full">
      {/* --- MAIN CONTENT AREA --- */}
      {currentView === "dashboard" && <DashboardHome />}

      {currentView === "scenarios" && (
        <div className="animate-in fade-in duration-300">
          {/* Back Button for Sub-pages */}
          <button
            onClick={() => setCurrentView("dashboard")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
          >
            <ChevronLeft size={16} /> Back to Dashboard
          </button>

          <ScenarioManagementControls
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onAddNewClick={() => setIsAddingScenario(true)}
          />
          <ScenarioTable
            data={scenarios}
            onEditClick={setEditingScenario}
            sortConfig={sortConfig}
            onSort={(key) => {
              let direction = "asc";
              if (
                sortConfig &&
                sortConfig.key === key &&
                sortConfig.direction === "asc"
              ) {
                direction = "desc";
              }
              setSortConfig({ key, direction });
            }}
          />
        </div>
      )}

      {currentView === "students" && (
        <div className="animate-in fade-in duration-300">
          <button
            onClick={() => setCurrentView("dashboard")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
          >
            <ChevronLeft size={16} /> Back to Dashboard
          </button>

          <StudentManagementControls
            searchTerm={studentSearchTerm}
            onSearchChange={setStudentSearchTerm}
            onAddNewClick={() => setIsAddingStudent(true)}
            onAssignScenariosClick={() => setIsAssigningScenarios(true)}
          />
          <StudentTable
            data={students}
            onEditClick={setEditingStudent}
            sortConfig={studentSortConfig}
            onSort={(key) => {
              let direction = "asc";
              if (
                studentSortConfig &&
                studentSortConfig.key === key &&
                studentSortConfig.direction === "asc"
              ) {
                direction = "desc";
              }
              setStudentSortConfig({ key, direction });
            }}
          />
        </div>
      )}

      {/* --- MODALS --- */}
      {isAddingScenario && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4 backdrop-blur-sm">
          <ScenarioModal
            onSave={handleAddScenario}
            onClose={() => setIsAddingScenario(false)}
          />
        </div>
      )}
      {editingScenario && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4 backdrop-blur-sm">
          <ScenarioModal
            scenarioData={editingScenario}
            onSave={handleUpdateScenario}
            onClose={() => setEditingScenario(null)}
          />
        </div>
      )}

      {isAddingStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4 backdrop-blur-sm">
          <StudentModal
            onSave={handleAddStudent}
            onClose={() => setIsAddingStudent(false)}
          />
        </div>
      )}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4 backdrop-blur-sm">
          <StudentModal
            studentData={editingStudent}
            onSave={handleUpdateStudent}
            onClose={() => setEditingStudent(null)}
          />
        </div>
      )}

      {isAssigningScenarios && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4 backdrop-blur-sm">
          <AssignScenarios onClose={() => setIsAssigningScenarios(false)} />
        </div>
      )}
    </div>
  );
}

export default EducatorDashboard;
