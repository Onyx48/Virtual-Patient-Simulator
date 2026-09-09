/*
 * The GET /api/students response is cached for two minutes under a key chosen
 * by the caller's scope. Anything that creates, edits, moves or deletes a
 * student has to clear those keys, or an educator adds a student and is told
 * for two minutes that they do not exist.
 *
 * This lives in its own module because the write paths are spread across
 * routes/users.js, routes/students.js and the bulk importer. When each one
 * kept its own copy of the key format, users.js cleared `users:*` and silently
 * left `students:*` stale — which is exactly the bug this file exists to stop
 * recurring. Add a new way to create a student and you must call this too.
 */
import redisClient from "./redisClient.js";

const isRedisReady = () => redisClient && redisClient.status === "ready";

const id = (value) => (value?._id ?? value)?.toString();

export const studentsCacheKey = (scope = {}) => {
  if (scope.educatorId) return `students:educator:${id(scope.educatorId)}`;
  if (scope.schoolId) return `students:school:${id(scope.schoolId)}`;
  return "students:all";
};

/**
 * Clear every cached student list a change could have affected.
 *
 * `educatorIds` takes more than one on purpose: reassigning a student to a
 * different supervisor invalidates the old educator's list as well as the new
 * one, and clearing only the new one leaves the previous educator still
 * showing a student who has moved away.
 */
export const invalidateStudentsCache = async ({
  schoolId,
  educatorId,
  educatorIds = [],
} = {}) => {
  if (!isRedisReady()) return;

  const keys = new Set(["students:all"]);
  if (schoolId) keys.add(`students:school:${id(schoolId)}`);
  // `educatorId` singular is accepted so a `req.scope` can be passed straight in.
  for (const owner of [educatorIds, educatorId].flat()) {
    if (owner) keys.add(`students:educator:${id(owner)}`);
  }

  try {
    await Promise.all([...keys].map((key) => redisClient.del(key)));
  } catch (err) {
    // A failed purge only means a list stays stale until its TTL expires, so
    // it must not fail the write that succeeded.
    console.error("Redis students cache invalidation error:", err.message);
  }
};
