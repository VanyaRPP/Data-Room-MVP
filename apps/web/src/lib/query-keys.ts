import type { NodeSort, NodeType, SortDirection } from "@dataroom/shared";

export interface ChildrenView {
  type?: NodeType;
  sort?: NodeSort;
  direction?: SortDirection;
  q?: string;
}

const DELETE_PREVIEWS = ["delete-preview"] as const;
const BREADCRUMBS = ["breadcrumbs"] as const;

/**
 * Every query key in one place, so cache invalidation after a mutation can
 * never silently miss a cache because two call sites spelled the key
 * differently.
 */
export const queryKeys = {
  me: ["me"] as const,
  rooms: ["rooms"] as const,
  /**
   * Every sorted or filtered view of a folder nests under the plain one, so
   * `["children", id]` matches all of them - which is what lets a mutation
   * invalidate, and optimistically update, every variant at once.
   */
  children: (folderId: string, view?: ChildrenView) =>
    view && Object.values(view).some((value) => value !== undefined)
      ? (["children", folderId, view] as const)
      : (["children", folderId] as const),
  breadcrumbs: (nodeId: string) => [...BREADCRUMBS, nodeId] as const,
  /** The prefix: renaming the room changes the first crumb of every trail. */
  allBreadcrumbs: BREADCRUMBS,

  /** The prefix, so a delete can clear every preview it may have invalidated. */
  deletePreviews: DELETE_PREVIEWS,
  /**
   * Sorted and joined, so the same selection picked in a different order is
   * the same cache entry rather than a second identical request.
   */
  deletePreview: (nodeIds: readonly string[]) =>
    [...DELETE_PREVIEWS, [...nodeIds].sort().join(",")] as const,
  fileUrl: (fileId: string, version?: number) =>
    version === undefined
      ? (["file-url", fileId] as const)
      : (["file-url", fileId, version] as const),
  fileVersions: (fileId: string) => ["file-versions", fileId] as const,
  search: (query: string, limit?: number) =>
    limit === undefined
      ? (["search", query] as const)
      : (["search", query, limit] as const),
  shares: (nodeId: string) => ["shares", nodeId] as const,
  sharedWithMe: ["shared-with-me"] as const,
  sharedByMe: ["shared-by-me"] as const,

  /** Share-link views. Keyed by token so two open links never share a cache. */
  publicShare: (token: string) => ["public", token] as const,
  publicChildren: (token: string, nodeId: string) =>
    ["public", token, "children", nodeId] as const,
  publicBreadcrumbs: (token: string, nodeId: string) =>
    ["public", token, "breadcrumbs", nodeId] as const,
  publicFileUrl: (token: string, fileId: string) =>
    ["public", token, "file-url", fileId] as const,
};
