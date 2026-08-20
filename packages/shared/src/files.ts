import { z } from "zod";
import { nodeNameSchema } from "./common";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_BATCH,
  PDF_MIME_TYPE,
} from "./constants";

export const presignFileSchema = z.strictObject({
  name: nodeNameSchema,
  size: z
    .number()
    .int()
    .positive("File is empty")
    .max(MAX_FILE_SIZE_BYTES, "Files must be 50 MB or smaller"),
  mimeType: z.literal(PDF_MIME_TYPE, "Only PDF files can be uploaded"),
});

export type PresignFileInput = z.infer<typeof presignFileSchema>;

/**
 * What to do when a name is already taken in the target folder: keep both by
 * suffixing, or replace the existing file and keep the old bytes as history.
 */
export const uploadConflictSchema = z.enum(["rename", "version"]);
export type UploadConflictStrategy = z.infer<typeof uploadConflictSchema>;

export const presignSchema = z.strictObject({
  folderId: z.uuid(),
  files: z
    .array(presignFileSchema)
    .min(1, "No files to upload")
    .max(MAX_FILES_PER_BATCH, `Upload at most ${MAX_FILES_PER_BATCH} files at a time`),
  onConflict: uploadConflictSchema.default("rename"),
});

export type PresignInput = z.infer<typeof presignSchema>;

/** Asks which of these names already exist, so the client can offer a choice. */
export const uploadConflictsSchema = z.strictObject({
  folderId: z.uuid(),
  names: z.array(z.string()).min(1).max(MAX_FILES_PER_BATCH),
});

export type UploadConflictsInput = z.infer<typeof uploadConflictsSchema>;

export const uploadConflictsDtoSchema = z.strictObject({
  /** The subset of the submitted names that a file already uses. */
  taken: z.array(z.string()),
});

export type UploadConflictsDto = z.infer<typeof uploadConflictsDtoSchema>;

export const fileVersionDtoSchema = z.strictObject({
  version: z.number().int().positive(),
  size: z.string(),
  createdAt: z.iso.datetime(),
  /** True for the version the file currently serves. */
  isCurrent: z.boolean(),
});

export type FileVersionDto = z.infer<typeof fileVersionDtoSchema>;

/**
 * One reserved upload slot. `finalName` may differ from the requested name:
 * the server resolves collisions by suffixing rather than rejecting, so a
 * batch of same-named files all land instead of failing one by one.
 */
export const presignedFileDtoSchema = z.strictObject({
  nodeId: z.uuid(),
  finalName: z.string(),
  uploadUrl: z.url(),
  /**
   * What the server did with the name, so the client can report it honestly:
   * a fresh file, one renamed around a clash, or a new version of an existing
   * file.
   */
  action: z.enum(["created", "renamed", "versioned"]),
});

export type PresignedFileDto = z.infer<typeof presignedFileDtoSchema>;

/** A short-lived URL for viewing one file inline. */
export const fileUrlDtoSchema = z.strictObject({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});

export type FileUrlDto = z.infer<typeof fileUrlDtoSchema>;

/**
 * Whether the signed URL should open the file or save it.
 *
 * The same URL either way; only the `Content-Disposition` storage attaches to
 * it differs. `stringbool` rather than a coerced boolean because a query
 * string carries `"false"`, which is truthy to anything less careful.
 */
export const fileUrlQuerySchema = z.strictObject({
  download: z.stringbool().default(false),
});

export type FileUrlQuery = z.infer<typeof fileUrlQuerySchema>;
