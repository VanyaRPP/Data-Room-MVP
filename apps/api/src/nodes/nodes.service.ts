import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BreadcrumbDto,
  ChildrenQuery,
  CreateFolderInput,
  DeletePreviewDto,
  MoveNodeInput,
  MoveNodesInput,
  NodeBatchInput,
  NodeDto,
  NodePage,
  NodeType,
  RenameNodeInput,
} from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccessService,
  requireParentId,
  type OwnedNode,
} from '../access/access.service';
import { isUniqueConstraintViolation } from '../common/prisma-errors';
import { StorageService } from '../storage/storage.service';
import { NameConflictService } from './name-conflict.service';
import { NodeQueriesService } from './node-queries.service';
import {
  SubtreeCountersService,
  addDeltas,
  contributionOf,
  negate,
  sumDeltas,
  NO_DELTA,
  type SubtreeDelta,
} from './subtree-counters.service';
import { toNodeDto } from './node-dto';

interface SubtreeStatsRow {
  folders: bigint;
  files: bigint;
  totalSize: bigint;
}

const MOVE_INTO_SELF_MESSAGE =
  'A folder cannot be moved into itself or one of its own subfolders';

@Injectable()
export class NodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly nameConflict: NameConflictService,
    private readonly queries: NodeQueriesService,
    private readonly counters: SubtreeCountersService,
    private readonly storage: StorageService,
  ) {}

  async listChildren(
    folderId: string,
    userId: string,
    query: ChildrenQuery,
  ): Promise<NodePage> {
    await this.access.requireOwnedFolder(folderId, userId);
    return this.queries.listChildren(folderId, query);
  }

  /** The path from the room's root down to this node, root first. */
  async breadcrumbs(nodeId: string, userId: string): Promise<BreadcrumbDto[]> {
    await this.access.requireOwnedNode(nodeId, userId);
    return this.queries.breadcrumbs(nodeId);
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
      const folder = await this.prisma.$transaction(async (tx) => {
        const created = await tx.node.create({
          data: {
            roomId: parent.roomId,
            parentId: parent.id,
            type: 'FOLDER',
            name: input.name,
          },
        });

        await this.counters.applyToAncestors(tx, parent.id, {
          bytes: 0n,
          files: 0,
          folders: 1,
        });

        return created;
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
   * A single move is a batch of one - see moveMany for what actually happens.
   */
  async move(
    nodeId: string,
    userId: string,
    input: MoveNodeInput,
  ): Promise<NodeDto> {
    const [moved] = await this.moveMany(
      { ...input, nodeIds: [nodeId] },
      userId,
    );

    if (!moved) {
      // Unreachable: moveMany answers with one node per id it was given.
      throw new NotFoundException('Node not found');
    }

    return moved;
  }

  /**
   * Moves any number of nodes into one folder, as a single transaction.
   *
   * All or nothing on purpose. A partial move leaves the user to work out
   * which half of their selection went where, so a name already taken in the
   * target refuses the whole batch and names what clashed - and the caller can
   * come back with `onConflict: 'rename'` to keep both.
   *
   * The requirement is only that files move, but the cycle check is written
   * for the general case: moving a folder into its own subtree would detach
   * that whole branch from the root and strand it.
   */
  async moveMany(input: MoveNodesInput, userId: string): Promise<NodeDto[]> {
    const target = await this.access.requireOwnedFolder(
      input.targetFolderId,
      userId,
    );
    const nodes = await this.access.requireOwnedNodes(input.nodeIds, userId);

    for (const node of nodes) requireParentId(node, 'moved');

    if (nodes.some((node) => node.roomId !== target.roomId)) {
      throw new BadRequestException('Items cannot move between data rooms');
    }

    await this.requireIndependentSubtrees(nodes, target.id);

    // Anything already sitting in the target needs no work, and asking whether
    // its name clashes with itself would be nonsense.
    const moving = nodes.filter((node) => node.parentId !== target.id);
    if (moving.length === 0) return nodes.map(toNodeDto);

    const taken = await this.nameConflict.findTakenNames(
      target.id,
      moving.map((node) => node.name),
    );
    const clashing = moving.filter((node) =>
      taken.has(node.name.toLowerCase()),
    );

    if (clashing.length > 0 && input.onConflict === 'fail') {
      throw new ConflictException(
        moveConflictMessage(clashing, taken, moving.length),
      );
    }

    // Only when the caller asked to keep both. Under `fail` this is empty:
    // nothing clashes with the target by here, and two items in the batch
    // wanting one name is still a conflict for the caller to resolve.
    const suffixing =
      input.onConflict === 'rename'
        ? itemsNeedingNewName(moving, taken)
        : new Set<string>();

    // Each node's own totals describe what is beneath it and do not change;
    // what moves is its contribution, off one branch and onto the other.
    // Siblings share an ancestor chain, so one summed adjustment per source
    // folder does the work of one per item.
    const byParent = contributionsByParent(moving);

    try {
      const moved = await this.prisma.$transaction(async (tx) => {
        // The items keeping their names travel in one statement, and they go
        // first: the suffixes resolved below have to see the names they take.
        const keeping = moving.filter((node) => !suffixing.has(node.id));
        if (keeping.length > 0) {
          await tx.node.updateMany({
            where: { id: { in: keeping.map((node) => node.id) } },
            data: { parentId: target.id },
          });
        }

        for (const node of moving.filter((item) => suffixing.has(item.id))) {
          const name = await this.nameConflict.resolveAvailableName(
            target.id,
            node.name,
            tx,
          );
          await tx.node.update({
            where: { id: node.id },
            data: { parentId: target.id, name },
          });
        }

        for (const [parentId, delta] of byParent) {
          await this.counters.applyToAncestors(tx, parentId, negate(delta));
        }
        await this.counters.applyToAncestors(
          tx,
          target.id,
          sumDeltas(byParent.values()),
        );

        return tx.node.findMany({
          where: { id: { in: nodes.map((node) => node.id) } },
        });
      });

      return moved.map(toNodeDto);
    } catch (error) {
      throw this.asConflict(error);
    }
  }

  /**
   * Rejects a batch that is not a set of independent subtrees.
   *
   * Two shapes are refused. A target inside one of the folders being moved
   * would detach that branch from the root. A selected node inside another
   * selected node is ambiguous - what it means depends on which half is
   * applied first - and its bytes sit inside the ancestor's totals as well as
   * its own, so the summed adjustments above would count them twice.
   *
   * Only a folder can contain anything, so a batch of files never needs asking.
   */
  private async requireIndependentSubtrees(
    nodes: OwnedNode[],
    targetId?: string,
  ): Promise<void> {
    const folderIds = nodes
      .filter((node) => node.type === 'FOLDER')
      .map((node) => node.id);
    if (folderIds.length === 0) return;

    if (targetId !== undefined && folderIds.includes(targetId)) {
      throw new BadRequestException(MOVE_INTO_SELF_MESSAGE);
    }

    const startIds = nodes.map((node) => node.id);
    if (targetId !== undefined) startIds.push(targetId);

    // Walking up from each node rather than down from each folder: an ancestor
    // chain is one row per level, where the subtrees could be thousands. Only
    // parentIds are carried, so what comes back are strict ancestors.
    const nested = await this.prisma.$queryRaw<{ startId: string }[]>`
      WITH RECURSIVE ancestors AS (
        SELECT n."id" AS "startId", n."parentId"
        FROM "Node" n
        WHERE n."id" IN (${Prisma.join(startIds)})

        UNION ALL

        SELECT a."startId", p."parentId"
        FROM "Node" p
        JOIN ancestors a ON p."id" = a."parentId"
      )
      SELECT DISTINCT "startId"
      FROM ancestors
      WHERE "parentId" IN (${Prisma.join(folderIds)})
    `;

    const nestedIds = new Set(nested.map((row) => row.startId));
    if (nestedIds.size === 0) return;

    throw new BadRequestException(
      targetId !== undefined && nestedIds.has(targetId)
        ? MOVE_INTO_SELF_MESSAGE
        : 'Select either a folder or the items inside it, but not both',
    );
  }

  /** What deleting this node would remove. A batch of one - see below. */
  async deletePreview(
    nodeId: string,
    userId: string,
  ): Promise<DeletePreviewDto> {
    return this.deletePreviewMany({ nodeIds: [nodeId] }, userId);
  }

  /**
   * What deleting this selection would remove, counted across every subtree
   * it reaches.
   *
   * A recursive CTE keeps this a single round trip regardless of depth or how
   * many items were picked. The selected nodes are included in the counts,
   * because they are deleted too.
   *
   * This is the one place the recursive query is still preferred over the
   * running totals each folder carries: a confirmation that says what is about
   * to be destroyed should read the tree, not an optimisation of it.
   */
  async deletePreviewMany(
    input: NodeBatchInput,
    userId: string,
  ): Promise<DeletePreviewDto> {
    const nodes = await this.access.requireOwnedNodes(input.nodeIds, userId);
    const ids = nodes.map((node) => node.id);

    const rows = await this.prisma.$queryRaw<SubtreeStatsRow[]>`
      WITH RECURSIVE subtree AS (
        SELECT "id", "type", "size"
        FROM "Node"
        WHERE "id" IN (${Prisma.join(ids)})

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
      -- A preview is allowed to span nested selections even though a delete
      -- refuses them, so a node reached from two roots is counted once.
      FROM (SELECT DISTINCT "id", "type", "size" FROM subtree) AS reached
    `;

    const stats = rows[0] ?? { folders: 0n, files: 0n, totalSize: 0n };

    return {
      folders: Number(stats.folders),
      files: Number(stats.files),
      totalSize: stats.totalSize.toString(),
    };
  }

  /** Deletes a node and everything beneath it. A batch of one - see below. */
  async delete(nodeId: string, userId: string): Promise<void> {
    return this.deleteMany({ nodeIds: [nodeId] }, userId);
  }

  /**
   * Deletes a selection and, via the schema's cascade, everything beneath it.
   *
   * Storage keys are collected before the rows disappear, then the blobs are
   * removed afterwards: doing it in that order means a storage outage leaves
   * orphaned blobs (logged, harmless) rather than rows pointing at files that
   * are already gone.
   */
  async deleteMany(input: NodeBatchInput, userId: string): Promise<void> {
    const nodes = await this.access.requireOwnedNodes(input.nodeIds, userId);

    for (const node of nodes) requireParentId(node, 'deleted');

    await this.requireIndependentSubtrees(nodes);

    const ids = nodes.map((node) => node.id);
    const storageKeys = await this.collectStorageKeys(ids);
    const byParent = contributionsByParent(nodes);

    await this.prisma.$transaction(async (tx) => {
      // Adjust before the rows are gone: afterwards there is nothing left to
      // walk up from, and the ancestors would keep counting what they lost.
      for (const [parentId, delta] of byParent) {
        await this.counters.applyToAncestors(tx, parentId, negate(delta));
      }

      await tx.node.deleteMany({ where: { id: { in: ids } } });
    });

    await this.storage.removeMany(storageKeys);
  }

  /**
   * Every stored blob in these subtrees: the current bytes of each file and
   * every superseded version of them. Missing the archived ones would leave
   * storage growing with history nothing can ever reach again.
   */
  private async collectStorageKeys(nodeIds: string[]): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ storageKey: string }[]>`
      WITH RECURSIVE subtree AS (
        SELECT "id", "storageKey"
        FROM "Node"
        WHERE "id" IN (${Prisma.join(nodeIds)})

        UNION ALL

        SELECT n."id", n."storageKey"
        FROM "Node" n
        JOIN subtree s ON n."parentId" = s."id"
      )
      SELECT "storageKey" FROM subtree WHERE "storageKey" IS NOT NULL
      UNION
      SELECT v."storageKey"
      FROM "FileVersion" v
      JOIN subtree s ON v."nodeId" = s."id"
    `;

    return rows.map((row) => row.storageKey);
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

/**
 * Why a move was refused, naming what stands in the way.
 *
 * Moving one item speaks for itself - the caller knows what it asked to move,
 * so this keeps the wording every other name conflict in the app uses. A batch
 * has to say which of its items are the problem, because "some of these
 * already exist" leaves the user to find out which by trial and error.
 */
function moveConflictMessage(
  clashing: OwnedNode[],
  taken: Map<string, NodeType>,
  batchSize: number,
): string {
  const [first] = clashing;
  if (first !== undefined && batchSize === 1) {
    return conflictMessage(taken.get(first.name.toLowerCase()) ?? first.type);
  }

  const named = clashing.slice(0, 3).map((node) => `"${node.name}"`);
  const rest = clashing.length - named.length;
  const list =
    rest > 0 ? `${named.join(', ')} and ${rest} more` : joinWithAnd(named);
  const verb = clashing.length === 1 ? 'already exists' : 'already exist';

  return `${list} ${verb} in that folder`;
}

/** `"a"`, `"a" and "b"`, `"a", "b" and "c"` - a list a person would read out. */
function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Which items cannot keep the name they arrive with, by id.
 *
 * `taken` is what the target already holds. The rest of the batch counts too:
 * two items coming from different folders can want the same name, and the
 * target has no way to report a clash with something that is not there yet.
 * First one in keeps the name, the rest are suffixed like any other clash.
 */
function itemsNeedingNewName(
  moving: OwnedNode[],
  taken: Map<string, NodeType>,
): Set<string> {
  const claimed = new Set(taken.keys());
  const needing = new Set<string>();

  for (const node of moving) {
    const name = node.name.toLowerCase();
    if (claimed.has(name)) needing.add(node.id);
    else claimed.add(name);
  }

  return needing;
}

/**
 * What each node contributes to its ancestors, summed per source folder.
 *
 * Grouping is what turns a bulk operation into a couple of counter updates:
 * a selection is usually one folder's worth of items, and they all share the
 * same chain of ancestors above it.
 */
function contributionsByParent(nodes: OwnedNode[]): Map<string, SubtreeDelta> {
  const byParent = new Map<string, SubtreeDelta>();

  for (const node of nodes) {
    // Guaranteed by requireParentId before this runs: only the room root has
    // no parent, and it can be neither moved nor deleted.
    if (node.parentId === null) continue;

    const running = byParent.get(node.parentId) ?? NO_DELTA;
    byParent.set(node.parentId, addDeltas(running, contributionOf(node)));
  }

  return byParent;
}
