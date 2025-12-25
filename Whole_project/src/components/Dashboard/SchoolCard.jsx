import React from "react";
import { EllipsisHorizontalCircleIcon } from "@heroicons/react/20/solid";

const StatItem = ({ label, value }) => (
  <div className="text-center px-2">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-lg font-semibold text-gray-800">{value}</p>
  </div>
);

const SchoolCard = ({ school }) => {
  if (!school) {
    return null;
  }
;
  return(
  <div className="bg-white p-4 rounded-lg shadow-md flex flex-col space-y-3">
    <div className="flex justify-between items-center">
      <h3 className="text-md font-semibold text-gray-700 truncate pr-2">
        {school.name}
      </h3>
      <button
        type="button"
        aria-label="School options"
        className="text-gray-400 hover:text-gray-600 focus:outline-none">
          <EllipsisHorizontalCircleIcon className="h-5 w-5"/>
        </button>
    </div>
    <div className="flex justify-around items-center pt-2 border-t border-gray-100 mt-2"> 
      <StatItem label="Students" value={school.students}/>
      <div className="h-8 w-px bg-gray-200"></div>
      <StatItem label="Educators" valaue={school.educators}/>
      <div className="h-8 w-px bg-gray-200"></div>
      <StatItem label="Active Scenerios" value={school.activeScenarios}/>
    </div>
  </div>
)
}

export default SchoolCard