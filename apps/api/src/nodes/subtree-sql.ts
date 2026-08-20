import { Prisma } from '@prisma/client';

type QueryClient = {
  $queryRaw: <T>(query: TemplateStringsArray | Prisma.Sql) => Promise<T>;
  $executeRaw: (query: TemplateStringsArray | Prisma.Sql) => Promise<number>;
};

/**
 * Every node's totals, recomputed from the tree rather than from the counters.
 *
 * This is the definition the stored counters are meant to match, kept in one
 * place so the rebuild and the drift check can never disagree about what
 * "correct" means. Excludes the node itself: a folder's size is what is
 * beneath it, and a folder has no bytes of its own.
 */
const ACTUAL_TOTALS = Prisma.sql`
  WITH RECURSIVE subtree AS (
    SELECT "id" AS root_id, "id" AS node_id, "type", "size", "status"
    FROM "Node"

    UNION ALL

    SELECT s.root_id, c."id", c."type", c."size", c."status"
    FROM "Node" c
    JOIN subtree s ON c."parentId" = s.node_id
  ),
  actual AS (
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
`;

export interface CounterDrift {
  id: string;
  name: string;
  storedBytes: bigint;
  actualBytes: bigint;
  storedFiles: number;
  actualFiles: number;
  storedFolders: number;
  actualFolders: number;
}

/** Nodes whose stored totals no longer match the tree. Empty means healthy. */
export function findCounterDrift(client: QueryClient): Promise<CounterDrift[]> {
  return client.$queryRaw<CounterDrift[]>(Prisma.sql`
    ${ACTUAL_TOTALS}
    SELECT
      n."id", n."name",
      n."subtreeBytes"   AS "storedBytes",   a.bytes        AS "actualBytes",
      n."subtreeFiles"   AS "storedFiles",   a.files::int   AS "actualFiles",
      n."subtreeFolders" AS "storedFolders", a.folders::int AS "actualFolders"
    FROM "Node" n
    JOIN actual a ON a.root_id = n."id"
    WHERE n."subtreeBytes"   <> a.bytes
       OR n."subtreeFiles"   <> a.files
       OR n."subtreeFolders" <> a.folders
    ORDER BY n."name"
  `);
}

/**
 * Resets every node's totals to what the tree says.
 *
 * Used by the seed, which writes rows directly rather than through the paths
 * that maintain the counters, and available as the repair if drift is ever
 * found in production.
 */
export function rebuildSubtreeCounters(client: QueryClient): Promise<number> {
  return client.$executeRaw(Prisma.sql`
    ${ACTUAL_TOTALS}
    UPDATE "Node" n
    SET "subtreeFolders" = a.folders,
        "subtreeFiles"   = a.files,
        "subtreeBytes"   = a.bytes
    FROM actual a
    WHERE n."id" = a.root_id
  `);
}
