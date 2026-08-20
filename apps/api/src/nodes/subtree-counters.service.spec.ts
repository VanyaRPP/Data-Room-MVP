import { describe, expect, it } from 'vitest';
import type { Node } from '@prisma/client';
import {
  addDeltas,
  contributionOf,
  negate,
  sumDeltas,
  NO_DELTA,
  type SubtreeDelta,
} from './subtree-counters.service';

function buildNode(overrides: Partial<Node>): Node {
  return {
    id: 'node-1',
    roomId: 'room-1',
    parentId: 'parent-1',
    type: 'FILE',
    name: 'report.pdf',
    size: null,
    mimeType: null,
    storageKey: null,
    status: null,
    subtreeBytes: 0n,
    subtreeFiles: 0,
    subtreeFolders: 0,
    version: 1,
    pendingStorageKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('subtree counters', () => {
  describe('contributionOf', () => {
    describe('a file', () => {
      it('counts its bytes once it is ready', () => {
        const delta = contributionOf(
          buildNode({ type: 'FILE', status: 'READY', size: 912n }),
        );

        expect(delta).toEqual<SubtreeDelta>({
          bytes: 912n,
          files: 1,
          folders: 0,
        });
      });

      it('counts for nothing while it is still uploading', () => {
        // The row exists and holds a name, but no bytes anyone can see - and
        // a failed upload must not leave a folder reporting space it never used.
        const delta = contributionOf(
          buildNode({ type: 'FILE', status: 'UPLOADING', size: 912n }),
        );

        expect(delta).toEqual<SubtreeDelta>({
          bytes: 0n,
          files: 0,
          folders: 0,
        });
      });
    });

    describe('a folder', () => {
      it('counts itself along with everything already beneath it', () => {
        const delta = contributionOf(
          buildNode({
            type: 'FOLDER',
            subtreeBytes: 4096n,
            subtreeFiles: 7,
            subtreeFolders: 2,
          }),
        );

        expect(delta).toEqual<SubtreeDelta>({
          bytes: 4096n,
          files: 7,
          // Two folders below it, plus the folder itself.
          folders: 3,
        });
      });

      it('contributes only itself when empty', () => {
        const delta = contributionOf(buildNode({ type: 'FOLDER' }));

        expect(delta).toEqual<SubtreeDelta>({
          bytes: 0n,
          files: 0,
          folders: 1,
        });
      });
    });
  });

  describe('negate', () => {
    it('is what a move subtracts from the branch being left', () => {
      const contribution: SubtreeDelta = {
        bytes: 4096n,
        files: 7,
        folders: 3,
      };

      expect(negate(contribution)).toEqual<SubtreeDelta>({
        bytes: -4096n,
        files: -7,
        folders: -3,
      });
    });

    it('cancels the original exactly, so a move is net zero overall', () => {
      const contribution = contributionOf(
        buildNode({ type: 'FILE', status: 'READY', size: 915n }),
      );
      const reversed = negate(contribution);

      expect(contribution.bytes + reversed.bytes).toBe(0n);
      expect(contribution.files + reversed.files).toBe(0);
      expect(contribution.folders + reversed.folders).toBe(0);
    });
  });

  /**
   * A bulk move adjusts each folder once for the whole batch rather than once
   * per item. That shortcut is only sound because these add, so the sum is
   * what gets tested rather than the helper's arithmetic.
   */
  describe('adding deltas', () => {
    const batch: SubtreeDelta[] = [
      { bytes: 912n, files: 1, folders: 0 },
      { bytes: 4096n, files: 7, folders: 3 },
      { bytes: 0n, files: 0, folders: 1 },
    ];

    it('sums a batch into the one adjustment its target needs', () => {
      expect(sumDeltas(batch)).toEqual<SubtreeDelta>({
        bytes: 5008n,
        files: 8,
        folders: 4,
      });
    });

    it('lands in the same place as applying each item in turn', () => {
      const oneByOne = batch.reduce(addDeltas, NO_DELTA);

      expect(sumDeltas(batch)).toEqual(oneByOne);
    });

    it('leaves a folder untouched when the batch is empty', () => {
      expect(sumDeltas([])).toEqual<SubtreeDelta>(NO_DELTA);
    });

    it('nets out to nothing when the batch is moved back', () => {
      const there = sumDeltas(batch);
      const back = sumDeltas(batch.map(negate));

      expect(addDeltas(there, back)).toEqual<SubtreeDelta>(NO_DELTA);
    });
  });
});
