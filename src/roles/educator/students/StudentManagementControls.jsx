import React, { useState } from 'react';

function StudentManagementControls({
  searchTerm,
  onSearchChange,
  onAddNewClick,
  onAssignScenariosClick,
  initialFilters,
  onApplyFilters
}) {
  const [filters, setFilters] = useState(initialFilters || {});

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onApplyFilters(newFilters);
  };

  const handleSearchChange = (e) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      {/* Search Input */}
      <div className="flex-1 min-w-64">
        <input
          type="text"
          placeholder="Search students..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* School Filter */}
      <div>
        <input
          type="text"
          placeholder="Filter by school..."
          value={filters.schoolName || ''}
          onChange={(e) => handleFilterChange('schoolName', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Email Filter */}
      <div>
        <input
          type="text"
          placeholder="Filter by email..."
          value={filters.emailAddress || ''}
          onChange={(e) => handleFilterChange('emailAddress', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        {onAddNewClick && (
          <button
            onClick={onAddNewClick}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md font-medium"
          >
            New Student
          </button>
        )}
        {onAssignScenariosClick && (
          <button
            onClick={onAssignScenariosClick}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-medium"
          >
            Assign Scenarios
          </button>
        )}
      </div>
    </div>
  );
}

export default StudentManagementControls;