import { useQuery } from "@tanstack/react-query";
import type { DeletePreviewDto } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * What a delete would remove. Only fetched while the confirmation dialog is
 * open - it walks the whole subtree, so it isn't worth doing speculatively.
 */
export function useDeletePreview(nodeId: string | null) {
  return useQuery({
    queryKey: queryKeys.deletePreview(nodeId ?? ""),
    queryFn: () => apiFetch<DeletePreviewDto>(`/nodes/${nodeId}/delete-preview`),
    enabled: nodeId !== null,
    staleTime: 0,
  });
}
