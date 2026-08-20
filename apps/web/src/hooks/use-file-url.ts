import { useQuery } from "@tanstack/react-query";
import {
  VIEW_URL_TTL_SECONDS,
  type FileUrlDto,
  type FileVersionDto,
} from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * A signed URL for viewing one file, or one specific version of it.
 * Short-lived by design, so it is never served from a stale cache and is
 * refreshed a little before it expires.
 */
export function useFileUrl(fileId: string, version?: number) {
  return useQuery({
    queryKey: queryKeys.fileUrl(fileId, version),
    queryFn: () =>
      apiFetch<FileUrlDto>(
        version === undefined
          ? `/files/${fileId}/url`
          : `/files/${fileId}/versions/${version}/url`,
      ),
    staleTime: 0,
    refetchInterval: (VIEW_URL_TTL_SECONDS - 60) * 1000,
  });
}

export function useFileVersions(fileId: string) {
  return useQuery({
    queryKey: queryKeys.fileVersions(fileId),
    queryFn: () => apiFetch<FileVersionDto[]>(`/files/${fileId}/versions`),
  });
}
