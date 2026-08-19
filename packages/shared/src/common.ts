import { z } from "zod";
import { NODE_NAME_MAX_LENGTH, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from "./constants";

/**
 * Shared name validation for folders and files: non-empty, bounded length,
 * no path separators, and not a relative-path token ("." / "..").
 */
export const nodeNameSchema = z
  .string()
  .trim()
  .min(1, "Name cannot be empty")
  .max(NODE_NAME_MAX_LENGTH, `Name must be ${NODE_NAME_MAX_LENGTH} characters or fewer`)
  .refine((value) => !value.includes("/") && !value.includes("\\"), {
    message: "Name cannot contain '/' or '\\'",
  })
  .refine((value) => value !== "." && value !== "..", {
    message: "Name cannot be '.' or '..'",
  });

/** Opaque cursor: consumers must not parse its contents, only pass it back. */
export const cursorSchema = z.string().min(1).optional();

export const paginationQuerySchema = z.strictObject({
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Unified API error shape returned by every non-2xx response. */
export const apiErrorShape = z.strictObject({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

export type ApiErrorShape = z.infer<typeof apiErrorShape>;
