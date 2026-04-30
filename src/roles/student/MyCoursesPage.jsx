import React, { useState } from "react";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  PlayCircle,
  FileText,
  ExternalLink,
  Trash2
} from "lucide-react";
import { COURSES } from "./data/mockCourses.js";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MyCoursesPage() {
  const [activeTab, setActiveTab] = useState("all");

  const filteredCourses = COURSES.filter(course => 
    activeTab === "all" || course.status === activeTab
  );

  return (
    <div className="flex-1 min-h-screen bg-slate-50/50">
      <main className="p-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">My Courses</h1>
            <p className="text-slate-500 font-medium mt-1">Track your academic progress and resume learning.</p>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Search your courses..." 
              className="pl-10 bg-white border-none shadow-sm rounded-xl h-12" 
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="mb-8" onValueChange={setActiveTab}>
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-8">
            {["All", "In-Progress", "Completed"].map((tab) => (
              <TabsTrigger 
                key={tab}
                value={tab.toLowerCase()} 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-0 pb-4 font-black text-slate-400 data-[state=active]:text-indigo-600 transition-all"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col lg:flex-row gap-10">
          <aside className="w-full lg:w-64 space-y-8 shrink-0">
            <Card className="border-none shadow-sm p-6 bg-white rounded-[24px]">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Academic Year</p>
                  <div className="space-y-3">
                    {["2023 - 2024", "2022 - 2023"].map((year) => (
                      <div key={year} className="flex items-center space-x-3 group cursor-pointer">
                        <Checkbox id={year} className="border-slate-200 data-[state=checked]:bg-indigo-600" />
                        <label htmlFor={year} className="text-sm font-bold leading-none cursor-pointer text-slate-600 group-hover:text-indigo-600 transition-colors">
                          {year}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-slate-100" />

                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Category</p>
                  <div className="space-y-3">
                    {["Computer Science", "Mathematics", "Physics"].map((cat) => (
                      <div key={cat} className="flex items-center space-x-3 group cursor-pointer">
                        <Checkbox id={cat} className="border-slate-200 data-[state=checked]:bg-indigo-600" />
                        <label htmlFor={cat} className="text-sm font-bold leading-none cursor-pointer text-slate-600 group-hover:text-indigo-600 transition-colors">
                          {cat}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-none shadow-sm p-6 bg-indigo-600 rounded-[24px] text-white">
              <h4 className="font-black text-lg leading-tight mb-2">Need Help?</h4>
              <p className="text-indigo-100 text-xs font-medium mb-4">Contact your academic advisor for course selection assistance.</p>
              <Button variant="secondary" className="w-full rounded-xl font-black text-xs text-indigo-600">
                Contact Advisor
              </Button>
            </Card>
          </aside>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6 flex-1">
            {filteredCourses.map((course) => (
              <Card key={course.id} className="overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-[32px] flex flex-col bg-white group">
                <div className="h-40 bg-slate-200 relative overflow-hidden">
                   <img 
                    src={course.image} 
                    alt={course.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                   />
                   <div className="absolute top-4 left-4">
                     <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none text-[10px] font-black px-3 py-1 shadow-sm uppercase">
                       {course.category}
                     </Badge>
                   </div>
                </div>

                <CardHeader className="p-6 pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-xl leading-tight font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {course.title}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg shrink-0">
                          <MoreVertical size={18} className="text-slate-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 border-slate-100 shadow-xl">
                        <DropdownMenuItem className="font-bold gap-2 cursor-pointer rounded-lg">
                          <BookOpen size={16} /> View Syllabus
                        </DropdownMenuItem>
                        <DropdownMenuItem className="font-bold gap-2 cursor-pointer rounded-lg">
                          <FileText size={16} /> Course Materials
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="font-bold gap-2 text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer rounded-lg">
                          <Trash2 size={16} /> Unenroll
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-1">Instructor: {course.instructor}</p>
                </CardHeader>

                <CardContent className="p-6 pt-4 flex-1">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Progress</p>
                        <p className="text-sm font-black text-slate-900">{course.progress}%</p>
                      </div>
                      {course.progress === 100 ? (
                        <CheckCircle2 className="text-green-500" size={20} />
                      ) : (
                        <Clock className="text-slate-300" size={20} />
                      )}
                    </div>
                    <Progress 
                      value={course.progress} 
                      className="h-2 bg-slate-100"
                    />
                  </div>
                </CardContent>

                <CardFooter className="p-6 pt-0">
                  <Button 
                    className={`w-full font-black rounded-xl py-6 transition-all active:scale-95 shadow-md ${
                      course.progress === 100 
                      ? "bg-slate-100 text-slate-600 hover:bg-slate-200" 
                      : "bg-[#6F366F1] hover:bg-[#5538F3] text-white shadow-indigo-100"
                    }`}
                  >
                    {course.progress === 100 ? "Review Course" : "Resume Learning"}
                    {course.progress < 100 && <PlayCircle className="ml-2" size={18} />}
                    {course.progress === 100 && <ExternalLink className="ml-2" size={16} />}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}