import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  pageNumbers,
  onPageChange,
  onPrevPage,
  onNextPage,
  isFirstPage,
  isLastPage,
  rangeStart,
  rangeEnd,
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6"
    >
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium">{rangeStart}</span> to{" "}
        <span className="font-medium">{rangeEnd}</span> of{" "}
        <span className="font-medium">{totalItems}</span> total
      </p>

      <div className="flex gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={onPrevPage}
          disabled={isFirstPage}
          aria-label="Go to previous page"
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
        </button>

        {pageNumbers.map((page, idx) =>
          page === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              aria-hidden="true"
              className="w-8 h-8 flex items-center justify-center text-sm text-gray-400"
            >
              ...
            </span>
          ) : (
            <button
              type="button"
              key={page}
              onClick={() => onPageChange(page)}
              aria-current={currentPage === page ? "page" : undefined}
              aria-label={`Go to page ${page}`}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={onNextPage}
          disabled={isLastPage}
          aria-label="Go to next page"
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRightIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </nav>
  );
}

export default PaginationBar;
