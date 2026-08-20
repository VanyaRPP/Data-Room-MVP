import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import {
  NameConflictService,
  buildSuffixedName,
  splitName,
} from './name-conflict.service';

/**
 * Stands in for the one raw query resolveAvailableName runs: it hands back the
 * sibling names that already exist, which is the only input the suffix
 * algorithm actually depends on.
 */
function serviceWithSiblings(names: string[]): NameConflictService {
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue(names.map((name) => ({ name }))),
  } as unknown as PrismaService;

  return new NameConflictService(prisma);
}

describe('NameConflictService', () => {
  describe('splitName', () => {
    it('separates a trailing extension from the base name', () => {
      expect(splitName('report.pdf')).toEqual({
        base: 'report',
        extension: '.pdf',
      });
    });

    it('splits on the last dot, not the first', () => {
      expect(splitName('q3.final.pdf')).toEqual({
        base: 'q3.final',
        extension: '.pdf',
      });
    });

    it('treats a leading dot as part of the name', () => {
      expect(splitName('.env')).toEqual({ base: '.env', extension: '' });
    });

    it('treats a trailing dot as part of the name', () => {
      expect(splitName('report.')).toEqual({ base: 'report.', extension: '' });
    });

    it('handles a name with no extension at all', () => {
      expect(splitName('Financials')).toEqual({
        base: 'Financials',
        extension: '',
      });
    });
  });

  describe('buildSuffixedName', () => {
    it('leaves index 0 unsuffixed', () => {
      expect(buildSuffixedName('report', '.pdf', 0)).toBe('report.pdf');
    });

    it('puts the suffix before the extension', () => {
      expect(buildSuffixedName('report', '.pdf', 2)).toBe('report (2).pdf');
    });

    it('appends to the end when there is no extension', () => {
      expect(buildSuffixedName('Legal', '', 1)).toBe('Legal (1)');
    });
  });

  describe('resolveAvailableName', () => {
    it('returns the name unchanged when nothing else claims it', async () => {
      const service = serviceWithSiblings([]);

      await expect(
        service.resolveAvailableName('folder-1', 'report.pdf'),
      ).resolves.toBe('report.pdf');
    });

    it('suffixes past a taken name', async () => {
      const service = serviceWithSiblings(['report.pdf']);

      await expect(
        service.resolveAvailableName('folder-1', 'report.pdf'),
      ).resolves.toBe('report (1).pdf');
    });

    it('skips over consecutive suffixes already in use', async () => {
      const service = serviceWithSiblings([
        'report.pdf',
        'report (1).pdf',
        'report (2).pdf',
      ]);

      await expect(
        service.resolveAvailableName('folder-1', 'report.pdf'),
      ).resolves.toBe('report (3).pdf');
    });

    it('fills a gap rather than always taking the next number', async () => {
      const service = serviceWithSiblings(['report.pdf', 'report (2).pdf']);

      await expect(
        service.resolveAvailableName('folder-1', 'report.pdf'),
      ).resolves.toBe('report (1).pdf');
    });

    it('matches existing names case-insensitively', async () => {
      const service = serviceWithSiblings(['REPORT.PDF']);

      await expect(
        service.resolveAvailableName('folder-1', 'report.pdf'),
      ).resolves.toBe('report (1).pdf');
    });

    it('ignores similarly-shaped names that are not real suffixes', async () => {
      const service = serviceWithSiblings(['report (draft).pdf']);

      await expect(
        service.resolveAvailableName('folder-1', 'report.pdf'),
      ).resolves.toBe('report.pdf');
    });

    it('suffixes folders, which have no extension', async () => {
      const service = serviceWithSiblings(['Legal']);

      await expect(
        service.resolveAvailableName('folder-1', 'Legal'),
      ).resolves.toBe('Legal (1)');
    });
  });
});
