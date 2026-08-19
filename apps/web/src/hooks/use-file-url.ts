import { useQuery } from "@tanstack/react-query";
import { VIEW_URL_TTL_SECONDS, type FileUrlDto } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * A signed URL for viewing one file. Short-lived by design, so it is never
 * served from a stale cache and is refreshed a little before it expires.
 */
export function useFileUrl(fileId: string) {
  return useQuery({
    queryKey: queryKeys.fileUrl(fileId),
    queryFn: () => apiFetch<FileUrlDto>(`/files/${fileId}/url`),
    staleTime: 0,
    refetchInterval: (VIEW_URL_TTL_SECONDS - 60) * 1000,
  });
}
