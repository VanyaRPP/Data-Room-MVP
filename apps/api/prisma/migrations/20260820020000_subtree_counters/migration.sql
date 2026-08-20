-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "subtreeBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "subtreeFiles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtreeFolders" INTEGER NOT NULL DEFAULT 0;

-- Backfill from what is already there, so the counters start out agreeing with
-- the recursive CTE that remains the source of truth. Every node gets the
-- totals for its descendants, excluding itself.
WITH RECURSIVE subtree AS (
  SELECT "id" AS root_id, "id" AS node_id, "type", "size", "status"
  FROM "Node"

  UNION ALL

  SELECT s.root_id, c."id", c."type", c."size", c."status"
  FROM "Node" c
  JOIN subtree s ON c."parentId" = s.node_id
),
totals AS (
  SELECT
    root_id,
    count(*) FILTER (
      WHERE node_id <> root_id AND "type" = 'FOLDER'
    ) AS folders,
    count(*) FILTER (
      WHERE node_id <> root_id AND "type" = 'FILE' AND "status" = 'READY'
    ) AS files,
    coalesce(sum("size") FILTER (
      WHERE node_id <> root_id AND "type" = 'FILE' AND "status" = 'READY'
    ), 0)::bigint AS bytes
  FROM subtree
  GROUP BY root_id
)
UPDATE "Node" n
SET "subtreeFolders" = t.folders,
    "subtreeFiles"   = t.files,
    "subtreeBytes"   = t.bytes
FROM totals t
WHERE n."id" = t.root_id;
