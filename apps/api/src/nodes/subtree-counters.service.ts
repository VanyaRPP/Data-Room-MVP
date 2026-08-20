import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Node } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Anything that can run a raw query: the client itself or a transaction. */
type QueryClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

/** What a node contributes to the totals of every folder above it. */
export interface SubtreeDelta {
  bytes: bigint;
  files: number;
  folders: number;
}

export const NO_DELTA: SubtreeDelta = { bytes: 0n, files: 0, folders: 0 };

/**
 * What this node adds to its ancestors' totals.
 *
 * A file counts only once it is READY: an upload still in flight has reserved
 * a row and a name, but no bytes anyone can see, and counting it would make
 * folders report space that a failed upload never used. A folder counts
 * itself plus whatever its own totals already say is beneath it.
 */
export function contributionOf(node: Node): SubtreeDelta {
  if (node.type === 'FILE') {
    return node.status === 'READY'
      ? { bytes: node.size ?? 0n, files: 1, folders: 0 }
      : NO_DELTA;
  }

  return {
    bytes: node.subtreeBytes,
    files: node.subtreeFiles,
    folders: node.subtreeFolders + 1,
  };
}

export function negate(delta: SubtreeDelta): SubtreeDelta {
  return {
    bytes: -delta.bytes,
    files: -delta.files,
    folders: -delta.folders,
  };
}

/**
 * Keeps each folder's running totals for the subtree beneath it.
 *
 * These exist so a listing can show a folder's size without running a
 * recursive query per row. The price of that is a number that can drift from
 * the truth if any write path forgets to maintain it, which is why every
 * adjustment happens inside the same transaction as the change that caused it
 * - a failed upload or a rejected move leaves the totals exactly as they were
 * - and why the recursive CTE stays as the authority the totals are tested
 * against.
 */
@Injectable()
export class SubtreeCountersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applies a delta to a folder and every folder above it.
   *
   * Anchored at the parent rather than the node itself so that adding,
   * removing and moving all read the same way - and so a removal can be
   * applied before the row is gone, when walking up from it is no longer
   * possible.
   *
   * The arithmetic is done by Postgres rather than read into JavaScript and
   * written back, so two uploads into one folder serialise on the row lock and
   * both deltas land.
   */
  async applyToAncestors(
    client: QueryClient,
    parentId: string | null,
    delta: SubtreeDelta,
  ): Promise<void> {
    if (parentId === null) return;
    if (delta.bytes === 0n && delta.files === 0 && delta.folders === 0) return;

    await client.$executeRaw`
      WITH RECURSIVE ancestors AS (
        SELECT "id", "parentId" FROM "Node" WHERE "id" = ${parentId}

        UNION ALL

        SELECT n."id", n."parentId"
        FROM "Node" n
        JOIN ancestors a ON n."id" = a."parentId"
      )
      UPDATE "Node" SET
        "subtreeBytes"   = "subtreeBytes"   + ${delta.bytes},
        "subtreeFiles"   = "subtreeFiles"   + ${delta.files},
        "subtreeFolders" = "subtreeFolders" + ${delta.folders}
      WHERE "id" IN (SELECT "id" FROM ancestors)
    `;
  }

  /**
   * Recomputes one node's totals from the tree itself.
   *
   * The counters are an optimisation; this is the truth they are meant to
   * match. Used by the consistency check rather than on the read path.
   */
  async recomputeFor(nodeId: string): Promise<SubtreeDelta> {
    const rows = await this.prisma.$queryRaw<
      { folders: bigint; files: bigint; bytes: bigint }[]
    >`
      WITH RECURSIVE subtree AS (
        SELECT "id", "type", "size", "status" FROM "Node" WHERE "id" = ${nodeId}

        UNION ALL

        SELECT n."id", n."type", n."size", n."status"
        FROM "Node" n
        JOIN subtree s ON n."parentId" = s."id"
      )
      SELECT
        count(*) FILTER (WHERE "id" <> ${nodeId} AND "type" = 'FOLDER') AS "folders",
        count(*) FILTER (WHERE "id" <> ${nodeId} AND "type" = 'FILE' AND "status" = 'READY') AS "files",
        coalesce(sum("size") FILTER (
          WHERE "id" <> ${nodeId} AND "type" = 'FILE' AND "status" = 'READY'
        ), 0)::bigint AS "bytes"
      FROM subtree
    `;

    const row = rows[0] ?? { folders: 0n, files: 0n, bytes: 0n };
    return {
      bytes: row.bytes,
      files: Number(row.files),
      folders: Number(row.folders),
    };
  }
}
