import { useInfiniteQuery } from "@tanstack/react-query";
import type { SearchPage } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useSearch(query: string) {
  const trimmed = query.trim();

  return useInfiniteQuery({
    queryKey: queryKeys.search(trimmed),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ q: trimmed });
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch<SearchPage>(`/search?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: SearchPage) => lastPage.nextCursor,
    enabled: trimmed.length > 0,
  });
}
