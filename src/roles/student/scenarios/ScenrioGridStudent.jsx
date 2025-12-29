import React from "react";
import { Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

function ScenarioGridStudent({ data }) {
  const navigate = useNavigate();

  // Helper: Get text color based on difficulty
  const getDifficultyColor = (level) => {
    switch (level?.toLowerCase()) {
      case "high":
        return "text-red-500";
      case "medium":
        return "text-orange-500";
      case "low":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  // Helper: Render the 3-bar signal icon based on difficulty
  const getSignalIcon = (level) => {
    const colorClass = getDifficultyColor(level);
    // Convert 'text-red-500' to 'bg-red-500' for the bars
    const bgClass = (isActive) =>
      isActive ? colorClass.replace("text-", "bg-") : "bg-gray-200";

    const l = level?.toLowerCase();
    const isLow = l === "low" || l === "medium" || l === "high";
    const isMed = l === "medium" || l === "high";
    const isHigh = l === "high";

    return (
      <div className="flex items-end gap-[2px] h-3">
        <div className={`w-1 h-1.5 rounded-sm ${bgClass(isLow)}`}></div>
        <div className={`w-1 h-2.5 rounded-sm ${bgClass(isMed)}`}></div>
        <div className={`w-1 h-3.5 rounded-sm ${bgClass(isHigh)}`}></div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {data.map((scenario, index) => (
        <div
          key={scenario.id || index}
          className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow flex flex-col h-full"
        >
          {/* Header: Icon, Score, Difficulty */}
          <div className="flex justify-between items-start mb-5">
            <div className="flex items-center gap-3">
              {/* Target Icon Circle */}
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                <Target className="w-5 h-5 text-red-500" />
              </div>
              {/* Highest Score Text */}
              <div>
                <span className="block text-sm font-bold text-gray-900">
                  {scenario.highestScore || "0"}% Highest
                </span>
              </div>
            </div>

            {/* Difficulty Indicator */}
            <div className="flex items-center gap-2">
              {getSignalIcon(scenario.difficulty)}
              <span
                className={`text-xs font-bold ${getDifficultyColor(
                  scenario.difficulty
                )}`}
              >
                {scenario.difficulty}
              </span>
            </div>
          </div>

          {/* Body: Title & Description */}
          <div className="mb-8 flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
              {scenario.scenarioName}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
              {scenario.description ||
                "No description provided for this scenario."}
            </p>
          </div>

          {/* Footer: Status & Action Button */}
          <div className="mt-auto">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              {scenario.status || "AVAILABLE"}
            </p>

            {scenario.status === "Completed" ? (
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/student/scenario/${scenario.id}`)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Results
                </button>
                <button
                  // Add logic to restart scenario
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Start Again
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate(`/student/scenario/${scenario.id}`)}
                className="w-full py-3.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-800 transition-colors shadow-md"
              >
                Start Now
              </button>
            )}
          </div>
        </div>
      ))}

      {data.length === 0 && (
        <div className="col-span-full text-center py-20 text-gray-400">
          No scenarios found.
        </div>
      )}
    </div>
  );
}

export default ScenarioGridStudent;
