import { z } from "zod";
import { paginationQuerySchema } from "./common";
import { nodeDtoSchema } from "./nodes";

export const SEARCH_QUERY_MAX_LENGTH = 255;

export const searchQuerySchema = paginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .min(1, "Enter something to search for")
    .max(SEARCH_QUERY_MAX_LENGTH),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchResultSchema = z.strictObject({
  node: nodeDtoSchema,
  /**
   * The folders above this result, outermost first. Two files can share a
   * name, so the path is what tells them apart in a flat result list.
   */
  path: z.array(z.string()),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchPageSchema = z.strictObject({
  items: z.array(searchResultSchema),
  nextCursor: z.string().nullable(),
});

export type SearchPage = z.infer<typeof searchPageSchema>;
