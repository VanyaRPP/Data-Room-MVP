import type { NodeType } from "@dataroom/shared";

/**
 * Every query key in one place, so cache invalidation after a mutation can
 * never silently miss a cache because two call sites spelled the key
 * differently.
 */
export const queryKeys = {
  me: ["me"] as const,
  rooms: ["rooms"] as const,
  /**
   * The type-filtered listing (the move dialog's folder picker) nests under
   * the unfiltered one, so invalidating `["children", id]` after a mutation
   * refreshes both by prefix match.
   */
  children: (folderId: string, type?: NodeType) =>
    type
      ? (["children", folderId, type] as const)
      : (["children", folderId] as const),
  breadcrumbs: (nodeId: string) => ["breadcrumbs", nodeId] as const,
  deletePreview: (nodeId: string) => ["delete-preview", nodeId] as const,
  fileUrl: (fileId: string) => ["file-url", fileId] as const,
};
