import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccessService,
  requireParentId,
  type OwnedNode,
} from './access.service';

const OWNER_ID = 'owner-1';
const STRANGER_ID = 'stranger-1';
const SHARE_ROOT_ID = 'node-shared-root';
const CHILD_ID = 'node-inside';
const OUTSIDE_ID = 'node-outside';

interface PrismaStub {
  node: { findUnique: ReturnType<typeof vi.fn> };
  share: { findUnique: ReturnType<typeof vi.fn> };
  shareGrant: { findFirst: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
}

function buildNode(overrides: Partial<OwnedNode> = {}): OwnedNode {
  return {
    id: SHARE_ROOT_ID,
    roomId: 'room-1',
    parentId: 'node-root',
    type: 'FOLDER',
    name: 'Financials',
    size: null,
    mimeType: null,
    storageKey: null,
    status: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    room: {
      id: 'room-1',
      name: 'My Data Room',
      ownerId: OWNER_ID,
      createdAt: new Date(),
      rootNodeId: 'node-root',
    },
    ...overrides,
  };
}

function buildShare(overrides: Record<string, unknown> = {}) {
  return {
    id: 'share-1',
    nodeId: SHARE_ROOT_ID,
    mode: 'PUBLIC',
    token: 'token-1',
    createdById: OWNER_ID,
    createdAt: new Date(),
    revokedAt: null,
    node: buildNode(),
    createdBy: { id: OWNER_ID, name: 'Demo User' },
    ...overrides,
  };
}

describe('AccessService', () => {
  let prisma: PrismaStub;
  let access: AccessService;

  beforeEach(() => {
    prisma = {
      node: { findUnique: vi.fn() },
      share: { findUnique: vi.fn() },
      shareGrant: { findFirst: vi.fn() },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    access = new AccessService(prisma as unknown as PrismaService);
  });

  describe('requireOwnedNode', () => {
    it('returns the node to its owner', async () => {
      prisma.node.findUnique.mockResolvedValue(buildNode());

      await expect(
        access.requireOwnedNode(SHARE_ROOT_ID, OWNER_ID),
      ).resolves.toMatchObject({ id: SHARE_ROOT_ID });
    });

    it("answers not-found - never forbidden - for someone else's node", async () => {
      prisma.node.findUnique.mockResolvedValue(buildNode());

      // 403 would confirm the id exists, which is exactly what unguessable
      // ids are meant to prevent.
      await expect(
        access.requireOwnedNode(SHARE_ROOT_ID, STRANGER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers not-found for a node that does not exist', async () => {
      prisma.node.findUnique.mockResolvedValue(null);

      await expect(
        access.requireOwnedNode('missing', OWNER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requireOwnedFolder', () => {
    it('rejects a file where a folder is required', async () => {
      prisma.node.findUnique.mockResolvedValue(
        buildNode({ type: 'FILE', name: 'report.pdf' }),
      );

      await expect(
        access.requireOwnedFolder(SHARE_ROOT_ID, OWNER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('requireActiveShare', () => {
    describe('a public link', () => {
      it('opens for an anonymous visitor', async () => {
        prisma.share.findUnique.mockResolvedValue(buildShare());

        await expect(
          access.requireActiveShare('token-1', {}),
        ).resolves.toMatchObject({ id: 'share-1' });
      });
    });

    describe('a dead link', () => {
      it('is gone when the token is unknown', async () => {
        prisma.share.findUnique.mockResolvedValue(null);

        await expect(
          access.requireActiveShare('nonsense', {}),
        ).rejects.toBeInstanceOf(GoneException);
      });

      it('is gone once revoked', async () => {
        prisma.share.findUnique.mockResolvedValue(
          buildShare({ revokedAt: new Date() }),
        );

        await expect(
          access.requireActiveShare('token-1', {}),
        ).rejects.toBeInstanceOf(GoneException);
      });
    });

    describe('a restricted link', () => {
      beforeEach(() => {
        prisma.share.findUnique.mockResolvedValue(
          buildShare({ mode: 'RESTRICTED' }),
        );
      });

      it('asks an anonymous visitor to sign in', async () => {
        await expect(
          access.requireActiveShare('token-1', {}),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });

      it('refuses a signed-in visitor with no grant', async () => {
        prisma.shareGrant.findFirst.mockResolvedValue(null);

        await expect(
          access.requireActiveShare('token-1', { userId: STRANGER_ID }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('opens for a visitor holding a grant', async () => {
        prisma.shareGrant.findFirst.mockResolvedValue({ id: 'grant-1' });

        await expect(
          access.requireActiveShare('token-1', {
            userId: STRANGER_ID,
            email: 'invitee@example.com',
          }),
        ).resolves.toMatchObject({ id: 'share-1' });
      });

      it('opens for the owner without needing a grant of their own', async () => {
        prisma.shareGrant.findFirst.mockResolvedValue(null);

        await expect(
          access.requireActiveShare('token-1', { userId: OWNER_ID }),
        ).resolves.toMatchObject({ id: 'share-1' });
      });
    });
  });

  describe('requireSharedNode', () => {
    beforeEach(() => {
      prisma.share.findUnique.mockResolvedValue(buildShare());
    });

    it('returns the share root itself without another lookup', async () => {
      await expect(
        access.requireSharedNode('token-1', SHARE_ROOT_ID, {}),
      ).resolves.toMatchObject({ node: { id: SHARE_ROOT_ID } });

      expect(prisma.node.findUnique).not.toHaveBeenCalled();
    });

    it('returns a node inside the shared subtree', async () => {
      prisma.node.findUnique.mockResolvedValue(buildNode({ id: CHILD_ID }));
      prisma.$queryRaw.mockResolvedValue([{ id: SHARE_ROOT_ID }]);

      await expect(
        access.requireSharedNode('token-1', CHILD_ID, {}),
      ).resolves.toMatchObject({ node: { id: CHILD_ID } });
    });

    it('answers not-found for a node outside the shared subtree', async () => {
      prisma.node.findUnique.mockResolvedValue(buildNode({ id: OUTSIDE_ID }));
      // The ancestor walk never reaches the share root.
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        access.requireSharedNode('token-1', OUTSIDE_ID, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reports the link as gone before looking at the node at all', async () => {
      prisma.share.findUnique.mockResolvedValue(
        buildShare({ revokedAt: new Date() }),
      );

      await expect(
        access.requireSharedNode('token-1', CHILD_ID, {}),
      ).rejects.toBeInstanceOf(GoneException);
      expect(prisma.node.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('requireParentId', () => {
    it('returns the parent of an ordinary node', () => {
      expect(requireParentId(buildNode(), 'renamed')).toBe('node-root');
    });

    it('refuses to let the room root be mutated', () => {
      expect(() =>
        requireParentId(buildNode({ parentId: null }), 'deleted'),
      ).toThrow(BadRequestException);
    });
  });
});
