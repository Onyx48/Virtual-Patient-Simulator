import React from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowsUpDownIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";

function SchoolTable({ data, onEditClick, onDeleteClick, onSort, canEdit }) {
  const handleSort = (key) => {
    if (onSort) onSort(key);
  };

  const SortIcon = () => (
    <ArrowsUpDownIcon className="h-4 w-4 inline-block ml-1 text-gray-400" />
  );

  return (
    <div className="bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("schoolName")}
              >
                School Name <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("email")}
              >
                Email <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("description")}
              >
                Description <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("status")}
              >
                Subscription <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("expireDate")}
              >
                Expire <SortIcon />
              </th>
               <th
                 scope="col"
                 className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                 onClick={() => handleSort("timeSpent")}
               >
                 Time Spent <SortIcon />
               </th>
               <th
                 scope="col"
                 className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
               >
                 Assigned Admin
               </th>
               <th
                 scope="col"
                 className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
               >
                 Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((school) => (
                <tr
                  key={school._id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {school.schoolName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {school.email}
                  </td>
                  <td
                    className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate"
                    title={school.description}
                  >
                    {school.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {school.status === "Active" ? (
                      <span className="text-gray-900 font-medium">
                        Active{" "}
                        <span className="text-gray-500 font-normal">
                          ({school.duration || "1 Year"})
                        </span>
                      </span>
                    ) : (
                      <span className="text-red-500 font-medium">
                        {school.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {school.expireDate
                      ? format(new Date(school.expireDate), "dd MMM, yyyy")
                      : "-"}
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                     {school.timeSpent || "0h"}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                     {school.assignedAdmin?.id ? school.assignedAdmin.name : "Unassigned"}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-3">
                      {canEdit && (
                        <button
                          onClick={() => onEditClick(school)}
                          className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50"
                          title="Edit"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                      )}
                      {canEdit && onDeleteClick && (
                        <button
                          onClick={() => onDeleteClick(school._id)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="7"
                  className="px-6 py-10 text-center text-sm text-gray-500"
                >
                  No schools found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination Mockup */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{data.length}</span> of{" "}
              <span className="font-medium">{data.length}</span> total
            </p>
          </div>
          <div>
            <nav
              className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              aria-label="Pagination"
            >
              <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                <span className="sr-only">Previous</span>
                &lt;
              </button>
              <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-orange-500 text-sm font-medium text-white">
                1
              </button>
              <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                2
              </button>
              <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                3
              </button>
              <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                <span className="sr-only">Next</span>
                &gt;
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SchoolTable;
