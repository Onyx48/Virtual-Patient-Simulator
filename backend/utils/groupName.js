/**
 * Matching a group by the name someone typed into a spreadsheet.
 *
 * Bulk import has to find an existing group before it creates one, and it only
 * has the name to go on. That means a case-insensitive exact match — "year 2
 * group a" and "Year 2 Group A" are the same cohort to the educator who typed
 * them, and creating two groups because of a capital letter is a data mess
 * nobody would notice until a scenario was assigned to the wrong half of a class.
 */

/*
 * Regex metacharacters in the name are escaped, not stripped. Group names like
 * "Year 2 (A)", "Group [1]" or "A+B" are perfectly reasonable, and unescaped
 * they either throw on `new RegExp` or — worse — quietly match the wrong group.
 */
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A case-insensitive whole-string matcher for one group name. */
export const groupNameMatcher = (name) =>
  new RegExp(`^${escapeRegex(String(name).trim())}$`, "i");
