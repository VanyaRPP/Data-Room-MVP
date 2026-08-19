import { useInfiniteQuery } from "@tanstack/react-query";
import type { NodePage } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * A folder's contents, one keyset-paginated page at a time. The cursor is
 * opaque: the server hands one back and it goes straight into the next
 * request untouched.
 */
export function useChildren(folderId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.children(folderId),
    queryFn: ({ pageParam }) => {
      const query = pageParam
        ? `?${new URLSearchParams({ cursor: pageParam }).toString()}`
        : "";
      return apiFetch<NodePage>(`/nodes/${folderId}/children${query}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: NodePage) => lastPage.nextCursor,
  });
}
