import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  VIEW_URL_TTL_SECONDS,
  type BreadcrumbDto,
  type FileUrlDto,
  type NodePage,
  type PublicShareDto,
} from "@dataroom/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * Share links can die between one request and the next - revoked, or the item
 * deleted - and the API answers 410 for all of it. The query client already
 * declines to retry 4xx, so this is only about recognising the case.
 */
export function isGone(error: unknown): boolean {
  return error instanceof ApiError && error.gone;
}

export function usePublicShare(token: string) {
  return useQuery({
    queryKey: queryKeys.publicShare(token),
    queryFn: () => apiFetch<PublicShareDto>(`/public/${token}`),
  });
}

export function usePublicChildren(token: string, nodeId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.publicChildren(token, nodeId ?? ""),
    queryFn: ({ pageParam }) => {
      const query = pageParam
        ? `?${new URLSearchParams({ cursor: pageParam }).toString()}`
        : "";
      return apiFetch<NodePage>(
        `/public/${token}/nodes/${nodeId}/children${query}`,
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: NodePage) => lastPage.nextCursor,
    enabled: nodeId !== undefined,
  });
}

export function usePublicBreadcrumbs(token: string, nodeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicBreadcrumbs(token, nodeId ?? ""),
    queryFn: () =>
      apiFetch<BreadcrumbDto[]>(`/public/${token}/nodes/${nodeId}/breadcrumbs`),
    enabled: nodeId !== undefined,
  });
}

export function usePublicFileUrl(token: string, fileId: string) {
  return useQuery({
    queryKey: queryKeys.publicFileUrl(token, fileId),
    queryFn: () => apiFetch<FileUrlDto>(`/public/${token}/files/${fileId}/url`),
    staleTime: 0,
    refetchInterval: (VIEW_URL_TTL_SECONDS - 60) * 1000,
  });
}
