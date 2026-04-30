import React from "react";
import {
  Users,
  BookOpen,
  Activity,
  Layout,
  Plus,
  Bell,
  Settings,
  TrendingUp,
  BarChart3,
} from "lucide-react";

// shadcn/ui imports
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function EducatorDashboard() {
  const stats = [
    {
      label: "Total Students",
      value: "1,284",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Active Courses",
      value: "12",
      icon: BookOpen,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Avg. Completion",
      value: "78%",
      icon: Activity,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Scenario Success",
      value: "92%",
      icon: Layout,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="flex-1 min-h-screen bg-slate-50/50">
      {/* --- TOP NAV --- */}
      <header className="h-20 bg-white border-b flex items-center justify-between px-10 sticky top-0 z-20">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
          Educator Console
        </h2>

        <div className="flex items-center gap-6">
          <div className="relative cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors">
            <Bell size={22} />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white" />
          </div>
          <div className="flex items-center gap-3 border-l pl-6">
            <div className="text-right">
              <p className="text-sm font-black text-slate-900 leading-none">
                Prof. Anderson
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">
                Department Head
              </p>
            </div>
            <Avatar className="h-10 w-10 border rounded-xl shadow-sm">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Prof" />
              <AvatarFallback>PA</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="p-10 max-w-7xl mx-auto space-y-10">
        {/* --- STATS GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <Card
              key={i}
              className="border-none shadow-sm rounded-[24px] hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-black text-slate-900">
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* --- PERFORMANCE OVERVIEW --- */}
          <Card className="lg:col-span-8 border-none shadow-sm rounded-[32px] overflow-hidden">
            <CardHeader className="p-8 border-b border-slate-50 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900">
                    Class Performance
                  </CardTitle>
                  <CardDescription className="text-slate-500 font-medium mt-1">
                    Engagement metrics across active cohorts
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl font-bold text-xs h-9 border-slate-200"
                >
                  <BarChart3 size={14} className="mr-2" /> View Full Analytics
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8 bg-white min-h-[350px] flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="text-indigo-600" size={32} />
              </div>
              <h4 className="text-lg font-black text-slate-900">
                Weekly Engagement is Up
              </h4>
              <p className="text-sm text-slate-500 max-w-xs mt-2 font-medium">
                Student interaction with AI scenarios has increased by 12%
                compared to last week.
              </p>
            </CardContent>
          </Card>

          {/* --- QUICK ACTIONS --- */}
          <Card className="lg:col-span-4 border-none shadow-sm rounded-[32px] bg-white">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black text-slate-900">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-4">
              <Button className="w-full justify-start h-14 rounded-2xl bg-[#6366F1] hover:bg-[#5558E3] font-black shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]">
                <Plus className="mr-3" size={20} /> Create New Scenario
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-14 rounded-2xl border-slate-200 font-black hover:bg-slate-50 text-slate-700"
              >
                <Users className="mr-3" size={20} /> Manage Student Roster
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start h-14 rounded-2xl text-slate-500 font-black hover:bg-slate-100"
              >
                <Settings className="mr-3" size={20} /> Portal Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
