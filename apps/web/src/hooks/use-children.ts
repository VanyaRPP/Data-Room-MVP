import { useInfiniteQuery } from "@tanstack/react-query";
import type { NodePage } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys, type ChildrenView } from "@/lib/query-keys";

interface UseChildrenOptions extends ChildrenView {
  /** Off until a tree node is expanded, so the picker fetches only what is opened. */
  enabled?: boolean;
}

/**
 * A folder's contents, one keyset-paginated page at a time. The cursor is
 * opaque: the server hands one back and it goes straight into the next
 * request untouched - which also means it is only valid for the sort it came
 * from, and changing the sort starts a fresh query.
 */
export function useChildren(
  folderId: string,
  { enabled = true, ...view }: UseChildrenOptions = {},
) {
  return useInfiniteQuery({
    queryKey: queryKeys.children(folderId, view),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      for (const [key, value] of Object.entries(view)) {
        if (value !== undefined) params.set(key, String(value));
      }

      const query = params.size > 0 ? `?${params.toString()}` : "";
      return apiFetch<NodePage>(`/nodes/${folderId}/children${query}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: NodePage) => lastPage.nextCursor,
    enabled,
  });
}
