import React from "react";
import { Search, Filter, Plus } from "lucide-react";

function ScenarioManagementControls({
  searchTerm,
  onSearchChange,
  onAddNewClick,
  onApplyFilters,
  initialFilters,
}) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
      {/* Left Side: Search & Filter */}
      <div className="flex w-full sm:w-auto items-center gap-3 flex-1">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search for a scenario"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400 transition-all shadow-sm placeholder:text-gray-400"
          />
        </div>

        {/* Filter Button */}
        <button
          onClick={() => onApplyFilters && onApplyFilters(initialFilters)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>

      {/* Right Side: New Scenario Button */}
      <div className="flex items-center w-full sm:w-auto justify-end">
        {onAddNewClick && (
          <button
            onClick={onAddNewClick}
            className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors shadow-md"
          >
            <Plus className="h-4 w-4" />
            New Scenario
          </button>
        )}
      </div>
    </div>
  );
}

export default ScenarioManagementControls;
