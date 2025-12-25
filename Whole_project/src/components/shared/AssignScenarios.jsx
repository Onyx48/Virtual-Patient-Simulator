import React from "react";

function AssignScenarios({ onClose, studentsToAssign }) {
  const CloseIcon = () => (
    <svg
      className="w-5 h-5 text-gray-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M6 18L18 6M6 6l12 12"
      ></path>
    </svg>
  );

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-3 mb-4">
        <h2 className="text-xl font-semibold">Assign Scenarios</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 focus:outline-none"
            title="Close"
          >
            <CloseIcon />
          </button>
        )}
      </div>
      <div className="py-4">
        <p className="text-gray-700 mb-4">
          {studentsToAssign
            ? `Assigning scenarios to ${studentsToAssign.length} selected students.`
            : "Select students from the table to assign scenarios."}
        </p>
        <div className="border p-4 rounded text-gray-600">
          <p>Scenario Selection UI goes here.</p>
        </div>
      </div>
      <div className="flex justify-end space-x-4 mt-6 border-t pt-4">
        <button
          type="button"
          onClick={() => console.log("Assign button clicked!")}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          Assign
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default AssignScenarios;