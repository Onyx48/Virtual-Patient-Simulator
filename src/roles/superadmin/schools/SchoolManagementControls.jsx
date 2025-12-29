import React from "react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

function SchoolManagementControls({
  searchTerm,
  onSearchChange,
  onAddNewClick,
  onApplyFilters, // Placeholder for future filter modal logic
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
      <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
        {/* Search Bar */}
        <div className="relative w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search for a school"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm shadow-sm"
          />
        </div>

        {/* Filters Button */}
        <button
          onClick={() => onApplyFilters && onApplyFilters({})}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors"
        >
          <FunnelIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
          Filters
        </button>
      </div>

      {/* New School Button */}
      {onAddNewClick && (
        <button
          onClick={onAddNewClick}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          New School
        </button>
      )}
    </div>
  );
}

export default SchoolManagementControls;
