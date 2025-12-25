import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Search, Filter, Plus, X } from "lucide-react";

function ScenarioManagementControls({
  searchTerm,
  onSearchChange,
  onApplyFilters,
  onAddNewClick,
  initialFilters,
}) {
  const [showFilters, setShowFilters] = useState(false);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: initialFilters || { status: "", creator: "" },
  });

  const onSubmit = (data) => {
    if (onApplyFilters) onApplyFilters(data);
    setShowFilters(false);
  };

  const handleClear = () => {
    reset();
    if (onApplyFilters) onApplyFilters({});
    setShowFilters(false);
  };

  return (
    <div className="mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Search & Filter */}
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search for a scenario"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-300 sm:text-sm shadow-sm hover:border-gray-300 transition-colors"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-4 py-2.5 border rounded-lg shadow-sm text-sm font-medium transition-colors ${
              showFilters
                ? "bg-gray-100 border-gray-300 text-gray-900"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Filter className="h-4 w-4 mr-2 text-gray-500" />
            Filters
          </button>
        </div>

        {/* Right Side: New Scenario Button */}
        <button
          onClick={onAddNewClick}
          className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-black hover:bg-gray-800 shadow-sm transition-all"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Scenario
        </button>
      </div>

      {/* Filter Dropdown Panel */}
      {showFilters && (
        <div className="mt-4 p-5 bg-white rounded-xl shadow-lg border border-gray-100 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Filter Scenarios
            </h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                {...register("status")}
                className="block w-full pl-3 pr-10 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-black focus:border-black rounded-md"
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div className="flex items-end gap-2 md:col-span-2 justify-end">
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Clear
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800"
              >
                Apply
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ScenarioManagementControls;
