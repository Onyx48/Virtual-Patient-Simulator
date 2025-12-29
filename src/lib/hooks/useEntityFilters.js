// src/lib/hooks/useEntityFilters.js
import { useMemo } from 'react';

export function useEntityFilters(data, searchTerm, filterCriteria, searchFields = []) {
  return useMemo(() => {
    let filtered = data;

    // Search filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter((item) =>
        searchFields.some((field) =>
          item[field]?.toLowerCase().includes(lowerCaseSearchTerm)
        )
      );
    }

    // Additional filters
    const hasActiveFilters = Object.values(filterCriteria).some(
      (value) => value !== "" && value !== null && value !== undefined
    );
    if (hasActiveFilters) {
      filtered = filtered.filter((item) => {
        return Object.entries(filterCriteria).every(([key, value]) => {
          if (!value) return true;
          return item[key]?.toLowerCase().includes(value.toLowerCase());
        });
      });
    }

    return filtered;
  }, [data, searchTerm, filterCriteria, searchFields]);
}