import React, { useState } from "react";
import { useForm } from "react-hook-form";

import searchIconPng from "/search.png";
import sortIconPng from "/sort.png";
import plusIconPng from "/plus.png";

function EducatorManagementControls({
  searchTerm,
  onSearchChange,
  onApplyFilters,
  onAssignScenariosClick,
  onAddNewClick,
  initialFilters,
}) {
  const [showFilters, setShowFilters] = useState(false);

  const { register, handleSubmit } = useForm({
    defaultValues: initialFilters || {
      educatorName: "",
      schoolName: "",
      numberOfStudentsMin: "",
      numberOfStudentsMax: "",
    },
  });

  const onSubmit = (data) => {
    const formattedFilters = {
      ...data,
      numberOfStudentsMin: data.numberOfStudentsMin === "" ? null : parseFloat(data.numberOfStudentsMin),
      numberOfStudentsMax: data.numberOfStudentsMax === "" ? null : parseFloat(data.numberOfStudentsMax),
    };

    if (onApplyFilters) {
      onApplyFilters(formattedFilters);
    }
    setShowFilters(false); // Hide filters after applying
  };

  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const handleAssignScenariosClick = () => {
    if (onAssignScenariosClick) {
      onAssignScenariosClick();
    }
  };

  const handleAddNewClick = () => {
    if (onAddNewClick) {
      onAddNewClick();
    }
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
    <div className="p-4 bg-gray-100 mt-4">
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
              placeholder="Search educator name or email"
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

        <div className="flex items-center space-x-4 ml-auto">
          <button
            className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-4 py-2 transition duration-200 ease-in-out text-sm"
            onClick={handleAssignScenariosClick}
          >
            Assign Scenarios
          </button>

          <button
            className="flex items-center bg-black hover:bg-gray-800 text-white rounded-lg px-4 py-2 transition duration-200 ease-in-out text-sm"
            onClick={handleAddNewClick}
          >
            <img src={plusIconPng} alt="Plus Icon" className="w-4 h-4 mr-1" />
            New Educator
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Filter Educators</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="filterEducatorName"
                className="block text-sm font-medium text-gray-700"
              >
                Educator Name
              </label>
              <input
                type="text"
                id="filterEducatorName"
                {...register("educatorName")}
                placeholder="Enter Educator Name"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="filterSchoolName"
                className="block text-sm font-medium text-gray-700"
              >
                School Name
              </label>
              <input
                type="text"
                id="filterSchoolName"
                {...register("schoolName")}
                placeholder="Enter School Name"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

             <div className="grid gap-2">
               <label className="block text-sm font-medium text-gray-700">
                 Number of Students
               </label>
               <div className="flex space-x-4">
                 <div className="w-1/2 grid gap-1">
                   <label htmlFor="filterNumberOfStudentsMin" className="sr-only">
                     Minimum Number of Students
                   </label>
                   <input
                     type="number"
                     id="filterNumberOfStudentsMin"
                     {...register("numberOfStudentsMin", { min: 0 })}
                     placeholder="Min"
                     className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                   />
                 </div>
                 <div className="w-1/2 grid gap-1">
                   <label htmlFor="filterNumberOfStudentsMax" className="sr-only">
                     Maximum Number of Students
                   </label>
                   <input
                     type="number"
                     id="filterNumberOfStudentsMax"
                     {...register("numberOfStudentsMax", { min: 0 })}
                     placeholder="Max"
                     className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                   />
                 </div>
               </div>
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

export default EducatorManagementControls;