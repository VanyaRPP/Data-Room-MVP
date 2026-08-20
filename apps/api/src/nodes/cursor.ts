import { BadRequestException } from '@nestjs/common';

/**
 * The position of the last row of a page, in that listing's exact sort order.
 *
 * Shared by the folder listing and by search: both order by a rank, then a
 * lowercased name, then id, so both resume from the same three values.
 */
export interface KeysetCursor {
  rank: number;
  name: string;
  id: string;
}

export function encodeCursor(cursor: KeysetCursor): string {
  return Buffer.from(
    JSON.stringify([cursor.rank, cursor.name, cursor.id]),
  ).toString('base64url');
}

export function decodeCursor(raw: string): KeysetCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('Invalid cursor');
  }

  if (
    Array.isArray(parsed) &&
    parsed.length === 3 &&
    typeof parsed[0] === 'number' &&
    typeof parsed[1] === 'string' &&
    typeof parsed[2] === 'string'
  ) {
    return { rank: parsed[0], name: parsed[1], id: parsed[2] };
  }

  throw new BadRequestException('Invalid cursor');
}

/** Escapes LIKE wildcards so a name containing `%` or `_` matches literally. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
