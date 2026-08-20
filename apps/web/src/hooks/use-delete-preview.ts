import { useQuery } from "@tanstack/react-query";
import type { DeletePreviewDto } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * What deleting this selection would remove. Only fetched while the
 * confirmation dialog is open - it walks every subtree involved, so it isn't
 * worth doing speculatively.
 */
export function useDeletePreview(nodeIds: string[]) {
  return useQuery({
    queryKey: queryKeys.deletePreview(nodeIds),
    queryFn: () =>
      apiFetch<DeletePreviewDto>("/nodes/delete-preview", {
        method: "POST",
        body: { nodeIds },
      }),
    enabled: nodeIds.length > 0,
    staleTime: 0,
  });
}
