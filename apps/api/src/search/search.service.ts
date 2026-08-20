import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SearchPage, SearchQuery } from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { decodeCursor, encodeCursor, escapeLikePattern } from '../nodes/cursor';
import { toNodeDto, type NodeRowShape } from '../nodes/node-dto';

interface SearchRow extends NodeRowShape {
  sortRank: number;
  sortName: string;
  path: string[];
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds nodes anywhere in the user's rooms whose name contains the query.
   *
   * One statement does both halves of the job: a non-recursive CTE picks the
   * page of matches, then a recursive one walks up from each of them to build
   * its path. Fetching paths separately would mean a query per result, and a
   * flat result list is unreadable without them - two files called
   * "contract.pdf" are otherwise indistinguishable.
   */
  async search(query: SearchQuery, userId: string): Promise<SearchPage> {
    const escaped = escapeLikePattern(query.q.toLowerCase());
    const contains = `%${escaped}%`;
    const startsWith = `${escaped}%`;

    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const keyset = cursor
      ? Prisma.sql`AND (
          (CASE WHEN lower(n."name") LIKE ${startsWith} ESCAPE '\\' THEN 0 ELSE 1 END),
          lower(n."name"),
          n."id"
        ) > (${cursor.rank}::int, ${cursor.name}::text, ${cursor.id}::text)`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      WITH RECURSIVE matches AS (
        SELECT
          n."id", n."parentId", n."type", n."name", n."size", n."mimeType",
          n."status", n."createdAt", n."updatedAt",
          -- Names that start with the query come first: someone typing
          -- "cap" wants "cap-table.pdf" before "recap-2025.pdf".
          (CASE WHEN lower(n."name") LIKE ${startsWith} ESCAPE '\\' THEN 0 ELSE 1 END) AS "sortRank",
          lower(n."name") AS "sortName"
        FROM "Node" n
        JOIN "DataRoom" r ON r."id" = n."roomId"
        WHERE r."ownerId" = ${userId}
          -- The room's own root is not a search result; it is the container.
          AND n."parentId" IS NOT NULL
          AND (n."type" = 'FOLDER' OR n."status" = 'READY')
          AND lower(n."name") LIKE ${contains} ESCAPE '\\'
          ${keyset}
        ORDER BY "sortRank", "sortName", n."id"
        LIMIT ${query.limit + 1}
      ),
      ancestors AS (
        SELECT m."id" AS "matchId", p."id", p."parentId", p."name", 0 AS depth
        FROM matches m
        JOIN "Node" p ON p."id" = m."parentId"

        UNION ALL

        SELECT a."matchId", p."id", p."parentId", p."name", a.depth + 1
        FROM "Node" p
        JOIN ancestors a ON p."id" = a."parentId"
      )
      SELECT
        m.*,
        COALESCE(
          (
            SELECT array_agg(a."name" ORDER BY a.depth DESC)
            FROM ancestors a
            WHERE a."matchId" = m."id"
          ),
          ARRAY[]::text[]
        ) AS "path"
      FROM matches m
      ORDER BY m."sortRank", m."sortName", m."id"
    `;

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];

    return {
      items: items.map((row) => ({ node: toNodeDto(row), path: row.path })),
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
}
