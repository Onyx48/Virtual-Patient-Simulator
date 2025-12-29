import React from "react";
import { EllipsisHorizontalCircleIcon } from "@heroicons/react/20/solid";

const StatItem = ({ label, value }) => (
  <div className="flex flex-col items-start">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="text-sm font-bold text-gray-900">{value}</p>
  </div>
);

const SchoolCard = ({ school }) => {
  if (!school) {
    return null;
  }

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-800 truncate pr-2">
          {school.name}
        </h3>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-gray-100 mb-4"></div>

      <div className="grid grid-cols-3 gap-2 divide-x divide-gray-200">
        <div className="pr-2">
          <StatItem label="Students" value={school.students || 0} />
        </div>
        <div className="px-2">
          <StatItem label="Educators" value={school.educators || 0} />
        </div>
        <div className="pl-2">
          <StatItem
            label="Active Scenarios"
            value={school.activeScenarios || 0}
          />
        </div>
      </div>
    </div>
  );
};

export default SchoolCard;
