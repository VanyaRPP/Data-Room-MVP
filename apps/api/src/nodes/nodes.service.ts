import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BreadcrumbDto,
  ChildrenQuery,
  CreateFolderInput,
  DeletePreviewDto,
  MoveNodeInput,
  NodeDto,
  NodePage,
  NodeType,
  RenameNodeInput,
} from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService, requireParentId } from '../access/access.service';
import { isUniqueConstraintViolation } from '../common/prisma-errors';
import { NameConflictService } from './name-conflict.service';
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

interface SubtreeStatsRow {
  folders: bigint;
  files: bigint;
  totalSize: bigint;
}

/** The position of the last row of a page, in the listing's exact sort order. */
interface ChildrenCursor {
  rank: number;
  name: string;
  id: string;
}

@Injectable()
export class NodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly nameConflict: NameConflictService,
  ) {}

  /**
   * One page of a folder's contents, folders first and then by name.
   *
   * Keyset ("seek") pagination rather than OFFSET: the tuple comparison lets
   * Postgres jump straight to the resume point in the covering index, so page
   * 200 costs the same as page 1 and rows inserted mid-scroll can't shift the
   * window and cause a skipped or repeated item.
   */
  async listChildren(
    folderId: string,
    userId: string,
    query: ChildrenQuery,
  ): Promise<NodePage> {
    await this.access.requireOwnedFolder(folderId, userId);

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

  /** The path from the room's root down to this node, root first. */
  async breadcrumbs(nodeId: string, userId: string): Promise<BreadcrumbDto[]> {
    await this.access.requireOwnedNode(nodeId, userId);

    return this.prisma.$queryRaw<BreadcrumbDto[]>`
      WITH RECURSIVE ancestors AS (
        SELECT "id", "parentId", "name", 0 AS depth
        FROM "Node"
        WHERE "id" = ${nodeId}

        UNION ALL

        SELECT n."id", n."parentId", n."name", a.depth + 1
        FROM "Node" n
        JOIN ancestors a ON n."id" = a."parentId"
      )
      SELECT "id", "name" FROM ancestors ORDER BY depth DESC
    `;
  }

  async createFolder(
    input: CreateFolderInput,
    userId: string,
  ): Promise<NodeDto> {
    const parent = await this.access.requireOwnedFolder(input.parentId, userId);

    const conflict = await this.nameConflict.findConflict(
      parent.id,
      input.name,
    );
    if (conflict) throw new ConflictException(conflictMessage(conflict.type));

    try {
      const folder = await this.prisma.node.create({
        data: {
          roomId: parent.roomId,
          parentId: parent.id,
          type: 'FOLDER',
          name: input.name,
        },
      });
      return toNodeDto(folder);
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  async rename(
    nodeId: string,
    userId: string,
    input: RenameNodeInput,
  ): Promise<NodeDto> {
    const node = await this.access.requireOwnedNode(nodeId, userId);
    const parentId = requireParentId(node, 'renamed');

    const conflict = await this.nameConflict.findConflict(
      parentId,
      input.name,
      node.id,
    );
    if (conflict) throw new ConflictException(conflictMessage(conflict.type));

    try {
      const renamed = await this.prisma.node.update({
        where: { id: node.id },
        data: { name: input.name },
      });
      return toNodeDto(renamed);
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  /**
   * Moves a node into another folder.
   *
   * The requirement is only that files move, but the cycle check is written
   * for the general case: moving a folder into its own subtree would detach
   * that whole branch from the root and strand it.
   */
  async move(
    nodeId: string,
    userId: string,
    input: MoveNodeInput,
  ): Promise<NodeDto> {
    const node = await this.access.requireOwnedNode(nodeId, userId);
    const currentParentId = requireParentId(node, 'moved');
    const target = await this.access.requireOwnedFolder(
      input.targetFolderId,
      userId,
    );

    if (target.roomId !== node.roomId) {
      throw new BadRequestException('Items cannot move between data rooms');
    }

    // Already where it was asked to go: nothing to do, and reporting a name
    // conflict against itself would be nonsense.
    if (target.id === currentParentId) return toNodeDto(node);

    if (
      node.type === 'FOLDER' &&
      (await this.containsNode(node.id, target.id))
    ) {
      throw new BadRequestException(
        'A folder cannot be moved into itself or one of its own subfolders',
      );
    }

    let name = node.name;
    if (input.onConflict === 'rename') {
      name = await this.nameConflict.resolveAvailableName(target.id, node.name);
    } else {
      const conflict = await this.nameConflict.findConflict(
        target.id,
        node.name,
      );
      if (conflict) throw new ConflictException(conflictMessage(conflict.type));
    }

    try {
      const moved = await this.prisma.node.update({
        where: { id: node.id },
        data: { parentId: target.id, name },
      });
      return toNodeDto(moved);
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  /** Whether `candidateId` is `ancestorId` itself or sits somewhere beneath it. */
  private async containsNode(
    ancestorId: string,
    candidateId: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE descendants AS (
        SELECT "id" FROM "Node" WHERE "id" = ${ancestorId}

        UNION ALL

        SELECT n."id"
        FROM "Node" n
        JOIN descendants d ON n."parentId" = d."id"
      )
      SELECT "id" FROM descendants WHERE "id" = ${candidateId} LIMIT 1
    `;

    return rows.length > 0;
  }

  /**
   * What deleting this node would remove, counted across its whole subtree.
   *
   * A recursive CTE keeps this a single round trip regardless of depth. The
   * node itself is included in the counts, because it is deleted too.
   */
  async deletePreview(
    nodeId: string,
    userId: string,
  ): Promise<DeletePreviewDto> {
    await this.access.requireOwnedNode(nodeId, userId);

    const rows = await this.prisma.$queryRaw<SubtreeStatsRow[]>`
      WITH RECURSIVE subtree AS (
        SELECT "id", "type", "size" FROM "Node" WHERE "id" = ${nodeId}

        UNION ALL

        SELECT n."id", n."type", n."size"
        FROM "Node" n
        JOIN subtree s ON n."parentId" = s."id"
      )
      SELECT
        count(*) FILTER (WHERE "type" = 'FOLDER') AS "folders",
        count(*) FILTER (WHERE "type" = 'FILE')   AS "files",
        -- sum() over bigint widens to numeric; cast back so this arrives as a
        -- JS bigint like every other size in the API.
        coalesce(sum("size"), 0)::bigint          AS "totalSize"
      FROM subtree
    `;

    const stats = rows[0] ?? { folders: 0n, files: 0n, totalSize: 0n };

    return {
      folders: Number(stats.folders),
      files: Number(stats.files),
      totalSize: stats.totalSize.toString(),
    };
  }

  /** Deletes a node and, via the schema's cascade, everything beneath it. */
  async delete(nodeId: string, userId: string): Promise<void> {
    const node = await this.access.requireOwnedNode(nodeId, userId);
    requireParentId(node, 'deleted');

    await this.prisma.node.delete({ where: { id: node.id } });
  }

  /**
   * Turns a lost race against `node_parent_name_ci` into the same 409 the
   * pre-check produces. The pre-check exists for the specific message; this
   * exists because two concurrent requests can both pass it.
   */
  private asConflict(error: unknown): unknown {
    if (isUniqueConstraintViolation(error)) {
      return new ConflictException('An item with this name already exists');
    }
    return error;
  }
}

function conflictMessage(type: NodeType): string {
  return type === 'FOLDER'
    ? 'A folder with this name already exists'
    : 'A file with this name already exists';
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
