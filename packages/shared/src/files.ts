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

export const presignSchema = z.strictObject({
  folderId: z.uuid(),
  files: z
    .array(presignFileSchema)
    .min(1, "No files to upload")
    .max(MAX_FILES_PER_BATCH, `Upload at most ${MAX_FILES_PER_BATCH} files at a time`),
});

export type PresignInput = z.infer<typeof presignSchema>;

/**
 * One reserved upload slot. `finalName` may differ from the requested name:
 * the server resolves collisions by suffixing rather than rejecting, so a
 * batch of same-named files all land instead of failing one by one.
 */
export const presignedFileDtoSchema = z.strictObject({
  nodeId: z.uuid(),
  finalName: z.string(),
  uploadUrl: z.url(),
});

export type PresignedFileDto = z.infer<typeof presignedFileDtoSchema>;

/** A short-lived URL for viewing one file inline. */
export const fileUrlDtoSchema = z.strictObject({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});

export type FileUrlDto = z.infer<typeof fileUrlDtoSchema>;
