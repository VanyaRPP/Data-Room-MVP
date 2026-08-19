import { Prisma } from '@prisma/client';

/**
 * True for a unique-constraint violation, whether Prisma caught it against a
 * declarative `@unique`/`@@unique` (P2002) or it came back from a raw SQL
 * statement hitting a constraint Prisma doesn't know about - like the
 * case-insensitive sibling-name index, which only exists as raw SQL because
 * Prisma's schema language can't express a functional index (see the raw
 * SQL appended to the init migration). Postgres reports that case as a
 * P2010 "raw query failed" wrapping SQLSTATE 23505.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2002') return true;
  if (error.code === 'P2010' && error.meta?.code === '23505') return true;
  return false;
}
