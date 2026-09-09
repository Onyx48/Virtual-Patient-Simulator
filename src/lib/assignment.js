/**
 * Client-side mirror of backend/utils/scenarioAssignment.js.
 *
 * A scenario reaches a student either individually (`assignedTo`) or through
 * their group (`assignedGroups`). GET /api/scenarios already scopes its result
 * for a student, so these checks are a second line of defence rather than the
 * filter that matters — but they have to agree with the server, or a
 * group-assigned scenario arrives and is then thrown away by the UI.
 */
const idOf = (entry) => (entry?._id ?? entry)?.toString();

export const isAssignedToStudent = (scenario, user) => {
  if (!scenario || !user) return false;

  if ((scenario.assignedTo || []).some((a) => idOf(a) === idOf(user._id))) {
    return true;
  }

  const assignedGroups = scenario.assignedGroups || [];
  if (assignedGroups.length === 0) return false;

  /*
   * `groupId` was added to the login response alongside group assignment, so a
   * student who logged in before that deploy has a cached user object without it
   * — AuthContext trusts localStorage and never revalidates. Treating that as
   * "not in the group" would hide scenarios they really do have.
   *
   * The server has already filtered this list down to what this student may see,
   * so when the group is unknown the server's judgement is taken. Once they log
   * in again the check below applies properly.
   */
  if (user.groupId === undefined) return true;

  const studentGroupId = idOf(user.groupId);
  if (!studentGroupId) return false;
  return assignedGroups.some((g) => idOf(g) === studentGroupId);
};
