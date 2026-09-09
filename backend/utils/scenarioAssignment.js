/**
 * Who a scenario is assigned to.
 *
 * A scenario carries two independent assignment lists:
 *
 *   assignedTo      individual students, picked one by one
 *   assignedGroups  whole groups — every current member counts as assigned
 *
 * They are unioned wherever the question "can this student see this scenario?"
 * is asked. The alternative — expanding a group into `assignedTo` when it is
 * assigned — was rejected: once expanded there is no way to tell a member from
 * an individually picked student, so removing a group would also strip students
 * who had been assigned directly, and a student joining the group later would
 * get nothing. Unioning at read time has neither problem and needs no hooks on
 * group membership changes.
 *
 * Every read site must go through this module. A missed one does not throw — it
 * silently denies a student a scenario they were assigned, which is the kind of
 * bug that surfaces as "the platform lost my homework".
 */
import User from "../models/userModel.js";

/**
 * Mongo condition matching the scenarios assigned to one student.
 *
 * Returned as an `$and`-safe object rather than a bare `$or`, because callers
 * merge it into a query that may already use `$or` for a text search — assigning
 * to `query.$or` there would silently drop the search.
 *
 * @param {{_id: any, groupId?: any}} user
 */
export const assignedToStudentQuery = (user) => {
  const clauses = [{ assignedTo: user._id }];
  // A student belongs to at most one group (User.groupId), so this is one clause.
  if (user.groupId) clauses.push({ assignedGroups: user.groupId });
  return { $or: clauses };
};

/** Merge the student condition into an existing query without clobbering `$or`. */
export const withStudentScope = (query, user) => {
  const scoped = { ...query };
  scoped.$and = [...(scoped.$and || []), assignedToStudentQuery(user)];
  return scoped;
};

const sameId = (a, b) => a && b && a.toString() === b.toString();

/**
 * Whether one already-fetched scenario is assigned to one student.
 *
 * For the in-memory checks — an access gate on a document that has already been
 * loaded — where running another query would be wasteful.
 */
export const isAssignedToStudent = (scenario, user) => {
  const individually = (scenario.assignedTo || []).some((entry) =>
    // Populated (`{_id, name}`) or a bare id, depending on the caller.
    sameId(entry?._id || entry, user._id),
  );
  if (individually) return true;

  if (!user.groupId) return false;
  return (scenario.assignedGroups || []).some((entry) =>
    sameId(entry?._id || entry, user.groupId),
  );
};

/**
 * Distinct student ids per scenario, counting group members.
 *
 * Batched over every scenario at once: group membership is one query for the
 * whole set rather than one per scenario, which matters on the educator
 * dashboard where this runs across a full scenario list.
 *
 * @param   {Array} scenarios  documents holding assignedTo and assignedGroups
 * @returns {Promise<Map<string, Set<string>>>}  scenario id -> student ids
 */
export const assignedStudentIdsByScenario = async (scenarios) => {
  const groupIds = new Set();
  scenarios.forEach((scenario) =>
    (scenario.assignedGroups || []).forEach((g) =>
      groupIds.add((g?._id || g).toString()),
    ),
  );

  const membersByGroup = new Map();
  if (groupIds.size > 0) {
    const members = await User.find({
      role: "student",
      groupId: { $in: [...groupIds] },
    })
      .select("_id groupId")
      .lean();

    members.forEach((member) => {
      const key = member.groupId.toString();
      if (!membersByGroup.has(key)) membersByGroup.set(key, []);
      membersByGroup.get(key).push(member._id.toString());
    });
  }

  const result = new Map();
  scenarios.forEach((scenario) => {
    // A Set, so a student who is both in an assigned group and picked
    // individually is counted once.
    const ids = new Set(
      (scenario.assignedTo || []).map((entry) => (entry?._id || entry).toString()),
    );
    (scenario.assignedGroups || []).forEach((g) => {
      (membersByGroup.get((g?._id || g).toString()) || []).forEach((id) => ids.add(id));
    });
    result.set(scenario._id.toString(), ids);
  });

  return result;
};
