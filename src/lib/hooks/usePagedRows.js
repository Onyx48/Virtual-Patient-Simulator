import { useEffect, useMemo, useState } from "react";

/** Rows-per-page choices everywhere. */
export const PAGE_SIZES = [10, 20, 50, 100];
/** The nearest standard size (old callers passed 8, 15, 16, 32…). */
export const snapSize = (n) => PAGE_SIZES.reduce((b, s) => (Math.abs(s - n) < Math.abs(b - n) ? s : b), PAGE_SIZES[0]);

/**
 * Client-side paging for a list already in memory, wired to vx <Pagination>:
 *
 *   const pg = usePagedRows(rows, 16);
 *   pg.rows.map(...)                 // just this page
 *   <Pagination {...pg.bind} />
 *
 * Goes back to page 1 when the list changes length (a filter or search changed), and never
 * points past the last page.
 */
export function usePagedRows(all, initialSize = 10) {
  const sizes = PAGE_SIZES;
  const list = all || [];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => snapSize(initialSize));
  useEffect(() => { setPage(1); }, [list.length, pageSize]);
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, pages);
  const rows = useMemo(() => list.slice((current - 1) * pageSize, current * pageSize), [list, current, pageSize]);
  return {
    rows,
    page: current,
    pageSize,
    setPage,
    bind: { page: current, pageSize, total: list.length, onPage: setPage, onPageSize: setPageSize, sizes },
  };
}
