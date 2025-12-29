import React from "react";
import { Search, ChevronDown } from "lucide-react";

function ScenarioManagementControlsStudent({
  searchTerm,
  onSearchChange,
  sortConfig,
  onSortChange,
}) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Left Side: Search Input */}
      <div className="relative w-full max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search for scenarios"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100 sm:text-sm shadow-sm transition-all"
        />
      </div>

      {/* Right Side: Sort By Dropdown */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 font-medium">Sort By:</span>
        <div className="relative">
          <select
            value={sortConfig}
            onChange={(e) => onSortChange(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-gray-100 border-none rounded-lg text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer hover:bg-gray-200 transition-colors outline-none"
          >
            <option value="All">All</option>
            <option value="Highest">Highest Score</option>
            <option value="Lowest">Lowest Score</option>
            <option value="Recent">Recently Added</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

export default ScenarioManagementControlsStudent;
