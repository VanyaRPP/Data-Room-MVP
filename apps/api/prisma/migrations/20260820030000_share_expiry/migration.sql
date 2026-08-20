-- A share link can now be given an end date. Null means it lasts until the
-- owner revokes it, which is what every existing link was, so no backfill.
ALTER TABLE "Share" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Supports the owner's "everything I have shared" listing, which pages by
-- creation time.
CREATE INDEX "Share_createdById_createdAt_idx" ON "Share" ("createdById", "createdAt");
