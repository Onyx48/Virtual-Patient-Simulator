import React, { useState, useMemo } from "react";

import sortIconPng from "/sort.png";
import editIconPng from "/edit.png";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function ScenarioTable({ data, onEditClick, sortConfig, onSort }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const currentScenarios = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  const handleEdit = (scenario) => {
    if (onEditClick) {
      onEditClick(scenario);
    }
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const renderPageNumbers = () => {
    const pageNumbers = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1, 2, 3);
      if (totalPages > 3) {
        pageNumbers.push("...");
      }
    }

    return pageNumbers.map((number, index) => (
      <span
        key={index}
        className={`px-3 py-1 mx-1 rounded-md cursor-pointer ${
          currentPage === number
            ? "bg-blue-500 text-white"
            : "text-gray-700 hover:bg-gray-200"
        } ${
          typeof number !== "number"
            ? "cursor-default hover:bg-transparent"
            : ""
        }`}
        onClick={() => typeof number === "number" && handlePageChange(number)}
      >
        {number}
      </span>
    ));
  };

  const renderStatus = (status) => {
    let dotColorClass = "bg-gray-400";
    let textColorClass = "text-gray-700";

    if (status === "Published") {
      dotColorClass = "bg-green-500";
      textColorClass = "text-green-700";
    } else if (status === "Archived") {
      dotColorClass = "bg-gray-500";
      textColorClass = "text-gray-700";
    }

    return (
      <div className="flex items-center">
        <span className={`h-2 w-2 rounded-full mr-2 ${dotColorClass}`}></span>
        <span className={`${textColorClass}`}>{status}</span>
      </div>
    );
  };

  return (
    <div className="container mx-auto mt-8 p-4 bg-white shadow-md rounded-lg border border-blue-200">
      <Table className="w-full">
        <TableHeader className="bg-gray-50">
          <TableRow>
            <TableHead
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => onSort("scenarioName")}
            >
              <div className="flex items-center">
                Scenario Name
                <img
                  src={sortIconPng}
                  alt="Sort Icon"
                  className={`ml-1 w-3 h-3 ${
                    sortConfig?.key === "scenarioName"
                      ? "opacity-100"
                      : "opacity-40"
                  }`}
                />
              </div>
            </TableHead>
            <TableHead
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => onSort("description")}
            >
              <div className="flex items-center">
                Description
                <img
                  src={sortIconPng}
                  alt="Sort Icon"
                  className={`ml-1 w-3 h-3 ${
                    sortConfig?.key === "description"
                      ? "opacity-100"
                      : "opacity-40"
                  }`}
                />
              </div>
            </TableHead>
            <TableHead
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => onSort("creator")}
            >
              <div className="flex items-center">
                Creator
                <img
                  src={sortIconPng}
                  alt="Sort Icon"
                  className={`ml-1 w-3 h-3 ${
                    sortConfig?.key === "creator" ? "opacity-100" : "opacity-40"
                  }`}
                />
              </div>
            </TableHead>
            <TableHead
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => onSort("avgTimeSpent")}
            >
              <div className="flex items-center">
                Avg. Time Spent
                <img
                  src={sortIconPng}
                  alt="Sort Icon"
                  className={`ml-1 w-3 h-3 ${
                    sortConfig?.key === "avgTimeSpent"
                      ? "opacity-100"
                      : "opacity-40"
                  }`}
                />
              </div>
            </TableHead>
            <TableHead
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => onSort("status")}
            >
              <div className="flex items-center">
                Status
                <img
                  src={sortIconPng}
                  alt="Sort Icon"
                  className={`ml-1 w-3 h-3 ${
                    sortConfig?.key === "status" ? "opacity-100" : "opacity-40"
                  }`}
                />
              </div>
            </TableHead>
            <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {currentScenarios.map((scenario) => (
            <TableRow key={scenario.id}>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {scenario.scenarioName}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {scenario.description}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {scenario.creator}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {scenario.avgTimeSpent}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {renderStatus(scenario.status)}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => handleEdit(scenario)}
                  className="inline-flex items-center p-1 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
                  title="Edit"
                >
                  <img src={editIconPng} alt="Edit" className="w-4 h-4 mr-1" />
                  Edit
                </button>
              </TableCell>
            </TableRow>
          ))}
          {currentScenarios.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="px-4 py-4 text-center text-gray-500"
              >
                No scenarios found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 border-t border-gray-200 sm:px-6 rounded-b-lg">
        <div className="flex-1 flex justify-between sm:hidden"></div>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(currentPage * itemsPerPage, totalItems)}
              </span>{" "}
              of <span className="font-medium">{totalItems}</span> total
            </p>
          </div>
          <div>
            <nav
              className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              aria-label="Pagination"
            >
              <span
                onClick={() => handlePageChange(currentPage - 1)}
                className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 ${
                  currentPage === 1
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50 cursor-pointer"
                }`}
              ></span>
              {renderPageNumbers()}
              <span
                onClick={() => handlePageChange(currentPage + 1)}
                className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 ${
                  totalPages === 0 || currentPage === totalPages
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50 cursor-pointer"
                }`}
              ></span>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScenarioTable;
