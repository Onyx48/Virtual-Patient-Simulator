import React from "react";
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";

function SchoolTable({
  data,
  onEditClick,
  onDeleteClick,
  onSort,
  canEdit,
  isDeletingId,
}) {
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
                    {school.assignedAdmin?.id
                      ? school.assignedAdmin.name
                      : "Unassigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          onClick={() => onEditClick(school)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {canEdit && onDeleteClick && (
                        <button
                          onClick={() => onDeleteClick(school._id)}
                          disabled={isDeletingId === school._id}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeletingId === school._id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="8"
                  className="px-6 py-10 text-center text-sm text-gray-500"
                >
                  No schools found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


    </div>
  );
}

export default SchoolTable;
