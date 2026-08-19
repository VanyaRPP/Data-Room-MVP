/**
 * Every query key in one place, so cache invalidation after a mutation can
 * never silently miss a cache because two call sites spelled the key
 * differently.
 */
export const queryKeys = {
  me: ["me"] as const,
  rooms: ["rooms"] as const,
  children: (folderId: string) => ["children", folderId] as const,
  breadcrumbs: (nodeId: string) => ["breadcrumbs", nodeId] as const,
  deletePreview: (nodeId: string) => ["delete-preview", nodeId] as const,
};
