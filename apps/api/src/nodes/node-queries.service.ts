import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BreadcrumbDto, ChildrenQuery, NodePage } from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toNodeDto, type NodeRowShape } from './node-dto';

/**
 * Folders sort before files. Written as an explicit rank rather than relying on
 * the enum's declaration order, and repeated verbatim in `node_children_listing`
 * (see the init migration) so the listing is an index scan with no sort step.
 */
const FOLDER_FIRST = Prisma.sql`(CASE WHEN "type" = 'FOLDER' THEN 0 ELSE 1 END)`;

interface ChildRow extends NodeRowShape {
  sortRank: number;
  sortName: string;
}

/** The position of the last row of a page, in the listing's exact sort order. */
interface ChildrenCursor {
  rank: number;
  name: string;
  id: string;
}

/**
 * Reading a folder's contents, with no opinion about who is allowed to.
 *
 * Kept apart from NodesService on purpose: the owner's browser and the public
 * share view need byte-identical listings, and the only difference between them
 * is which authorization ran first. Sharing the queries means the two can never
 * drift; keeping this layer free of access checks means neither caller can
 * mistake it for one.
 */
@Injectable()
export class NodeQueriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One page of a folder's contents.
   *
   * Keyset ("seek") pagination rather than OFFSET: the tuple comparison lets
   * Postgres jump straight to the resume point in the covering index, so page
   * 200 costs the same as page 1 and rows inserted mid-scroll can't shift the
   * window and cause a skipped or repeated item.
   */
  async listChildren(
    folderId: string,
    query: ChildrenQuery,
  ): Promise<NodePage> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const keyset = cursor
      ? Prisma.sql`AND (${FOLDER_FIRST}, lower("name"), "id") > (${cursor.rank}::int, ${cursor.name}::text, ${cursor.id}::text)`
      : Prisma.empty;
    const typeFilter = query.type
      ? Prisma.sql`AND "type" = ${query.type}::"NodeType"`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ChildRow[]>`
      SELECT
        "id", "parentId", "type", "name", "size", "mimeType", "status",
        "createdAt", "updatedAt",
        ${FOLDER_FIRST} AS "sortRank",
        lower("name") AS "sortName"
      FROM "Node"
      WHERE "parentId" = ${folderId}
        -- Files only become visible once their upload is confirmed, so a
        -- failed or abandoned upload never shows up as a phantom row.
        AND ("type" = 'FOLDER' OR "status" = 'READY')
        ${typeFilter}
        ${keyset}
      ORDER BY ${FOLDER_FIRST}, lower("name"), "id"
      LIMIT ${query.limit + 1}
    `;

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];

    return {
      items: items.map(toNodeDto),
      // The cursor carries the sort keys Postgres itself computed, so resuming
      // can't drift from the ordering the way re-deriving them in JS could.
      nextCursor:
        hasMore && last
          ? encodeCursor({
              rank: last.sortRank,
              name: last.sortName,
              id: last.id,
            })
          : null,
    };
  }

  /**
   * The path up to this node, root first.
   *
   * `stopAtId` ends the walk at a given ancestor, which is what keeps a share
   * link from leaking the folder names above whatever was shared.
   */
  breadcrumbs(nodeId: string, stopAtId?: string): Promise<BreadcrumbDto[]> {
    return this.prisma.$queryRaw<BreadcrumbDto[]>`
      WITH RECURSIVE ancestors AS (
        SELECT "id", "parentId", "name", 0 AS depth
        FROM "Node"
        WHERE "id" = ${nodeId}

        UNION ALL

        SELECT n."id", n."parentId", n."name", a.depth + 1
        FROM "Node" n
        JOIN ancestors a ON n."id" = a."parentId"
        -- Include the boundary node, then stop; IS DISTINCT FROM so that no
        -- boundary at all (NULL) simply never matches and the walk completes.
        WHERE a."id" IS DISTINCT FROM ${stopAtId ?? null}::text
      )
      SELECT "id", "name" FROM ancestors ORDER BY depth DESC
    `;
  }
}

function encodeCursor(cursor: ChildrenCursor): string {
  return Buffer.from(
    JSON.stringify([cursor.rank, cursor.name, cursor.id]),
  ).toString('base64url');
}

function decodeCursor(raw: string): ChildrenCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('Invalid cursor');
  }

  if (
    Array.isArray(parsed) &&
    parsed.length === 3 &&
    typeof parsed[0] === 'number' &&
    typeof parsed[1] === 'string' &&
    typeof parsed[2] === 'string'
  ) {
    return { rank: parsed[0], name: parsed[1], id: parsed[2] };
  }

  throw new BadRequestException('Invalid cursor');
}
