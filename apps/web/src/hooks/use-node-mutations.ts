import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  CreateFolderInput,
  MoveNodeInput,
  NodeDto,
  NodePage,
} from "@dataroom/shared";
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
      // Every sorted or filtered view of this folder is a separate cache
      // entry; updating only the default one would leave the view the user is
      // actually looking at unchanged.
      const previous = queryClient.getQueriesData<ChildrenCache>({ queryKey });

      queryClient.setQueriesData<ChildrenCache>({ queryKey }, (cache) =>
        mapCachedItems(cache, (items) =>
          items.map((item) =>
            item.id === nodeId ? { ...item, name } : item,
          ),
        ),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
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

export interface MoveVariables extends MoveNodeInput {
  nodeIds: string[];
}

/**
 * Moves one or more items into another folder.
 *
 * One item or twenty go through the same batch endpoint, and therefore the
 * same transaction: a refused move leaves the whole selection where it was,
 * which is what makes the optimistic removal below safe to roll back whole.
 */
export function useMoveNodes(folderId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.children(folderId);

  return useMutation({
    mutationFn: (body: MoveVariables) =>
      apiFetch<NodeDto[]>("/nodes/move", { method: "POST", body }),
    onMutate: async ({ nodeIds }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot(queryClient, queryKey);

      // They are leaving this folder, so drop them here right away; a rejected
      // move - a name clash in the target - puts them back.
      dropFromCaches(queryClient, queryKey, nodeIds);

      return { previous };
    },
    onError: (_error, _variables, context) => {
      restore(queryClient, context?.previous);
    },
    onSettled: (_data, _error, { nodeIds, targetFolderId }) => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.children(targetFolderId),
      });
      for (const nodeId of nodeIds) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.breadcrumbs(nodeId),
        });
      }
    },
  });
}

export function useDeleteNodes(folderId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.children(folderId);

  return useMutation({
    mutationFn: (nodeIds: string[]) =>
      apiFetch<void>("/nodes/delete", { method: "POST", body: { nodeIds } }),
    onMutate: async (nodeIds) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot(queryClient, queryKey);

      dropFromCaches(queryClient, queryKey, nodeIds);

      return { previous };
    },
    onError: (_error, _nodeIds, context) => {
      restore(queryClient, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      // Every preview counted rows that may no longer exist, and one covering
      // a different selection can still overlap what was just deleted.
      queryClient.removeQueries({ queryKey: queryKeys.deletePreviews });
    },
  });
}

type CacheSnapshot = ReturnType<QueryClient["getQueriesData"]>;

/**
 * Every sorted or filtered view of a folder is a separate cache entry, and
 * they all nest under the plain key. Touching only the default one would leave
 * the view the user is actually looking at unchanged.
 */
function snapshot(client: QueryClient, queryKey: readonly unknown[]) {
  return client.getQueriesData<ChildrenCache>({ queryKey });
}

function dropFromCaches(
  client: QueryClient,
  queryKey: readonly unknown[],
  nodeIds: string[],
): void {
  const leaving = new Set(nodeIds);

  client.setQueriesData<ChildrenCache>({ queryKey }, (cache) =>
    mapCachedItems(cache, (items) =>
      items.filter((item) => !leaving.has(item.id)),
    ),
  );
}

function restore(client: QueryClient, previous: CacheSnapshot | undefined) {
  for (const [key, data] of previous ?? []) {
    client.setQueryData(key, data);
  }
}
