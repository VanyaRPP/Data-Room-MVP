import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DataRoom, Node } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type OwnedNode = Node & { room: DataRoom };

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

  async requireOwnedFolder(nodeId: string, userId: string): Promise<OwnedNode> {
    const node = await this.requireOwnedNode(nodeId, userId);

    if (node.type !== 'FOLDER') {
      throw new BadRequestException('That target is a file, not a folder');
    }

    return node;
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
