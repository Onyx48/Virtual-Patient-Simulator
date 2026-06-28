import { useState, useMemo, useEffect, useCallback } from "react";

export function usePagination(data = [], initialItemsPerPage = 5) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedData = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, totalPages, itemsPerPage]);

  const handlePageChange = useCallback(
    (page) => {
      const target = Math.min(Math.max(1, page), totalPages);
      setCurrentPage(target);
    },
    [totalPages],
  );

  const nextPage = useCallback(
    () => handlePageChange(currentPage + 1),
    [currentPage, handlePageChange],
  );
  const prevPage = useCallback(
    () => handlePageChange(currentPage - 1),
    [currentPage, handlePageChange],
  );
  const goToFirstPage = useCallback(() => setCurrentPage(1), []);
  const goToLastPage = useCallback(
    () => setCurrentPage(totalPages),
    [totalPages],
  );
  const resetPage = useCallback(() => setCurrentPage(1), []);

  const handleItemsPerPageChange = useCallback(
    (newItemsPerPage) => {
      const firstVisibleIndex = (currentPage - 1) * itemsPerPage;
      const newPage = Math.floor(firstVisibleIndex / newItemsPerPage) + 1;
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(Math.max(1, newPage));
    },
    [currentPage, itemsPerPage],
  );

  const pageNumbers = useMemo(() => {
    const siblingCount = 1;
    const totalNumbersToShow = siblingCount * 2 + 5;

    if (totalPages <= totalNumbersToShow) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSibling = Math.max(currentPage - siblingCount, 1);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages);

    const showLeftEllipsis = leftSibling > 2;
    const showRightEllipsis = rightSibling < totalPages - 1;

    const pages = [];

    pages.push(1);
    if (showLeftEllipsis) pages.push("...");

    for (
      let i = Math.max(leftSibling, 2);
      i <= Math.min(rightSibling, totalPages - 1);
      i++
    ) {
      pages.push(i);
    }

    if (showRightEllipsis) pages.push("...");
    pages.push(totalPages);

    return pages;
  }, [currentPage, totalPages]);

  return {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    pageNumbers,
    handlePageChange,
    handleItemsPerPageChange,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
    resetPage,
    isFirstPage: currentPage <= 1,
    isLastPage: currentPage >= totalPages,
    hasData: totalItems > 0,

    rangeStart:
      totalItems === 0
        ? 0
        : (Math.min(currentPage, totalPages) - 1) * itemsPerPage + 1,
    rangeEnd: Math.min(currentPage * itemsPerPage, totalItems),
  };
}
