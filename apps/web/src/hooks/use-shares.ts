import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateShareInput,
  ShareDto,
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

export function useRevokeShare(nodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareId: string) =>
      apiFetch<void>(`/shares/${shareId}/revoke`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shares(nodeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sharedWithMe });
    },
  });
}

export function useSharedWithMe() {
  return useQuery({
    queryKey: queryKeys.sharedWithMe,
    queryFn: () => apiFetch<SharedWithMeItem[]>("/shared-with-me"),
  });
}
