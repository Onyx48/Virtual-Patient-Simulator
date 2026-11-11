import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet, who } from "../query";
import { buildPageNumbers } from "./usePagination";

/**
 * Server-side counterpart of usePagination: fetches one page at a time from a
 * list endpoint that understands `?page=&limit=&sortBy=&sortDir=` (see
 * backend/utils/pagination.js) and returns the same fields usePagination does,
 * so PaginationBar is wired up identically.
 *
 * `params` holds the search/filter values; a change to them returns to page 1.
 * `searchTerm` inside params is debounced so typing does not fire a request per
 * keystroke. Pass `mapItem` to reshape each row as it arrives.
 */
import { snapSize, PAGE_SIZES } from "./usePagedRows";

export function useServerPagination(url, { params = {}, pageSize: askedSize = 10, sortConfig = null, mapItem } = {}) {
  const [pageSize, setPageSize] = useState(() => snapSize(askedSize));
  useEffect(() => { setPageSize(snapSize(askedSize)); }, [askedSize]);
  const [currentPage, setCurrentPage] = useState(1);

  const [debouncedSearch, setDebouncedSearch] = useState(params.searchTerm || "");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(params.searchTerm || ""), 300);
    return () => clearTimeout(t);
  }, [params.searchTerm]);

  // Stable key for the non-search params, so an inline object literal from the
  // caller does not refetch on every render.
  const { searchTerm: _ignored, ...filters } = params;
  const filtersKey = JSON.stringify(filters);
  const sortKey = sortConfig ? `${sortConfig.key}:${sortConfig.direction}` : "";

  // Filters, search or sort changing sends the table back to the first page.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setCurrentPage(1);
  }, [filtersKey, debouncedSearch, sortKey, pageSize]);

  const mapRef = useRef(mapItem);
  mapRef.current = mapItem;

  // TanStack Query: each page is cached by its key; the previous page stays on screen while the
  // next one loads (keepPreviousData), and coming back to a page within 30 s needs no request.
  const query = useQuery({
    queryKey: [who(), url, filtersKey, debouncedSearch, sortKey, currentPage, pageSize],
    queryFn: ({ signal }) => apiGet(url, {
      ...JSON.parse(filtersKey),
      ...(debouncedSearch && { searchTerm: debouncedSearch }),
      ...(sortConfig && { sortBy: sortConfig.key, sortDir: sortConfig.direction }),
      page: currentPage,
      limit: pageSize,
    }, signal),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const mapped = useMemo(() => (data ? (mapRef.current ? data.items.map(mapRef.current) : data.items) : []), [data]);
  // Callers edit rows in place after a save (setPaginatedData); that wins until the next response.
  const [override, setOverride] = useState(null);
  useEffect(() => { setOverride(null); }, [data]);
  const items = override ?? mapped;
  const setItems = useCallback((v) => setOverride((cur) => (typeof v === "function" ? v(cur ?? mapped) : v)), [mapped]);
  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isLoading = query.isFetching;
  const hasLoaded = query.data !== undefined || query.isError;
  const error = query.isError ? (query.error?.response?.data?.message || "Failed to load data.") : null;
  // A delete can empty the last page; step back rather than show nothing.
  useEffect(() => {
    if (data && !query.isPlaceholderData && data.items.length === 0 && currentPage > 1 && currentPage > data.totalPages) setCurrentPage(Math.max(1, data.totalPages));
  }, [data, currentPage, query.isPlaceholderData]);
  const refetchQuery = query.refetch;

  const handlePageChange = useCallback(
    (page) => setCurrentPage(Math.min(Math.max(1, page), totalPages)),
    [totalPages],
  );

  return {
    paginatedData: items,
    setPaginatedData: setItems,
    isLoading,
    // True only before the first response — for a full-page spinner that must
    // not replace the page (and its search box) on every later page change.
    isInitialLoading: isLoading && !hasLoaded,
    error,
    refetch: useCallback(() => { refetchQuery(); }, [refetchQuery]),
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage: pageSize,
    setPageSize,
    // Spread into vx <Pagination {...pager} />
    pager: { page: currentPage, pageSize, total: totalItems, onPage: (p) => setCurrentPage(Math.max(1, p)), onPageSize: setPageSize, sizes: PAGE_SIZES },
    pageNumbers: buildPageNumbers(currentPage, totalPages),
    handlePageChange,
    nextPage: () => handlePageChange(currentPage + 1),
    prevPage: () => handlePageChange(currentPage - 1),
    resetPage: () => setCurrentPage(1),
    isFirstPage: currentPage <= 1,
    isLastPage: currentPage >= totalPages,
    hasData: totalItems > 0,
    rangeStart: totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1,
    rangeEnd: Math.min(currentPage * pageSize, totalItems),
  };
}
