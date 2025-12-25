import React, { useState } from "react";
import { useForm } from "react-hook-form";

import searchIconPng from "/search.png";
import sortIconPng from "/sort.png";
import plusIconPng from "/plus.png";

function ScenarioManagementControls({
  searchTerm,
  onSearchChange,
  onApplyFilters,
  onAddNewClick,
  initialFilters,
}) {
  const [showFilters, setShowFilters] = useState(false);

  const { register, handleSubmit } = useForm({
    defaultValues: initialFilters || {
      status: "",
      creator: "",
    },
  });

  const onSubmit = (data) => {
    console.log("Applying Filters:", data);
    if (onApplyFilters) {
      onApplyFilters(data);
    }
    setShowFilters(false);
  };

  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const ChevronDownIcon = () => (
    <svg
      className="fill-current h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
    >
      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
    </svg>
  );

  return (
    <div className="p-4 bg-gray-100 mt-0">
      <div className="flex items-center">
        <div className="flex items-center max-w-[500px] flex-grow">
          <div className="relative flex-grow">
            <img
              src={searchIconPng}
              alt="Search Icon"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search for Scenario"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={
                "w-full pl-10 pr-4 py-2 rounded bg-white text-black border border-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-black text-sm"
              }
            />
          </div>
          <button
            className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 ml-4 transition duration-200 ease-in-out text-sm"
            onClick={handleFilterToggle}
          >
            <img src={sortIconPng} alt="Filters Icon" className="w-4 h-4 mr-1" />
            Filters
          </button>
        </div>

        <button
          className="flex items-center bg-black hover:bg-gray-800 text-white rounded-lg px-4 py-2 transition duration-200 ease-in-out text-sm ml-auto"
          onClick={onAddNewClick}
        >
          <img src={plusIconPng} alt="Plus Icon" className="w-4 h-4 mr-1" />
          New Scenario
        </button>
      </div>

      {showFilters && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Filter Scenarios</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="filterStatus"
                className="block text-sm font-medium text-gray-700"
              >
                Status
              </label>
              <div className="relative">
                <select
                  id="filterStatus"
                  {...register("status")}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 appearance-none bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                  <option value="Archived">Archived</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDownIcon />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="filterCreator"
                className="block text-sm font-medium text-gray-700"
              >
                Creator
              </label>
              <input
                type="text"
                id="filterCreator"
                {...register("creator")}
                placeholder="Enter Creator Name"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium"
              >
                Close
              </button>

              <button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                Apply Filters
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ScenarioManagementControls;