// src/components/Schools/SchoolTable.jsx
import React, { useState, useMemo } from "react";
import { format, parse, isValid } from "date-fns";

// Ensure your image paths are correct relative to SchoolTable.jsx
import sortIconPng from "./sort.png";
import editIconPng from "./edit.png";
import deleteIconPng from "./delete.png";

// Assuming these are from your Shadcn/ui setup
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Make sure this path is correct if using aliases

function SchoolTable({ data, onEditClick, onDeleteClick, sortConfig, onSort }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const currentSchools = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  const handleEdit = (school) => {
    if (onEditClick) {
      onEditClick(school);
    }
  };
  const handleDelete = (schoolId) => {
    if (onDeleteClick) {
      onDeleteClick(schoolId);
    }
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 3;
    const ellipsisThreshold = 5;

    if (totalPages <= ellipsisThreshold) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      if (totalPages > 1) pageNumbers.push(2);

      if (currentPage > 2 && totalPages > maxVisiblePages) {
        pageNumbers.push("...");
      }

      for (
        let i = Math.max(3, currentPage - 1);
        i <= Math.min(totalPages - 2, currentPage + 1);
        i++
      ) {
        if (!pageNumbers.includes(i)) pageNumbers.push(i);
      }

      if (currentPage < totalPages - 1 && totalPages > maxVisiblePages) {
        if (!pageNumbers.includes("...end")) pageNumbers.push("...end");
      }

      if (!pageNumbers.includes(totalPages - 1) && totalPages > 2)
        pageNumbers.push(totalPages - 1);
      if (!pageNumbers.includes(totalPages)) pageNumbers.push(totalPages);

      const uniquePageNumbers = Array.from(new Set(pageNumbers)).sort((a, b) =>
        typeof a === "number" && typeof b === "number"
          ? a - b
          : typeof a === "string"
          ? 1
          : -1
      );

      let finalPageNumbers = [];
      for (let i = 0; i < uniquePageNumbers.length; i++) {
        finalPageNumbers.push(uniquePageNumbers[i]);
        if (
          typeof uniquePageNumbers[i] === "number" &&
          typeof uniquePageNumbers[i + 1] === "number" &&
          uniquePageNumbers[i + 1] > uniquePageNumbers[i] + 1 &&
          i < uniquePageNumbers.length - 1
        ) {
          if (uniquePageNumbers[i + 1] !== uniquePageNumbers[i] + 2) {
            finalPageNumbers.push("...");
          }
        }
      }
      return finalPageNumbers.filter((val) => val !== "...end");
    }

    return pageNumbers.map((number, index) => (
      <span
        key={typeof number === "number" ? number : `ellipsis-${index}`}
        className={`px-3 py-1 mx-1 rounded-md ${
          typeof number === "number" ? "cursor-pointer" : "cursor-default"
        } ${
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

  const getSortIconClasses = (key) => {
    let classes = "inline ml-1 w-3 h-3 transition-opacity duration-200"; // Added transition
    if (sortConfig?.key === key) {
      classes += " opacity-100"; // Active sort
      if (sortConfig.direction === "desc") {
        classes += " rotate-180"; // Rotate for descending
      }
    } else {
      classes += " opacity-40 group-hover:opacity-75"; // Dim if not active, slightly brighter on hover
    }
    return classes;
  };

  return (
    <div className="container mx-auto mt-8 p-4 bg-white shadow-md rounded-lg border border-gray-200">
      <Table className="w-full">
        <TableHeader className="bg-gray-50">
          <TableRow>
            <TableHead
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group" // Added 'group' class for hover
              onClick={() => onSort("schoolName")}
            >
              School Name
              <img
                src={sortIconPng}
                alt="Sort Icon"
                className={getSortIconClasses("schoolName")}
              />
            </TableHead>
            <TableHead
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group"
              onClick={() => onSort("email")}
            >
              Email
              <img
                src={sortIconPng}
                alt="Sort Icon"
                className={getSortIconClasses("email")}
              />
            </TableHead>
            <TableHead
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group"
              onClick={() => onSort("description")}
            >
              Description
              <img
                src={sortIconPng}
                alt="Sort Icon"
                className={getSortIconClasses("description")}
              />
            </TableHead>
            <TableHead
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group"
              onClick={() => onSort("subscription")}
            >
              Subscription
              <img
                src={sortIconPng}
                alt="Sort Icon"
                className={getSortIconClasses("subscription")}
              />
            </TableHead>
            <TableHead
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group"
              onClick={() => onSort("expireDate")}
            >
              Expire Date
              <img
                src={sortIconPng}
                alt="Sort Icon"
                className={getSortIconClasses("expireDate")}
              />
            </TableHead>
            <TableHead
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group"
              onClick={() => onSort("startDate")}
            >
              Start Date
              <img
                src={sortIconPng}
                alt="Sort Icon"
                className={getSortIconClasses("startDate")}
              />
            </TableHead>
            <TableHead
              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group"
              onClick={() => onSort("timeSpent")}
            >
              Time Spent
              <img
                src={sortIconPng}
                alt="Sort Icon"
                className={getSortIconClasses("timeSpent")}
              />
            </TableHead>
            <TableHead className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="bg-white divide-y divide-gray-200">
          {currentSchools.length > 0 ? (
            currentSchools.map((school) => (
              <TableRow key={school._id}>
                <TableCell className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {school.schoolName}
                </TableCell>
                <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {school.email}
                </TableCell>
                <TableCell className="px-4 py-4 text-sm text-gray-500">
                  {school.description}
                </TableCell>
                <TableCell
                  className={`px-4 py-4 whitespace-nowrap text-sm ${
                    school.status === "Expired"
                      ? "text-red-500"
                      : "text-gray-500"
                  }`}
                >
                  {school.subscription}
                </TableCell>
                <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {school.expireDate
                    ? format(new Date(school.expireDate), "dd/MM/yyyy")
                    : "N/A"}
                </TableCell>
                <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {school.startDate
                    ? format(new Date(school.startDate), "dd/MM/yyyy")
                    : "N/A"}
                </TableCell>
                <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {school.timeSpent}
                </TableCell>

                <TableCell className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {onEditClick && (
                    <button
                      onClick={() => handleEdit(school)}
                      className="inline-flex items-center justify-center p-1 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
                      title="Edit"
                    >
                      <img src={editIconPng} alt="Edit" className="w-4 h-4" />
                    </button>
                  )}
                  {onDeleteClick && (
                    <button
                      onClick={() => handleDelete(school._id)}
                      className="inline-flex items-center justify-center p-1 rounded-full text-red-600 hover:text-red-900 hover:bg-red-100 focus:outline-none"
                      title="Delete"
                    >
                      <img
                        src={deleteIconPng}
                        alt="Delete"
                        className="w-4 h-4"
                      />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={8}
                className="px-4 py-4 text-center text-gray-500"
              >
                No schools found.
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
              of <span className="font-medium">{totalItems}</span> results
            </p>
          </div>
          <div
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
            >
              Previous
            </span>
            {renderPageNumbers()}
            <span
              onClick={() => handlePageChange(currentPage + 1)}
              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 ${
                totalPages === 0 || currentPage === totalPages
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-gray-50 cursor-pointer"
              }`}
            >
              Next
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SchoolTable;
