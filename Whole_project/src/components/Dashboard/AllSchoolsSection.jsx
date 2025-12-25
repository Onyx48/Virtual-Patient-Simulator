import React, { useState, useMemo } from "react";
import SchoolCard from "./SchoolCard";

const INITIAL_SCHOOLS_TO_SHOW = 6;

const AllSchoolsSection = ({ schools: dynamicSchools }) => {
  const defaultSchools = useMemo(
    () => [
      {
        id: 1,
        name: "Maplewood Academy",
        students: 100,
        educators: 17,
        activeScenarios: 5,
      },
      {
        id: 2,
        name: "Riverside High School",
        students: 115,
        educators: 18,
        activeScenarios: 6,
      },
      {
        id: 3,
        name: "Cedar Grove Institute",
        students: 90,
        educators: 15,
        activeScenarios: 4,
      },
      {
        id: 4,
        name: "Oakwood Secondary",
        students: 120,
        educators: 20,
        activeScenarios: 8,
      },
      {
        id: 5,
        name: "Pine Ridge College",
        students: 95,
        educators: 16,
        activeScenarios: 3,
      },
      {
        id: 6,
        name: "Willow Creek School",
        students: 110,
        educators: 19,
        activeScenarios: 7,
      },
      {
        id: 7,
        name: "Mountain View Prep",
        students: 130,
        educators: 22,
        activeScenarios: 9,
      },
      {
        id: 8,
        name: "Lakeside Junior High",
        students: 80,
        educators: 14,
        activeScenarios: 5,
      },
    ],
    []
  );

  const allSchoolsData = dynamicSchools || defaultSchools;

  const [showAll, setShowAll] = useState(false);

  const schoolsToDisplay = showAll
    ? allSchoolsData
    : allSchoolsData.slice(0, INITIAL_SCHOOLS_TO_SHOW);

  const showViewAllButton =
    allSchoolsData.length > INITIAL_SCHOOLS_TO_SHOW && !showAll;
  const showViewLessButton =
    allSchoolsData.length > INITIAL_SCHOOLS_TO_SHOW && showAll;

  const handleViewAllClick = () => {
    setShowAll(true);
  };
  const handleShowLessClick = () => {
    setShowAll(false);
  };

  return (
    <div className="mt-8 p-4 sm:p-6 bg-white rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-xl font-bold text-gray-800">All Schools</h2>
        {showViewAllButton && (
          <button
            type="button"
            onClick={handleViewAllClick}
            className="text-sm text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            View All
          </button>
        )}
        {showViewLessButton && (
          <button
            type="button"
            onClick={handleShowLessClick}
            className="text-sm text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            Show Less
          </button>
        )}
      </div>
      {schoolsToDisplay.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {schoolsToDisplay.map((school) => (
            <SchoolCard key={school.id} school={school} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No schools to display.</p>
      )}
    </div>
  );
};

export default AllSchoolsSection;
