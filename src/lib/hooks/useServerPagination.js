import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { getAuthHeaders } from "../utils.js";
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
export function useServerPagination(url, { params = {}, pageSize = 10, sortConfig = null, mapItem } = {}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    axios
      .get(url, {
        ...getAuthHeaders(),
        params: {
          ...JSON.parse(filtersKey),
          ...(debouncedSearch && { searchTerm: debouncedSearch }),
          ...(sortConfig && { sortBy: sortConfig.key, sortDir: sortConfig.direction }),
          page: currentPage,
          limit: pageSize,
        },
      })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = mapRef.current ? data.items.map(mapRef.current) : data.items;
        setItems(rows);
        setTotalItems(data.total);
        setTotalPages(data.totalPages);
        // A delete can empty the last page; step back rather than show nothing.
        if (rows.length === 0 && currentPage > 1 && currentPage > data.totalPages) {
          setCurrentPage(data.totalPages);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || "Failed to load data.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // sortConfig is covered by sortKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, filtersKey, debouncedSearch, sortKey, currentPage, pageSize, reloadKey]);

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
    refetch: useCallback(() => setReloadKey((k) => k + 1), []),
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage: pageSize,
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
