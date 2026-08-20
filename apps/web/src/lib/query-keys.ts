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
  fileUrl: (fileId: string, version?: number) =>
    version === undefined
      ? (["file-url", fileId] as const)
      : (["file-url", fileId, version] as const),
  fileVersions: (fileId: string) => ["file-versions", fileId] as const,
  search: (query: string) => ["search", query] as const,
  shares: (nodeId: string) => ["shares", nodeId] as const,
  sharedWithMe: ["shared-with-me"] as const,

  /** Share-link views. Keyed by token so two open links never share a cache. */
  publicShare: (token: string) => ["public", token] as const,
  publicChildren: (token: string, nodeId: string) =>
    ["public", token, "children", nodeId] as const,
  publicBreadcrumbs: (token: string, nodeId: string) =>
    ["public", token, "breadcrumbs", nodeId] as const,
  publicFileUrl: (token: string, fileId: string) =>
    ["public", token, "file-url", fileId] as const,
};
