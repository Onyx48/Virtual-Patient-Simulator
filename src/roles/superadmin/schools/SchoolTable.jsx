import React from "react";
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";

/**
 * Clickable invite state. "Pending" means the org admin has never been sent
 * credentials; "Invited" means they have. Clicking either one generates a fresh
 * password and mails it — a re-send is a rotation, not a copy of the old one,
 * because stored passwords are hashes.
 */
function InviteStatusBadge({ school, onClick, isSending, disabled }) {
  const invited = school.inviteStatus === "invited";
  const sentAt = school.inviteSentAt
    ? format(new Date(school.inviteSentAt), "dd MMM, yyyy 'at' HH:mm")
    : null;

  const title = disabled
    ? invited
      ? `Invited${sentAt ? ` on ${sentAt}` : ""}`
      : "No invite sent yet"
    : invited
      ? `Invited${sentAt ? ` on ${sentAt}` : ""} — click to send a new password`
      : "Click to send login credentials";

  if (isSending) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <span className="h-3 w-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
        Sending…
      </span>
    );
  }

  const palette = invited
    ? "bg-green-100 text-green-700 ring-green-200"
    : "bg-amber-100 text-amber-700 ring-amber-200";
  const interactive = disabled
    ? "cursor-default"
    : "cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400";

  return (
    <button
      type="button"
      onClick={disabled ? undefined : () => onClick?.(school)}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${palette} ${interactive}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${invited ? "bg-green-500" : "bg-amber-500"}`}
      />
      {invited ? "Invited" : "Pending"}
    </button>
  );
}

function SchoolTable({
  data,
  onEditClick,
  onDeleteClick,
  onSort,
  canEdit,
  isDeletingId,
  onInviteClick,
  isInvitingId,
}) {
  const handleSort = (key) => {
    if (onSort) onSort(key);
  };

  const SortIcon = () => (
    <ArrowsUpDownIcon className="h-4 w-4 inline-block ml-1 text-gray-400" />
  );

  return (
    <div className="bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("schoolName")}
              >
                School Name <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("email")}
              >
                Email <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("description")}
              >
                Description <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("status")}
              >
                Subscription <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("expireDate")}
              >
                Expire <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("timeSpent")}
              >
                Time Spent <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
              >
                Assigned Admin
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group select-none"
                onClick={() => handleSort("inviteStatus")}
              >
                Status <SortIcon />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((school) => (
                <tr
                  key={school._id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {school.schoolName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {school.email}
                  </td>
                  <td
                    className="px-6 py-4 text-sm text-gray-500 max-w-md truncate"
                    title={school.description}
                  >
                    {school.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {school.status === "Active" ? (
                      <span className="text-gray-900 font-medium">
                        Active{" "}
                        <span className="text-gray-500 font-normal">
                          ({school.duration || "1 Year"})
                        </span>
                      </span>
                    ) : (
                      <span className="text-red-500 font-medium">
                        {school.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {school.expireDate
                      ? format(new Date(school.expireDate), "dd MMM, yyyy")
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {school.timeSpent || "0h"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {school.assignedAdmin?.id
                      ? school.assignedAdmin.name
                      : "Unassigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <InviteStatusBadge
                      school={school}
                      onClick={onInviteClick}
                      isSending={isInvitingId === school._id}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          onClick={() => onEditClick(school)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {canEdit && onDeleteClick && (
                        <button
                          onClick={() => onDeleteClick(school._id)}
                          disabled={isDeletingId === school._id}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeletingId === school._id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="9"
                  className="px-6 py-10 text-center text-sm text-gray-500"
                >
                  No schools found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


    </div>
  );
}

export default SchoolTable;
