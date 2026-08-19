import { useInfiniteQuery } from "@tanstack/react-query";
import type { NodePage, NodeType } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

interface UseChildrenOptions {
  /** Narrows the listing to one node type, for the move dialog's folder picker. */
  type?: NodeType;
  /** Off until a tree node is expanded, so the picker fetches only what is opened. */
  enabled?: boolean;
}

/**
 * A folder's contents, one keyset-paginated page at a time. The cursor is
 * opaque: the server hands one back and it goes straight into the next
 * request untouched.
 */
export function useChildren(
  folderId: string,
  { type, enabled = true }: UseChildrenOptions = {},
) {
  return useInfiniteQuery({
    queryKey: queryKeys.children(folderId, type),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      if (type) params.set("type", type);

      const query = params.size > 0 ? `?${params.toString()}` : "";
      return apiFetch<NodePage>(`/nodes/${folderId}/children${query}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: NodePage) => lastPage.nextCursor,
    enabled,
  });
}
