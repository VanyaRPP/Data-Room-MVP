import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Postgres bigint columns (Node.size) and raw CTE aggregates come back from
 * Prisma as JS `bigint`, which JSON.stringify cannot serialize and throws on.
 * This is the single choke point that makes that impossible: every response
 * body is round-tripped through a replacer that stringifies bigints. DTOs
 * declare the corresponding fields as `string`, matching what actually goes
 * over the wire.
 */
@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => serializeBigInts(data)));
  }
}

function serializeBigInts(data: unknown): unknown {
  if (data === undefined) return data;
  const json = JSON.stringify(data, (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  return JSON.parse(json) as unknown;
}
