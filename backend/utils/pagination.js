/**
 * Server-side pagination for the list endpoints.
 *
 * Opt-in: a request without `?page=` gets the old bare array, because the
 * dashboards and assignment modals still compute their totals from the full
 * list. A request with `?page=` gets one page plus the counts the table footer
 * needs:
 *
 *   { items, total, page, limit, totalPages }
 *
 * Sorting is whitelisted per route (`sortFields` maps the column key the table
 * sends to the field it sorts on), so a client cannot sort on an unindexed or
 * private field.
 */

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

/**
 * @param {object} query       req.query
 * @param {object} sortFields  column key -> Mongo field
 * @param {object} defaultSort Mongo sort used when no valid sortBy is given
 * @returns {null | {page, limit, skip, sort}}  null when not paginating
 */
export const parsePagination = (query, sortFields = {}, defaultSort = { createdAt: -1 }) => {
  if (query.page === undefined) return null;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));

  const field = sortFields[query.sortBy];
  const sort = field
    ? // _id as a tiebreaker keeps page boundaries stable when values repeat.
      { [field]: query.sortDir === "desc" ? -1 : 1, _id: 1 }
    : { ...defaultSort, _id: 1 };

  return { page, limit, skip: (page - 1) * limit, sort };
};

export const pageResponse = (items, total, { page, limit }) => ({
  items,
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Escape user input before building a RegExp from it. */
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
