import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NodeType } from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { escapeLikePattern } from './cursor';

/** Anything that can run a raw query: the client itself or a transaction. */
type QueryClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

interface NodeNameRow {
  name: string;
}

interface ConflictRow {
  id: string;
  type: NodeType;
}

interface TakenNameRow {
  name: string;
  type: NodeType;
}

export interface NameConflict {
  id: string;
  type: NodeType;
}

/**
 * Splits a name into the part a numeric suffix goes after and the extension it
 * goes before, so `report.pdf` suffixes to `report (1).pdf` rather than
 * `report.pdf (1)`.
 *
 * A leading dot is treated as part of the name (`.env` has no extension), and
 * so is a trailing one (`report.` keeps its dot rather than gaining a suffix
 * in the middle).
 */
export function splitName(name: string): { base: string; extension: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) {
    return { base: name, extension: '' };
  }
  return { base: name.slice(0, dot), extension: name.slice(dot) };
}

/** `index` 0 is the unsuffixed name; 1 and up produce `base (n)extension`. */
export function buildSuffixedName(
  base: string,
  extension: string,
  index: number,
): string {
  return index === 0 ? `${base}${extension}` : `${base} (${index})${extension}`;
}

/**
 * Sibling name collisions, in the two flavours the product needs.
 *
 * Both go through raw SQL against `lower(name)` so they agree exactly with the
 * `node_parent_name_ci` unique index (see the init migration) - Prisma's query
 * builder has no way to express a case-insensitive comparison that uses it.
 * These checks produce friendly messages and auto-suffixes; the index itself
 * is what actually guarantees uniqueness under concurrent writes.
 */
@Injectable()
export class NameConflictService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The sibling already using `name`, if any. `excludeNodeId` skips the node
   * being renamed, so changing only a name's casing isn't a conflict with
   * itself.
   */
  async findConflict(
    parentId: string,
    name: string,
    excludeNodeId?: string,
  ): Promise<NameConflict | null> {
    const exclusion = excludeNodeId
      ? Prisma.sql`AND "id" <> ${excludeNodeId}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ConflictRow[]>`
      SELECT "id", "type"
      FROM "Node"
      WHERE "parentId" = ${parentId}
        AND lower("name") = ${name.toLowerCase()}
        ${exclusion}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  /**
   * Which of these names the folder already uses, and for what kind of node.
   *
   * One query for the whole batch, so a bulk move can name every clash at
   * once instead of refusing one item at a time. Keyed by the lowercased name,
   * because that is what `node_parent_name_ci` compares.
   */
  async findTakenNames(
    parentId: string,
    names: string[],
  ): Promise<Map<string, NodeType>> {
    const wanted = [...new Set(names.map((name) => name.toLowerCase()))];
    if (wanted.length === 0) return new Map();

    const rows = await this.prisma.$queryRaw<TakenNameRow[]>`
      SELECT lower("name") AS "name", "type"
      FROM "Node"
      WHERE "parentId" = ${parentId}
        AND lower("name") IN (${Prisma.join(wanted)})
    `;

    return new Map(rows.map((row) => [row.name, row.type]));
  }

  /**
   * `name` itself when it is free, otherwise the first free `name (n)` variant.
   * Used by upload, where the spec calls for silently keeping both files rather
   * than making the user resolve every collision by hand.
   */
  async resolveAvailableName(
    parentId: string,
    name: string,
    client: QueryClient = this.prisma,
  ): Promise<string> {
    const { base, extension } = splitName(name);
    const taken = await this.takenNames(parentId, base, extension, client);

    // At most `taken.size` names are unavailable, so one of these
    // `taken.size + 1` distinct candidates is guaranteed to be free.
    for (let index = 0; index <= taken.size; index += 1) {
      const candidate = buildSuffixedName(base, extension, index);
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }

    throw new Error(`Could not find an available name for "${name}"`);
  }

  /** Lowercased sibling names that could block `base (n)extension`. */
  private async takenNames(
    parentId: string,
    base: string,
    extension: string,
    client: QueryClient,
  ): Promise<Set<string>> {
    const exact = `${base}${extension}`.toLowerCase();
    const suffixed = `${escapeLikePattern(base.toLowerCase())} (%)${escapeLikePattern(extension.toLowerCase())}`;

    const rows = await client.$queryRaw<NodeNameRow[]>`
      SELECT "name"
      FROM "Node"
      WHERE "parentId" = ${parentId}
        AND (lower("name") = ${exact} OR lower("name") LIKE ${suffixed} ESCAPE '\\')
    `;

    return new Set(rows.map((row) => row.name.toLowerCase()));
  }
}
