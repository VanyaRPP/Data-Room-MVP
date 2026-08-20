import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BreadcrumbDto,
  ChildrenQuery,
  NodePage,
  NodeSort,
  SortDirection,
} from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { decodeCursor, encodeCursor, escapeLikePattern } from './cursor';
import { toNodeDto, type NodeRowShape } from './node-dto';

interface ChildRow extends NodeRowShape {
  sortRank: number;
  sortKey: string;
}

/**
 * Folders group ahead of files whichever way the sort runs.
 *
 * Descending flips every column, so files are ranked -1 rather than 1: the
 * whole tuple then reverses uniformly while folders stay on top. Keeping one
 * direction across all three columns is what lets a single tuple comparison
 * resume the page.
 */
function folderRank(direction: SortDirection): Prisma.Sql {
  // Written out rather than parameterised: a bound parameter would come back
  // typed bigint, and the ascending form has to stay byte-identical to the
  // expression in `node_children_listing` for that index to be usable.
  return direction === 'asc'
    ? Prisma.sql`(CASE WHEN "type" = 'FOLDER' THEN 0 ELSE 1 END)`
    : Prisma.sql`(CASE WHEN "type" = 'FOLDER' THEN 0 ELSE -1 END)`;
}

/**
 * The column a listing sorts by, as text so one cursor shape carries them all.
 *
 * Folders have no size, and a NULL inside a tuple comparison makes the whole
 * comparison NULL - which would silently drop every folder from page two. The
 * coalesce keeps them comparable.
 */
function sortColumn(sort: NodeSort): Prisma.Sql {
  switch (sort) {
    case 'size':
      return Prisma.sql`coalesce("size", 0)`;
    case 'updated':
      return Prisma.sql`"updatedAt"`;
    default:
      return Prisma.sql`lower("name")`;
  }
}

/** The same column, cast so a cursor value compares against it exactly. */
function cursorValue(sort: NodeSort, raw: string): Prisma.Sql {
  switch (sort) {
    case 'size':
      return Prisma.sql`${raw}::bigint`;
    case 'updated':
      return Prisma.sql`${raw}::timestamp`;
    default:
      return Prisma.sql`${raw}::text`;
  }
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
   * Postgres jump straight to the resume point, so page 200 costs the same as
   * page 1 and rows inserted mid-scroll can't shift the window and cause a
   * skipped or repeated item.
   *
   * The default sort is the one `node_children_listing` covers exactly, so it
   * needs no sort step. Sorting by size or date is a sort over one folder's
   * children - cheap at any size a folder realistically reaches, and an index
   * per sort could be added if that ever stopped being true.
   */
  async listChildren(
    folderId: string,
    query: ChildrenQuery,
  ): Promise<NodePage> {
    const rank = folderRank(query.direction);
    const column = sortColumn(query.sort);
    const ascending = query.direction === 'asc';
    const order = ascending ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const keyset = cursor
      ? Prisma.sql`AND (${rank}, ${column}, "id") ${
          ascending ? Prisma.sql`>` : Prisma.sql`<`
        } (${cursor.rank}::int, ${cursorValue(query.sort, cursor.name)}, ${cursor.id}::text)`
      : Prisma.empty;

    const typeFilter = query.type
      ? Prisma.sql`AND "type" = ${query.type}::"NodeType"`
      : Prisma.empty;
    const nameFilter = query.q
      ? Prisma.sql`AND lower("name") LIKE ${`%${escapeLikePattern(query.q.toLowerCase())}%`} ESCAPE '\\'`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ChildRow[]>`
      SELECT
        "id", "parentId", "type", "name", "size", "mimeType", "status",
        "createdAt", "updatedAt",
        ${rank} AS "sortRank",
        ${column}::text AS "sortKey"
      FROM "Node"
      WHERE "parentId" = ${folderId}
        -- Files only become visible once their upload is confirmed, so a
        -- failed or abandoned upload never shows up as a phantom row.
        AND ("type" = 'FOLDER' OR "status" = 'READY')
        ${typeFilter}
        ${nameFilter}
        ${keyset}
      ORDER BY ${rank} ${order}, ${column} ${order}, "id" ${order}
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
              name: last.sortKey,
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
