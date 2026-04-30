import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext";
import { COURSES } from "./data/mockCourses.js";
import {
  Search,
  Bell,
  Trophy,
  Calendar,
  Clock,
  ArrowRight,
  PlayCircle,
  BookOpen,
  FileText,
  TrendingUp,
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const ACTIVITY_DATA = [4, 7, 5, 9, 6, 8, 10];

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (loading)
    return (
      <div className="p-10 text-muted-foreground animate-pulse">
        Loading dashboard...
      </div>
    );

  return (
    <div className="flex-1 min-h-screen bg-slate-50/50">
      {/* --- TOP NAV --- */}
      <header className="h-20 bg-white border-b flex items-center justify-between px-10 sticky top-0 z-20">
        <div className="relative w-96">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <Input
            placeholder="Search courses, assignments..."
            className="pl-10 bg-slate-100 border-none rounded-lg"
          />
        </div>

        <div className="flex items-center gap-6">
          <Badge
            variant="secondary"
            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-1.5 gap-2 border-none font-bold"
          >
            <Trophy size={14} /> Level 12 | 2,450 pts
          </Badge>
          <div className="relative cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors">
            <Bell size={22} />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          </div>
          <div className="flex items-center gap-3 border-l pl-6">
            <div className="text-right">
              <p className="text-sm font-black text-slate-900 leading-none">
                {user?.name}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">
                Student
              </p>
            </div>
            <Avatar className="h-10 w-10 border rounded-xl">
              <AvatarImage
                src={`https://ui-avatars.com/api/?name=${user?.name}&background=6366f1&color=fff`}
              />
              <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="p-10 max-w-7xl mx-auto space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* --- HERO SECTION --- */}
          <Card className="lg:col-span-8 border-none shadow-sm bg-white p-2">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-4xl font-black tracking-tight text-slate-900">
                Welcome back, {user?.name.split(" ")[0]}!
              </CardTitle>
              <CardDescription className="text-lg mt-4 max-w-md leading-relaxed text-slate-500 font-medium">
                You're making great progress. You have{" "}
                <span className="font-bold text-slate-900">
                  {studentStats.availableCount} assignments
                </span>{" "}
                due this week.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 flex flex-col justify-end h-full">
              <div className="mt-12">
                <Button
                  size="lg"
                  className="bg-[#6366F1] hover:bg-[#5558E3] rounded-2xl px-10 h-14 font-black shadow-indigo-100 shadow-xl transition-all active:scale-95"
                >
                  Continue Learning <ArrowRight className="ml-3" size={20} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* --- DEADLINES --- */}
          <Card className="lg:col-span-4 border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-black">
                Upcoming Deadlines
              </CardTitle>
              <Calendar size={20} className="text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-[#FFF8F8] border-l-4 border-red-500 p-5 rounded-2xl">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-black text-slate-900">
                    15-Day Check-in
                  </span>
                  <Badge className="bg-red-100 text-red-600 hover:bg-red-100 text-[10px] font-black border-none">
                    URGENT
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Intro to Artificial Intelligence
                </p>
                <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
                  <Clock size={14} /> 18h 42m remaining
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- COURSE GRID --- */}
        <section>
          <h2 className="text-2xl font-black text-slate-900 mb-8">
            Current Courses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Advanced ML",
                code: "CS-401",
                icon: PlayCircle,
                progress: 85,
                color: "text-blue-500",
              },
              {
                title: "Data Ethics",
                code: "PHI-202",
                icon: BookOpen,
                progress: 42,
                color: "text-green-500",
              },
              {
                title: "Cloud Systems",
                code: "ENG-305",
                icon: FileText,
                progress: 68,
                color: "text-orange-500",
              },
            ].map((course, i) => (
              <Card
                key={i}
                className="border-none shadow-sm group hover:shadow-xl transition-all duration-300 rounded-[32px]"
              >
                <CardHeader className="flex flex-row items-start justify-between">
                  <div
                    className={`p-3 rounded-2xl bg-slate-50 ${course.color}`}
                  >
                    <course.icon size={24} />
                  </div>
                  <Badge
                    variant="outline"
                    className="font-black border-slate-100"
                  >
                    {course.progress}%
                  </Badge>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-xl font-black group-hover:text-indigo-600 transition-colors">
                    {course.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-bold mt-2">
                    {course.code} • Prof. Chen
                  </p>
                  <div className="mt-8 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs font-bold text-slate-800">
                    <course.icon size={14} className="text-indigo-600" /> Next:
                    Module 4 Session
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* --- STATS --- */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm p-8 flex items-center gap-8 rounded-[32px]">
            <div className="w-20 h-20 rounded-full border-[6px] border-green-50 flex items-center justify-center relative">
              <TrendingUp className="text-green-500" size={28} />
              <div className="absolute inset-0 rounded-full border-t-[6px] border-green-500 border-l-[6px]" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Current GPA
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black text-slate-900">3.85</span>
                <span className="text-sm font-bold text-slate-300">/ 4.0</span>
              </div>
            </div>
          </Card>

          <Card className="border-none shadow-sm p-8 flex justify-between items-center rounded-[32px]">
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Completed Sessions
              </p>
              <h3 className="text-4xl font-black text-slate-900 mt-1">
                {studentStats.completedCount}
              </h3>
            </div>
            <div className="h-16 w-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ACTIVITY_DATA.map((v) => ({ val: v }))}>
                  <Bar dataKey="val" radius={[3, 3, 0, 0]}>
                    {ACTIVITY_DATA.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 6 ? "#4F46E5" : "#C7D2FE"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
