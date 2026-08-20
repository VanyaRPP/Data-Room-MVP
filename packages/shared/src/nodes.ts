import { z } from "zod";
import { nodeNameSchema, paginationQuerySchema } from "./common";
import { NODE_NAME_MAX_LENGTH } from "./constants";

export const nodeTypeSchema = z.enum(["FOLDER", "FILE"]);
export type NodeType = z.infer<typeof nodeTypeSchema>;

export const fileStatusSchema = z.enum(["UPLOADING", "READY"]);
export type FileStatus = z.infer<typeof fileStatusSchema>;

/**
 * The one node shape the API ever returns, for folders and files alike.
 *
 * `size` is a string, not a number: it is a Postgres bigint, and JSON has no
 * safe representation for one (see the API's BigIntSerializerInterceptor).
 * FILE-only fields are null on folders.
 */
export const nodeDtoSchema = z.strictObject({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  type: nodeTypeSchema,
  name: z.string(),
  size: z.string().nullable(),
  mimeType: z.string().nullable(),
  status: fileStatusSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type NodeDto = z.infer<typeof nodeDtoSchema>;

/** One page of a cursor-paginated children listing. */
export const nodePageSchema = z.strictObject({
  items: z.array(nodeDtoSchema),
  nextCursor: z.string().nullable(),
});

export type NodePage = z.infer<typeof nodePageSchema>;

/** One hop of the root-to-node path, ordered root first. */
export const breadcrumbDtoSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
});

export type BreadcrumbDto = z.infer<typeof breadcrumbDtoSchema>;

export const createFolderSchema = z.strictObject({
  parentId: z.uuid(),
  name: nodeNameSchema,
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const renameNodeSchema = z.strictObject({
  name: nodeNameSchema,
});

export type RenameNodeInput = z.infer<typeof renameNodeSchema>;

export const nodeSortSchema = z.enum(["name", "size", "updated"]);
export type NodeSort = z.infer<typeof nodeSortSchema>;

export const sortDirectionSchema = z.enum(["asc", "desc"]);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

/**
 * `type` narrows a listing to one kind of node. The folder picker in the move
 * dialog uses it so a folder full of files doesn't push its subfolders out of
 * reach behind pages of results.
 *
 * `q` narrows to names containing it, within this folder only - distinct from
 * search, which looks across the whole room.
 *
 * Folders group ahead of files whichever way the sort runs: reversing the
 * order should not shuffle folders in among the documents.
 */
export const childrenQuerySchema = paginationQuerySchema.extend({
  type: nodeTypeSchema.optional(),
  q: z.string().trim().min(1).max(NODE_NAME_MAX_LENGTH).optional(),
  sort: nodeSortSchema.default("name"),
  direction: sortDirectionSchema.default("asc"),
});

export type ChildrenQuery = z.infer<typeof childrenQuerySchema>;

export const moveNodeSchema = z.strictObject({
  targetFolderId: z.uuid(),
  /**
   * What to do when the target already holds something by this name: refuse
   * (the default, so the user decides) or keep both by auto-suffixing.
   */
  onConflict: z.enum(["fail", "rename"]).default("fail"),
});

export type MoveNodeInput = z.infer<typeof moveNodeSchema>;

/**
 * What a delete would remove, counted over the whole subtree including the
 * node itself, so the confirmation dialog can state real numbers.
 */
export const deletePreviewDtoSchema = z.strictObject({
  folders: z.number().int().nonnegative(),
  files: z.number().int().nonnegative(),
  totalSize: z.string(),
});

export type DeletePreviewDto = z.infer<typeof deletePreviewDtoSchema>;

export const roomDtoSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  rootNodeId: z.uuid(),
});

export type RoomDto = z.infer<typeof roomDtoSchema>;
