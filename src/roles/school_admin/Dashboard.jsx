import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getAuthHeaders } from "../../lib/utils.js";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BookOpen, GraduationCap, Users, Plus } from "lucide-react";

function SchoolAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

   const [stats, setStats] = useState({ scenarios: 0, educators: 0, students: 0 });
   const [chartData, setChartData] = useState([]);
   const [educatorChartData, setEducatorChartData] = useState([]);
   const [studentChartData, setStudentChartData] = useState([]);
   const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch scenarios, educators, students for the school
        const [scenariosRes, educatorsRes, studentsRes] = await Promise.all([
          axios.get("/api/scenarios", getAuthHeaders()),
          axios.get("/api/users?role=educator", getAuthHeaders()),
          axios.get("/api/users?role=student", getAuthHeaders()),
        ]);

         setStats({
           scenarios: scenariosRes.data.length,
           educators: educatorsRes.data.length,
           students: studentsRes.data.length,
         });

         // Chart data for scenarios
         setChartData([
           { name: "April", value: scenariosRes.data.length },
           { name: "May", value: scenariosRes.data.length + 10 },
         ]);

         // Chart data for educators
         setEducatorChartData([
           { name: "April", value: educatorsRes.data.length },
           { name: "May", value: educatorsRes.data.length + 2 },
         ]);

         // Chart data for students
         setStudentChartData([
           { name: "April", value: studentsRes.data.length },
           { name: "May", value: studentsRes.data.length + 5 },
         ]);
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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
            <div className="text-3xl font-bold text-gray-900">{loading ? "..." : stats.scenarios}</div>
         </div>

         {/* Card 2: Active Educators */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center h-40">
           <div className="mb-4 text-gray-600">
             <GraduationCap size={24} />
           </div>
           <div className="text-sm font-medium text-gray-600 mb-1">
             Active Educators
           </div>
            <div className="text-3xl font-bold text-gray-900">{loading ? "..." : stats.educators}</div>
        </div>

        {/* Card 3: Active Students */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center h-40">
          <div className="mb-4 text-gray-600">
            <Users size={24} />
          </div>
           <div className="text-sm font-medium text-gray-600 mb-1">
             Active Students
           </div>
            <div className="text-3xl font-bold text-gray-900">{loading ? "..." : stats.students}</div>
        </div>
       </div>



        {/* 4. ACTIVE SCENARIOS CHART */}
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
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
                 <linearGradient id="colorScenarios" x1="0" y1="0" x2="0" y2="1">
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
                 fill="url(#colorScenarios)"
                 dot={{ r: 4, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }}
               />
             </AreaChart>
           </ResponsiveContainer>
         </div>
       </div>

       {/* 5. ACTIVE EDUCATORS CHART */}
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
         <div className="flex justify-between items-center mb-6">
           <h3 className="text-lg font-bold text-gray-800">Active Educators</h3>
           <select className="text-xs text-gray-500 border-none bg-transparent outline-none cursor-pointer">
             <option>Monthly</option>
             <option>Weekly</option>
           </select>
         </div>

         <div className="h-80 w-full">
           <ResponsiveContainer width="100%" height="100%">
             <AreaChart
               data={educatorChartData}
               margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
             >
               <defs>
                 <linearGradient id="colorEducators" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                   <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                 domain={[0, 50]}
                 ticks={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]}
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
                 stroke="#3b82f6"
                 strokeWidth={2}
                 fillOpacity={1}
                 fill="url(#colorEducators)"
                 dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
               />
             </AreaChart>
           </ResponsiveContainer>
         </div>
       </div>

       {/* 6. ACTIVE STUDENTS CHART */}
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
         <div className="flex justify-between items-center mb-6">
           <h3 className="text-lg font-bold text-gray-800">Active Students</h3>
           <select className="text-xs text-gray-500 border-none bg-transparent outline-none cursor-pointer">
             <option>Monthly</option>
             <option>Weekly</option>
           </select>
         </div>

         <div className="h-80 w-full">
           <ResponsiveContainer width="100%" height="100%">
             <AreaChart
               data={studentChartData}
               margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
             >
               <defs>
                 <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                   <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                 domain={[0, 100]}
                 ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
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
                 stroke="#10b981"
                 strokeWidth={2}
                 fillOpacity={1}
                 fill="url(#colorStudents)"
                 dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
               />
             </AreaChart>
           </ResponsiveContainer>
         </div>
       </div>
    </div>
  );
}

export default SchoolAdminDashboard;
