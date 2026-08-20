import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Share, ShareGrant } from '@prisma/client';
import type {
  CreateShareInput,
  ShareDto,
  SharedByMeItem,
  SharedWithMeItem,
} from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService, isLive } from '../access/access.service';
import { toNodeDto, type NodeRowShape } from '../nodes/node-dto';

type ShareWithGrants = Share & { grants: ShareGrant[] };

interface PathRow {
  startId: string;
  names: string[];
}

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
   * A node has at most one live share per mode: turning a public link on
   * twice returns the same link rather than quietly invalidating the one
   * already circulating, and adding people to a restricted share adds grants
   * instead of minting a second token nobody has. An expired link is not
   * reused - it is dead, and reviving it would resurrect a token that has
   * already been handed out and written off.
   */
  async create(input: CreateShareInput, userId: string): Promise<ShareDto> {
    await this.access.requireOwnedNode(input.nodeId, userId);

    const candidates = await this.prisma.share.findMany({
      where: { nodeId: input.nodeId, mode: input.mode, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const existing = candidates.find((share) => isLive(share));

    const share =
      existing ??
      (await this.prisma.share.create({
        data: {
          nodeId: input.nodeId,
          mode: input.mode,
          createdById: userId,
          token: generateShareToken(),
          expiresAt: expiryFrom(input.expiresInDays),
        },
      }));

    if (input.emails?.length) {
      await this.grantTo(share.id, input.emails);
    }

    return this.toShareDto(await this.withGrants(share.id));
  }

  /** Live shares on a node, for its owner. */
  async listForNode(nodeId: string, userId: string): Promise<ShareDto[]> {
    await this.access.requireOwnedNode(nodeId, userId);

    const shares = await this.prisma.share.findMany({
      where: { nodeId, revokedAt: null, ...notExpired() },
      include: { grants: true },
      orderBy: { createdAt: 'asc' },
    });

    return shares.map((share) => this.toShareDto(share));
  }

  /**
   * Every live link this user has handed out, newest first.
   *
   * The per-node list answers "who can see this?"; this answers "what have I
   * given away?" - which is the question an owner actually needs before a
   * deal closes, and the only place a link on a folder buried three levels
   * down is visible without going looking for it.
   *
   * The path comes from one recursive CTE across all of them rather than a
   * breadcrumb query per row.
   */
  async listSharedByMe(userId: string): Promise<SharedByMeItem[]> {
    const shares = await this.prisma.share.findMany({
      where: { createdById: userId, revokedAt: null, ...notExpired() },
      include: { grants: true, node: true },
      orderBy: { createdAt: 'desc' },
    });

    if (shares.length === 0) return [];

    const paths = await this.pathsFor(shares.map((share) => share.node.id));

    return shares.map((share) => ({
      share: this.toShareDto(share),
      node: toNodeDto(share.node),
      path: paths.get(share.node.id) ?? [share.node.name],
    }));
  }

  /** Root-first names for each node, in one pass up the tree. */
  private async pathsFor(nodeIds: string[]): Promise<Map<string, string[]>> {
    const rows = await this.prisma.$queryRaw<PathRow[]>`
      WITH RECURSIVE ancestors AS (
        SELECT n."id" AS "startId", n."id", n."parentId", n."name", 0 AS depth
        FROM "Node" n
        WHERE n."id" IN (${Prisma.join([...new Set(nodeIds)])})

        UNION ALL

        SELECT a."startId", p."id", p."parentId", p."name", a.depth + 1
        FROM "Node" p
        JOIN ancestors a ON p."id" = a."parentId"
      )
      SELECT "startId", array_agg("name" ORDER BY depth DESC) AS "names"
      FROM ancestors
      GROUP BY "startId"
    `;

    return new Map(rows.map((row) => [row.startId, row.names]));
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
        n."status", n."subtreeBytes", n."subtreeFiles", n."subtreeFolders",
        n."createdAt", n."updatedAt",
        s."token",
        u."name"      AS "sharedBy",
        s."createdAt" AS "sharedAt"
      FROM "Share" s
      JOIN "ShareGrant" g ON g."shareId" = s."id"
      JOIN "Node" n       ON n."id" = s."nodeId"
      JOIN "User" u       ON u."id" = s."createdById"
      WHERE s."revokedAt" IS NULL
        AND (s."expiresAt" IS NULL OR s."expiresAt" > now())
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
      expiresAt: share.expiresAt?.toISOString() ?? null,
      grants: share.grants.map((grant) => ({
        id: grant.id,
        email: grant.email,
        role: grant.role,
        claimed: grant.userId !== null,
      })),
    };
  }
}

/**
 * The "not expired yet" half of a live share, as a Prisma filter.
 *
 * Paired with `revokedAt: null` at every call site rather than folded in with
 * it, because the two are separate columns and a partial filter that silently
 * dropped one would be invisible.
 */
function notExpired() {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
}

/** The deadline a request asked for, counted from now. */
function expiryFrom(days: number | null): Date | null {
  if (days === null) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
