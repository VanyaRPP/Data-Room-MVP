import { useInfiniteQuery } from "@tanstack/react-query";
import type { SearchPage } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useSearch(query: string, limit?: number) {
  const trimmed = query.trim();

  return useInfiniteQuery({
    queryKey: queryKeys.search(trimmed, limit),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ q: trimmed });
      if (pageParam) params.set("cursor", pageParam);
      if (limit !== undefined) params.set("limit", String(limit));
      return apiFetch<SearchPage>(`/search?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: SearchPage) => lastPage.nextCursor,
    enabled: trimmed.length > 0,
  });
}
