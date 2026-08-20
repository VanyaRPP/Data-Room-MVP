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

/**
 * How long a visitor may keep reading after access ends. Short enough that
 * revoking means something, long enough that an open tab is not a load
 * generator.
 */
const SHARE_POLL_MS = 30_000;

/**
 * Resolves the link, and keeps asking.
 *
 * Access can be taken away while someone is looking - revoked, expired, or the
 * folder deleted out from under them - and every other query here only finds
 * out when the visitor happens to act. This is the cheapest thing on the page
 * (one row by token), so it is the one that polls, and every public view is
 * built on top of it: when this turns 410 the frame swaps in the closed-link
 * screen wherever the visitor happens to be.
 */
export function usePublicShare(token: string) {
  return useQuery({
    queryKey: queryKeys.publicShare(token),
    queryFn: () => apiFetch<PublicShareDto>(`/public/${token}`),
    refetchInterval: SHARE_POLL_MS,
    // Otherwise a link left open in a background tab stays open indefinitely.
    refetchIntervalInBackground: true,
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
