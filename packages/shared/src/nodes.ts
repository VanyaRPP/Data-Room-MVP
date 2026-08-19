import { z } from "zod";
import { nodeNameSchema } from "./common";

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
