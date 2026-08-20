import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DataRoom, Node, Share, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type OwnedNode = Node & { room: DataRoom };

export type ActiveShare = Share & {
  node: Node & { room: DataRoom };
  createdBy: User;
};

export interface ShareViewer {
  userId?: string;
  email?: string;
}

export interface SharedNodeAccess {
  share: ActiveShare;
  node: Node;
}

/**
 * Whether a share still grants anything: not revoked, and not past its date.
 *
 * One definition for both, so the listing an owner sees and the door a visitor
 * knocks on can never disagree about which links are live.
 */
export function isLive(
  share: Pick<Share, 'revokedAt' | 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  if (share.revokedAt !== null) return false;
  return share.expiresAt === null || share.expiresAt > now;
}

/**
 * The single place any "may this user touch this node?" question is answered,
 * so no controller ever hand-rolls its own check.
 *
 * Deliberately answers "not found" rather than "forbidden" for a node owned by
 * someone else: a 403 would confirm that the id exists, which is exactly what
 * an unguessable-id model must not do.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireOwnedNode(nodeId: string, userId: string): Promise<OwnedNode> {
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      include: { room: true },
    });

    if (!node || node.room.ownerId !== userId) {
      throw new NotFoundException('Node not found');
    }

    return node;
  }

  /**
   * The same question for a whole batch, in one query.
   *
   * All or nothing: one id the user does not own fails the lot, with the same
   * "not found" a single node would give. Anything else would let a caller
   * probe for other people's ids by watching which parts of a batch survived.
   */
  async requireOwnedNodes(
    nodeIds: string[],
    userId: string,
  ): Promise<OwnedNode[]> {
    const ids = [...new Set(nodeIds)];

    const nodes = await this.prisma.node.findMany({
      where: { id: { in: ids }, room: { ownerId: userId } },
      include: { room: true },
    });

    if (nodes.length !== ids.length) {
      throw new NotFoundException('Node not found');
    }

    return nodes;
  }

  async requireOwnedFolder(nodeId: string, userId: string): Promise<OwnedNode> {
    const node = await this.requireOwnedNode(nodeId, userId);

    if (node.type !== 'FOLDER') {
      throw new BadRequestException('That target is a file, not a folder');
    }

    return node;
  }

  /**
   * Resolves a share link, in the order a visitor experiences it.
   *
   * The link being dead comes first and is deliberately indistinguishable
   * between "never existed", "revoked", "expired" and "the owner deleted it" -
   * all four are 410, because telling them apart would confirm that a token was
   * once real. Only after the link is known good does the viewer's identity
   * matter.
   */
  async requireActiveShare(
    token: string,
    viewer: ShareViewer,
  ): Promise<ActiveShare> {
    const share = await this.prisma.share.findUnique({
      where: { token },
      include: { node: { include: { room: true } }, createdBy: true },
    });

    // Expiry is enforced here rather than by a job that flips a column, so a
    // link stops working the moment it is due even if nothing has run since.
    if (!share || !isLive(share)) {
      throw new GoneException(
        'This link is no longer available. The owner may have removed it or revoked access.',
      );
    }

    if (share.mode === 'PUBLIC') return share;

    // The owner is never locked out of their own material - not least because
    // the first thing anyone does with a new link is open it themselves.
    if (viewer.userId === share.node.room.ownerId) return share;

    if (!viewer.userId) {
      throw new UnauthorizedException('Sign in to open this shared item');
    }

    const grant = await this.prisma.shareGrant.findFirst({
      where: {
        shareId: share.id,
        // Granted by email, so a grant issued before the recipient registered
        // still resolves; register() backfills userId when they sign up.
        OR: [
          { userId: viewer.userId },
          ...(viewer.email ? [{ email: viewer.email }] : []),
        ],
      },
    });

    if (!grant) {
      throw new ForbiddenException(
        'This item has not been shared with your account',
      );
    }

    return share;
  }

  /**
   * The share link plus one node inside it. A node outside the shared subtree
   * is 404: the link grants access to a branch, not to the whole room, and a
   * different answer would let a holder probe for ids beyond it.
   */
  async requireSharedNode(
    token: string,
    nodeId: string,
    viewer: ShareViewer,
  ): Promise<SharedNodeAccess> {
    const share = await this.requireActiveShare(token, viewer);

    if (nodeId === share.nodeId) return { share, node: share.node };

    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node || !(await this.isWithinSubtree(share.nodeId, nodeId))) {
      throw new NotFoundException('Node not found');
    }

    return { share, node };
  }

  /** Whether `nodeId` sits anywhere beneath `rootId`. */
  private async isWithinSubtree(
    rootId: string,
    nodeId: string,
  ): Promise<boolean> {
    // Walking up from the node rather than down from the root: an ancestor
    // chain is one row per level, where a subtree could be thousands.
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE ancestors AS (
        SELECT "id", "parentId" FROM "Node" WHERE "id" = ${nodeId}

        UNION ALL

        SELECT n."id", n."parentId"
        FROM "Node" n
        JOIN ancestors a ON n."id" = a."parentId"
      )
      SELECT "id" FROM ancestors WHERE "id" = ${rootId} LIMIT 1
    `;

    return rows.length > 0;
  }
}

/**
 * Returns the node's parent id, rejecting the room's root folder.
 *
 * The root is the one node with a null parentId (see schema.prisma), and it is
 * structural: renaming, moving or deleting it would leave the room without an
 * entry point. Every caller that mutates a node needs its parent anyway, so
 * pairing the two makes the rule impossible to forget.
 */
export function requireParentId(node: OwnedNode, action: string): string {
  if (node.parentId === null) {
    throw new BadRequestException(`The root folder cannot be ${action}`);
  }
  return node.parentId;
}
