import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Share, ShareGrant } from '@prisma/client';
import type {
  CreateShareInput,
  ShareDto,
  SharedWithMeItem,
} from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { toNodeDto, type NodeRowShape } from '../nodes/node-dto';

type ShareWithGrants = Share & { grants: ShareGrant[] };

/**
 * 32 random bytes, URL-safe. A share link is a bearer credential handed out in
 * emails and chat messages, so the only thing standing between a stranger and
 * the documents is how unguessable this string is.
 */
function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

interface SharedWithMeRow extends NodeRowShape {
  token: string;
  sharedBy: string;
  sharedAt: Date;
}

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * Creates the share, or extends the one already covering this node.
   *
   * A node has at most one active share per mode: turning a public link on
   * twice returns the same link rather than quietly invalidating the one
   * already circulating, and adding people to a restricted share adds grants
   * instead of minting a second token nobody has.
   */
  async create(input: CreateShareInput, userId: string): Promise<ShareDto> {
    await this.access.requireOwnedNode(input.nodeId, userId);

    const existing = await this.prisma.share.findFirst({
      where: { nodeId: input.nodeId, mode: input.mode, revokedAt: null },
    });

    const share =
      existing ??
      (await this.prisma.share.create({
        data: {
          nodeId: input.nodeId,
          mode: input.mode,
          createdById: userId,
          token: generateShareToken(),
        },
      }));

    if (input.emails?.length) {
      await this.grantTo(share.id, input.emails);
    }

    return this.toShareDto(await this.withGrants(share.id));
  }

  /** Active shares on a node, for its owner. */
  async listForNode(nodeId: string, userId: string): Promise<ShareDto[]> {
    await this.access.requireOwnedNode(nodeId, userId);

    const shares = await this.prisma.share.findMany({
      where: { nodeId, revokedAt: null },
      include: { grants: true },
      orderBy: { createdAt: 'asc' },
    });

    return shares.map((share) => this.toShareDto(share));
  }

  /**
   * Revoking is a timestamp, not a delete: the row stays as a record that the
   * link existed and when access ended, and every lookup filters on it.
   */
  async revoke(shareId: string, userId: string): Promise<void> {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });
    if (!share) throw new NotFoundException('Share not found');

    // Ownership is checked through the node, so a share can only be revoked by
    // whoever owns the thing it points at.
    await this.access.requireOwnedNode(share.nodeId, userId);

    if (share.revokedAt === null) {
      await this.prisma.share.update({
        where: { id: shareId },
        data: { revokedAt: new Date() },
      });
    }
  }

  /**
   * Items other people shared with this user.
   *
   * Matched by user id or by email: a grant issued before the recipient
   * registered still points only at an address, and this makes it visible the
   * moment they sign in.
   */
  async listSharedWithMe(
    userId: string,
    email: string,
  ): Promise<SharedWithMeItem[]> {
    const rows = await this.prisma.$queryRaw<SharedWithMeRow[]>`
      SELECT
        n."id", n."parentId", n."type", n."name", n."size", n."mimeType",
        n."status", n."createdAt", n."updatedAt",
        s."token",
        u."name"      AS "sharedBy",
        s."createdAt" AS "sharedAt"
      FROM "Share" s
      JOIN "ShareGrant" g ON g."shareId" = s."id"
      JOIN "Node" n       ON n."id" = s."nodeId"
      JOIN "User" u       ON u."id" = s."createdById"
      WHERE s."revokedAt" IS NULL
        AND (g."userId" = ${userId} OR lower(g."email") = ${email.toLowerCase()})
        AND ("n"."type" = 'FOLDER' OR n."status" = 'READY')
      ORDER BY s."createdAt" DESC
    `;

    return rows.map((row) => ({
      token: row.token,
      sharedBy: row.sharedBy,
      sharedAt: row.sharedAt.toISOString(),
      node: toNodeDto(row),
    }));
  }

  /** Grants are keyed by (share, email), so re-adding an address is a no-op. */
  private async grantTo(shareId: string, emails: string[]): Promise<void> {
    const normalized = [
      ...new Set(emails.map((email) => email.trim().toLowerCase())),
    ];

    const users = await this.prisma.user.findMany({
      where: { email: { in: normalized } },
      select: { id: true, email: true },
    });
    const userIdByEmail = new Map(users.map((user) => [user.email, user.id]));

    await this.prisma.shareGrant.createMany({
      data: normalized.map((email) => ({
        shareId,
        email,
        userId: userIdByEmail.get(email) ?? null,
      })),
      skipDuplicates: true,
    });
  }

  private async withGrants(shareId: string): Promise<ShareWithGrants> {
    const share = await this.prisma.share.findUniqueOrThrow({
      where: { id: shareId },
      include: { grants: true },
    });
    return share;
  }

  private toShareDto(share: ShareWithGrants): ShareDto {
    return {
      id: share.id,
      nodeId: share.nodeId,
      mode: share.mode,
      token: share.token,
      createdAt: share.createdAt.toISOString(),
      grants: share.grants.map((grant) => ({
        id: grant.id,
        email: grant.email,
        role: grant.role,
        claimed: grant.userId !== null,
      })),
    };
  }
}
