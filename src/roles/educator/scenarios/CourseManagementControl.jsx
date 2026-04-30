import React from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Filter,
} from "lucide-react";

// shadcn/ui imports
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CourseManagement() {
  const courses = [
    {
      id: "CS-401",
      name: "Advanced Machine Learning",
      students: 42,
      status: "Active",
      type: "Core",
      date: "Oct 12, 2025",
    },
    {
      id: "PHI-202",
      name: "Data Ethics & Privacy",
      students: 128,
      status: "Published",
      type: "Elective",
      date: "Sep 28, 2025",
    },
    {
      id: "ENG-305",
      name: "Cloud Infrastructure",
      students: 35,
      status: "Draft",
      type: "Major",
      date: "Nov 02, 2025",
    },
    {
      id: "MAT-101",
      name: "Discrete Mathematics",
      students: 210,
      status: "Active",
      type: "Core",
      date: "Aug 15, 2025",
    },
  ];

  return (
    <div className="flex-1 min-h-screen bg-slate-50/50 p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Course Management
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Review, edit, and organize your academic curriculum.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-[#6366F1] hover:bg-[#5558E3] rounded-2xl font-black px-8 h-14 shadow-xl shadow-indigo-100 transition-all active:scale-[0.98]"
          >
            <Plus className="mr-2" size={20} /> Create New Course
          </Button>
        </div>

        {/* --- TABLE CARD --- */}
        <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-white">
          <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <Input
                placeholder="Search by course name or code..."
                className="pl-10 bg-slate-50 border-none rounded-xl h-11"
              />
            </div>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200 font-bold gap-2"
            >
              <Filter size={16} /> Filters
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-none">
                  <TableHead className="px-8 py-5 font-black text-[10px] uppercase tracking-widest text-slate-400">
                    Course Code
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">
                    Course Name
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">
                    Status
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">
                    Enrolled
                  </TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">
                    Last Modified
                  </TableHead>
                  <TableHead className="text-right px-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow
                    key={course.id}
                    className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors group"
                  >
                    <TableCell className="px-8 font-bold text-slate-900">
                      {course.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900">
                          {course.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {course.type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`font-black text-[10px] border-none px-3 py-1 ${
                          course.status === "Active"
                            ? "bg-green-100 text-green-600"
                            : course.status === "Draft"
                              ? "bg-slate-100 text-slate-400"
                              : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {course.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-slate-600">
                      {course.students} Students
                    </TableCell>
                    <TableCell className="text-slate-400 font-medium text-sm">
                      {course.date}
                    </TableCell>
                    <TableCell className="text-right px-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-9 w-9 p-0 rounded-xl hover:bg-slate-100"
                          >
                            <MoreHorizontal
                              size={18}
                              className="text-slate-400"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 rounded-xl border-slate-100 shadow-xl p-2"
                        >
                          <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-2 py-1.5">
                            Actions
                          </DropdownMenuLabel>
                          <DropdownMenuItem className="font-bold gap-2 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer rounded-lg">
                            <Eye size={16} /> View Performance
                          </DropdownMenuItem>
                          <DropdownMenuItem className="font-bold gap-2 focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer rounded-lg">
                            <Edit size={16} /> Edit Curriculum
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-50" />
                          <DropdownMenuItem className="font-bold gap-2 text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer rounded-lg">
                            <Trash2 size={16} /> Archive Course
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
