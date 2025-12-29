// src/lib/hooks/usePagination.js
import { useState, useMemo } from 'react';

export function usePagination(data, itemsPerPage = 5) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    handlePageChange,
  };
}