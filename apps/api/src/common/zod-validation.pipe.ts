import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType, z } from 'zod';

/**
 * Validates and transforms a single param (body/query/param) against a zod
 * schema. Used as `@Body(zodPipe(schema))` etc. rather than a global pipe so
 * each handler is explicit about which schema applies to which input.
 *
 * Chosen over nestjs-zod to avoid coupling to its zod version support and to
 * keep full control over the error message shape (spec: unified
 * { statusCode, error, message }).
 */
export function zodPipe<TSchema extends ZodType>(
  schema: TSchema,
): PipeTransform<unknown, z.infer<TSchema>> {
  return {
    transform(value: unknown): z.infer<TSchema> {
      const result = schema.safeParse(value);
      if (!result.success) {
        const message = result.error.issues
          .map((issue) =>
            issue.path.length
              ? `${issue.path.join('.')}: ${issue.message}`
              : issue.message,
          )
          .join('; ');
        throw new BadRequestException(message);
      }
      return result.data;
    },
  };
}
