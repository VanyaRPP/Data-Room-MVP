import { z } from "zod";
import { nodeDtoSchema } from "./nodes";

export const shareModeSchema = z.enum(["PUBLIC", "RESTRICTED"]);
export type ShareMode = z.infer<typeof shareModeSchema>;

/**
 * Only VIEWER is implemented. The enum exists so adding EDITOR later is a
 * permission-map change rather than a schema migration - see the README.
 */
export const shareRoleSchema = z.enum(["VIEWER"]);
export type ShareRole = z.infer<typeof shareRoleSchema>;

export const MAX_GRANTS_PER_REQUEST = 50;

/** One recipient address, so the client can check input before sending it. */
export const shareEmailSchema = z.email("Enter a valid email address");

export const createShareSchema = z
  .strictObject({
    nodeId: z.uuid(),
    mode: shareModeSchema,
    emails: z.array(z.email()).max(MAX_GRANTS_PER_REQUEST).optional(),
  })
  .refine(
    (value) => value.mode !== "RESTRICTED" || (value.emails?.length ?? 0) > 0,
    {
      message: "Add at least one email address",
      path: ["emails"],
    },
  );

export type CreateShareInput = z.infer<typeof createShareSchema>;

export const shareGrantDtoSchema = z.strictObject({
  id: z.uuid(),
  email: z.string(),
  role: shareRoleSchema,
  /** True once someone has registered with this address. */
  claimed: z.boolean(),
});

export type ShareGrantDto = z.infer<typeof shareGrantDtoSchema>;

export const shareDtoSchema = z.strictObject({
  id: z.uuid(),
  nodeId: z.uuid(),
  mode: shareModeSchema,
  token: z.string(),
  createdAt: z.iso.datetime(),
  grants: z.array(shareGrantDtoSchema),
});

export type ShareDto = z.infer<typeof shareDtoSchema>;

export const sharesQuerySchema = z.strictObject({ nodeId: z.uuid() });
export type SharesQuery = z.infer<typeof sharesQuerySchema>;

/** An item someone else shared with the signed-in user. */
export const sharedWithMeItemSchema = z.strictObject({
  token: z.string(),
  sharedBy: z.string(),
  sharedAt: z.iso.datetime(),
  node: nodeDtoSchema,
});

export type SharedWithMeItem = z.infer<typeof sharedWithMeItemSchema>;

/**
 * What a visitor holding a share link is allowed to know about it: enough to
 * render the view, and nothing about where it sits in the owner's room.
 */
export const publicShareDtoSchema = z.strictObject({
  token: z.string(),
  mode: shareModeSchema,
  sharedBy: z.string(),
  root: nodeDtoSchema,
});

export type PublicShareDto = z.infer<typeof publicShareDtoSchema>;
