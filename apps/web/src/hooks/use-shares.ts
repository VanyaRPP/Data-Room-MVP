import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateShareInput,
  ShareDto,
  SharedByMeItem,
  SharedWithMeItem,
} from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/** Active shares on a node, for its owner. */
export function useShares(nodeId: string | null) {
  return useQuery({
    queryKey: queryKeys.shares(nodeId ?? ""),
    queryFn: () =>
      apiFetch<ShareDto[]>(
        `/shares?${new URLSearchParams({ nodeId: nodeId ?? "" }).toString()}`,
      ),
    enabled: nodeId !== null,
  });
}

export function useCreateShare(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateShareInput) =>
      apiFetch<ShareDto>("/shares", { method: "POST", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shares(nodeId) });
    },
  });
}

/**
 * `nodeId` is what to refresh afterwards. The share dialog passes the node it
 * is open on; the "Shared by me" page has no single node in view, so it passes
 * null and relies on the two list queries below.
 */
export function useRevokeShare(nodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareId: string) =>
      apiFetch<void>(`/shares/${shareId}/revoke`, { method: "POST" }),
    onSuccess: () => {
      if (nodeId !== null) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.shares(nodeId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.sharedWithMe });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sharedByMe });
    },
  });
}

export function useSharedWithMe() {
  return useQuery({
    queryKey: queryKeys.sharedWithMe,
    queryFn: () => apiFetch<SharedWithMeItem[]>("/shared-with-me"),
  });
}

/** Every live link this user has handed out. */
export function useSharedByMe() {
  return useQuery({
    queryKey: queryKeys.sharedByMe,
    queryFn: () => apiFetch<SharedByMeItem[]>("/shared-by-me"),
  });
}
