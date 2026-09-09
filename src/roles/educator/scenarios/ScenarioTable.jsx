import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Target, Edit, Loader2 } from "lucide-react";

// The hosted simulator the Test button opens. Baked in at build time; set
// VITE_SIMULATOR_URL in .env to point at a different deployment.
const SIMULATOR_URL =
  import.meta.env.VITE_SIMULATOR_URL ||
  "https://share.streampixel.io/6aa14ef480d62d728d8ba6e8";

function ScenarioTable({ data, onEditClick, canEdit = true }) {
  // Which card's Test button is mid-publish, so only that one shows a spinner.
  const [publishingId, setPublishingId] = useState(null);

  /*
   * The simulator has no way to be told *which* scenario to run — it reads
   * whatever GET /api/scenarios/json currently returns. So Test has to publish
   * this scenario to that endpoint and only then open the simulator, or the
   * simulator loads the previous tester's scenario.
   *
   * The blank tab is opened synchronously, before the await, because a
   * window.open() that happens after an async gap has lost the user's click
   * gesture and gets blocked as a popup.
   */
  const handleTest = async (scenario) => {
    const scenarioId = scenario._id || scenario.id;
    if (!scenarioId || publishingId) return;

    const tab = window.open("", "_blank");
    if (!tab) {
      toast.error("Allow popups for this site to test a scenario.");
      return;
    }

    setPublishingId(scenarioId);
    try {
      await axios.post("/api/scenarios/json", { scenarioId });
      tab.location = SIMULATOR_URL;
    } catch (error) {
      tab.close();
      toast.error(
        error.response?.data?.message ||
          "Could not hand this scenario to the simulator.",
      );
    } finally {
      setPublishingId(null);
    }
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case "published":
        return "text-green-500";
      case "draft":
        return "text-gray-900";
      case "archived":
        return "text-gray-400";
      default:
        return "text-gray-500";
    }
  };

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
      {data.map((scenario, index) => {
        /*
         * The description is dropped when it only repeats the title, which made
         * the card show the same line twice — once as the bold heading and again
         * underneath it. It is not a rendering bug: the AI writes the scenario
         * name into the short description, and educators do the same by hand.
         *
         * Compared loosely (case, surrounding whitespace and any stray markup),
         * because "Neck Pain - Alice" and "neck pain — alice" are the same
         * duplicate to a reader.
         */
        const normalise = (text) =>
          String(text || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

        const showDescription =
          !!scenario.description &&
          normalise(scenario.description) !== normalise(scenario.scenarioName);

        return (
          <div
            key={scenario.id || scenario._id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between h-full"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${getIconBg(
                index,
              )}`}
            >
              <Target className={`w-5 h-5 ${getIconColor(index)}`} />
            </div>

            <div className="mb-6">
              <h3 className="text-base font-bold text-gray-900 mb-2 truncate">
                {scenario.scenarioName}
              </h3>
              {/*
                No placeholder. A scenario with no description shows its title
                and nothing else — filler text pretending to be a description is
                worse than the gap.
              */}
              {showDescription && (
                <p className="text-xs text-gray-500 line-clamp-2 mb-4 h-8 leading-relaxed">
                  {scenario.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className={getStatusStyle(scenario.status)}>
                  {scenario.status || "DRAFT"}
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500">
                  {scenario.assignedTo?.length || 0} students
                </span>
                {/*
                  Group count is shown separately rather than folded into the
                  student number: expanding it would need each group's membership,
                  which this list does not fetch, and a guessed total is worse
                  than an honest breakdown.
                */}
                {scenario.assignedGroups?.length > 0 && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-orange-600">
                      {scenario.assignedGroups.length}{" "}
                      {scenario.assignedGroups.length === 1 ? "group" : "groups"}
                    </span>
                  </>
                )}
                {/*
                  Hidden at zero: a scenario nobody has run yet should say
                  nothing about sessions rather than report "0 sessions".
                */}
                {scenario.totalSessions > 0 && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500">
                      {scenario.totalSessions}{" "}
                      {scenario.totalSessions === 1 ? "session" : "sessions"}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-auto">
              {canEdit && (
                <button
                  onClick={() => onEditClick(scenario)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit className="w-3 h-3" /> Edit
                </button>
              )}
              <button
                onClick={() => handleTest(scenario)}
                disabled={publishingId === (scenario._id || scenario.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                  canEdit
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-black text-white hover:bg-gray-800 w-full"
                }`}
              >
                {publishingId === (scenario._id || scenario.id) ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Opening
                  </>
                ) : (
                  "Test"
                )}
              </button>
            </div>
          </div>
        );
      })}

      {data.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-sm">No scenarios found.</p>
        </div>
      )}
    </div>
  );
}

export default ScenarioTable;
