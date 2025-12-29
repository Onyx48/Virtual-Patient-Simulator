import React from "react";
import { Target, Edit, Loader2 } from "lucide-react";

function ScenarioTable({ data, onEditClick }) {
  // Helper for Status Text Colors
  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case "published":
        return "text-green-500";
      case "draft":
        return "text-gray-900"; // Black text for Draft
      case "archived":
        return "text-gray-400";
      default:
        return "text-gray-500";
    }
  };

  // Helper for Icon Colors to make the UI pop (Red, Blue, Orange, Purple cycle)
  const getIconBg = (index) => {
    const colors = ["bg-red-50", "bg-blue-50", "bg-orange-50", "bg-purple-50"];
    return colors[index % colors.length];
  };

  const getIconColor = (index) => {
    const colors = [
      "text-red-500",
      "text-blue-500",
      "text-orange-500",
      "text-purple-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {data.map((scenario, index) => (
        <div
          key={scenario.id || scenario._id}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between h-full"
        >
          {/* --- Card Header: Icon & Score --- */}
          <div className="flex justify-between items-start mb-4">
            {/* Icon */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${getIconBg(
                index
              )}`}
            >
              <Target className={`w-5 h-5 ${getIconColor(index)}`} />
            </div>

            {/* Score Indicator */}
            <div className="flex items-center gap-2">
              <div className="relative w-5 h-5 flex items-center justify-center">
                {/* Visual Mock of a loading/progress circle */}
                <Loader2 className="w-4 h-4 text-orange-400 animate-[spin_3s_linear_infinite]" />
              </div>
              <span className="text-xs font-bold text-gray-700">
                {scenario.avgScore || "4 Avg Score"}
              </span>
            </div>
          </div>

          {/* --- Card Content --- */}
          <div className="mb-6">
            <h3 className="text-base font-bold text-gray-900 mb-2 truncate">
              {scenario.scenarioName}
            </h3>
            <p className="text-xs text-gray-500 line-clamp-2 mb-4 h-8 leading-relaxed">
              {scenario.description ||
                "No description provided. Lorem ipsum dolor sit amet consectetur."}
            </p>

            {/* Status Line */}
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span className={getStatusStyle(scenario.status)}>
                {scenario.status || "DRAFT"}
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-500">
                {/* Fallback to static number if assignedTo is missing, matching screenshot style */}
                {scenario.assignedTo?.length || 23} STUDENT ACCESS
              </span>
            </div>
          </div>

          {/* --- Card Footer: Actions --- */}
          <div className="flex gap-3 mt-auto">
            <button
              onClick={() => onEditClick(scenario)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={() =>
                console.log("Test clicked for", scenario.scenarioName)
              }
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Test
            </button>
          </div>
        </div>
      ))}

      {/* --- Empty State --- */}
      {data.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-sm">No scenarios found.</p>
        </div>
      )}
    </div>
  );
}

export default ScenarioTable;
