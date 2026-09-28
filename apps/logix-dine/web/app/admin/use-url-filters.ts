"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getFilter = useCallback(
    (key: string, defaultValue = ""): string => {
      return searchParams.get(key) ?? defaultValue;
    },
    [searchParams]
  );

  const setFilters = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const currentSearch = typeof window !== "undefined" ? window.location.search : searchParams.toString();
      const params = new URLSearchParams(currentSearch);
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== null && value.trim() !== "" && value !== "ALL") {
          params.set(key, value.trim());
        } else {
          params.delete(key);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const setFilter = useCallback(
    (key: string, value: string | null | undefined) => {
      setFilters({ [key]: value });
    },
    [setFilters]
  );

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  const hasActiveFilters = Array.from(searchParams.keys()).length > 0;

  return {
    getFilter,
    setFilter,
    setFilters,
    clearFilters,
    hasActiveFilters,
    searchParams,
  };
}
