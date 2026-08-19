import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type { CreateFolderInput, NodeDto, NodePage } from "@dataroom/shared";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type ChildrenCache = InfiniteData<NodePage, string | null>;

/** Applies a transform to every loaded page of a folder listing at once. */
function mapCachedItems(
  cache: ChildrenCache | undefined,
  transform: (items: NodeDto[]) => NodeDto[],
): ChildrenCache | undefined {
  if (!cache) return cache;
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      items: transform(page.items),
    })),
  };
}

/**
 * Creating a folder is not applied optimistically: the server assigns the id
 * and the row's sort position, so a placeholder would only jump around once
 * the real one arrived.
 */
export function useCreateFolder(folderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFolderInput) =>
      apiFetch<NodeDto>("/folders", { method: "POST", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.children(folderId),
      });
    },
  });
}

export interface RenameVariables {
  nodeId: string;
  name: string;
}

export function useRenameNode(folderId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.children(folderId);

  return useMutation({
    mutationFn: ({ nodeId, name }: RenameVariables) =>
      apiFetch<NodeDto>(`/nodes/${nodeId}`, {
        method: "PATCH",
        body: { name },
      }),
    onMutate: async ({ nodeId, name }) => {
      // Stop any in-flight refetch from landing after this and overwriting
      // the optimistic value with pre-rename data.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChildrenCache>(queryKey);

      queryClient.setQueryData<ChildrenCache>(queryKey, (cache) =>
        mapCachedItems(cache, (items) =>
          items.map((item) =>
            item.id === nodeId ? { ...item, name } : item,
          ),
        ),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: (_data, _error, { nodeId }) => {
      // Refetch rather than trusting the local edit: a new name usually means
      // a new sort position, which only the server's ordering knows.
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.breadcrumbs(nodeId),
      });
    },
  });
}

export function useDeleteNode(folderId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.children(folderId);

  return useMutation({
    mutationFn: (nodeId: string) =>
      apiFetch<void>(`/nodes/${nodeId}`, { method: "DELETE" }),
    onMutate: async (nodeId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChildrenCache>(queryKey);

      queryClient.setQueryData<ChildrenCache>(queryKey, (cache) =>
        mapCachedItems(cache, (items) =>
          items.filter((item) => item.id !== nodeId),
        ),
      );

      return { previous };
    },
    onError: (_error, _nodeId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: (_data, _error, nodeId) => {
      void queryClient.invalidateQueries({ queryKey });
      queryClient.removeQueries({ queryKey: queryKeys.deletePreview(nodeId) });
    },
  });
}
