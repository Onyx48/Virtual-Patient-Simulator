import React from "react";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { format, formatDistanceToNow } from "date-fns";

const STATUS_STYLES = {
  published: "bg-green-100 text-green-700 ring-green-200",
  success: "bg-green-100 text-green-700 ring-green-200",
  draft: "bg-amber-100 text-amber-700 ring-amber-200",
  archived: "bg-gray-100 text-gray-600 ring-gray-200",
};

function StatusBadge({ status }) {
  const key = (status || "Draft").toLowerCase();
  const palette = STATUS_STYLES[key] || "bg-gray-100 text-gray-600 ring-gray-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${palette}`}
    >
      {status || "Draft"}
    </span>
  );
}

// Mongo ObjectIds are too long to read in a table. Show a short, stable handle
// and keep the full id in the tooltip for support/debugging.
const shortId = (id) => (id ? `SC${String(id).slice(-6).toUpperCase()}` : "—");

function CreatedSince({ createdAt }) {
  if (!createdAt) return <span className="text-gray-400">—</span>;
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return <span className="text-gray-400">—</span>;
  return (
    <span title={format(date, "dd MMM yyyy 'at' HH:mm")}>
      {formatDistanceToNow(date, { addSuffix: true })}
    </span>
  );
}

function ScenarioListTable({
  data,
  sortConfig,
  onSort,
  onEditClick,
  onDeleteClick,
  canManage = false,
}) {
  // Active column orange, idle columns grey — matches StudentPage.
  const getSortIcon = (key) => {
    const isActive = sortConfig && sortConfig.key === key;
    return (
      <span
        className={`ml-1 ${isActive ? "text-orange-500" : "text-gray-300"}`}
        aria-hidden="true"
      >
        {!isActive ? "↕" : sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const sortableHeader = (label, key) => (
    <th
      className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
      onClick={() => onSort?.(key)}
    >
      {label}
      {getSortIcon(key)}
    </th>
  );

  const colCount = canManage ? 7 : 6;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ID
              </th>
              {sortableHeader("Scenario Name", "scenarioName")}
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Description
              </th>
              {sortableHeader("Creator", "educator")}
              {sortableHeader("Created Since", "createdAt")}
              {sortableHeader("Status", "status")}
              {canManage && (
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No scenarios found.
                </td>
              </tr>
            ) : (
              data.map((scenario) => {
                const id = scenario._id || scenario.id;
                return (
                  <tr
                    key={id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td
                      className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500"
                      title={id}
                    >
                      {shortId(id)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                      {scenario.scenarioName || "Untitled"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                      <span className="line-clamp-2">
                        {scenario.description || (
                          <span className="text-gray-400">
                            No description
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {scenario.educator?.name || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <CreatedSince createdAt={scenario.createdAt} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <StatusBadge status={scenario.status} />
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => onEditClick?.(scenario)}
                            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteClick?.(scenario)}
                            className="flex items-center gap-1.5 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ScenarioListTable;
