import React, { useState, useMemo } from "react";
import { ArrowUpDown, Pencil, Eye } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Assuming you have these UI components or use standard HTML table

function ScenarioTable({ data, onEditClick, sortConfig, onSort }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Matches the "Showing 5 of 5" in the screenshot

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const currentScenarios = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // --- Helper for Circular Score (Donut Chart) ---
  const CircularScore = ({ score }) => {
    if (!score || score === "--") {
      return (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full border-2 border-gray-200"></div>
          <span className="text-sm text-gray-400 font-medium">--</span>
        </div>
      );
    }

    // Calculate stroke for SVG
    const radius = 8;
    const circumference = 2 * Math.PI * radius;
    // Score is usually out of 10 based on image (e.g., 7, 8, 5)
    const normalizedScore = score > 10 ? score / 10 : score;
    const offset = circumference - (normalizedScore / 10) * circumference;

    // Color logic
    const color =
      score >= 8
        ? "text-green-500"
        : score >= 5
        ? "text-orange-400"
        : "text-red-500";

    return (
      <div className="flex items-center gap-2">
        <div className="relative w-5 h-5 transform -rotate-90">
          {/* Background Circle */}
          <svg className="w-full h-full">
            <circle
              cx="10"
              cy="10"
              r={radius}
              stroke="currentColor"
              strokeWidth="3"
              fill="transparent"
              className="text-gray-200"
            />
            <circle
              cx="10"
              cy="10"
              r={radius}
              stroke="currentColor"
              strokeWidth="3"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={color}
            />
          </svg>
        </div>
        <span className="text-sm font-semibold text-gray-900">{score}</span>
      </div>
    );
  };

  const renderStatus = (status) => {
    let dotColor = "bg-gray-400";
    let textColor = "text-gray-500"; // Default gray like "Archived"

    if (status === "Published") {
      dotColor = "bg-green-500";
      textColor = "text-green-600 font-medium";
    } else if (status === "Draft") {
      dotColor = "bg-black"; // Based on Image 1 "Draft" is black dot
      textColor = "text-gray-900 font-medium";
    }

    return (
      <div className="flex items-center">
        <span className={`h-1.5 w-1.5 rounded-full mr-2 ${dotColor}`}></span>
        <span className={`text-sm ${textColor}`}>{status}</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <Table className="w-full">
        <TableHeader className="bg-gray-50/50 border-b border-gray-100">
          <TableRow>
            <TableHead
              className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
              onClick={() => onSort("scenarioName")}
            >
              <div className="flex items-center gap-1">
                Scenario Name <ArrowUpDown className="w-3 h-3 text-gray-400" />
              </div>
            </TableHead>
            <TableHead
              className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
              onClick={() => onSort("description")}
            >
              <div className="flex items-center gap-1">
                Description <ArrowUpDown className="w-3 h-3 text-gray-400" />
              </div>
            </TableHead>
            <TableHead
              className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
              onClick={() => onSort("score")}
            >
              <div className="flex items-center gap-1">
                Avg. Score <ArrowUpDown className="w-3 h-3 text-gray-400" />
              </div>
            </TableHead>
            <TableHead
              className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
              onClick={() => onSort("status")}
            >
              <div className="flex items-center gap-1">
                Status <ArrowUpDown className="w-3 h-3 text-gray-400" />
              </div>
            </TableHead>
            <TableHead className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="divide-y divide-gray-100">
          {currentScenarios.map((scenario) => (
            <TableRow
              key={scenario.id}
              className="hover:bg-gray-50/50 transition-colors"
            >
              <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {scenario.scenarioName}
              </TableCell>
              <TableCell className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                {scenario.description}
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <CircularScore score={scenario.avgScore || "--"} />
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap">
                {renderStatus(scenario.status)}
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onEditClick(scenario)}
                    className="flex items-center text-gray-400 hover:text-gray-900 transition-colors gap-1"
                  >
                    <Pencil className="w-4 h-4" />{" "}
                    <span className="text-xs">Edit</span>
                  </button>
                  <button className="flex items-center text-gray-400 hover:text-gray-900 transition-colors gap-1">
                    <Eye className="w-4 h-4" />{" "}
                    <span className="text-xs">Test</span>
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {currentScenarios.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="px-6 py-8 text-center text-gray-500 text-sm"
              >
                No scenarios found matching your criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination Footer - Matching Image 1 */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
        <p className="text-sm text-gray-600">
          Showing{" "}
          <span className="font-medium">
            {(currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          of <span className="font-medium">{totalItems}</span> total
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="sr-only">Previous</span>
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Pagination Numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                currentPage === page
                  ? "bg-[#F59E0B] text-white" // Matches the Orange active state in image
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="sr-only">Next</span>
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScenarioTable;
