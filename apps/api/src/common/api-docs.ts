import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

/**
 * The schema type the decorators accept, taken from their own signature.
 * @nestjs/swagger keeps SchemaObject behind its package exports, and reaching
 * past those would break the moment the package rearranges its build.
 */
type SwaggerSchema = Extract<
  Parameters<typeof ApiResponse>[0],
  { schema: unknown }
>['schema'];

/**
 * Documentation generated from the zod schemas that already validate the
 * requests, rather than from a parallel set of decorated classes.
 *
 * Duplicating every DTO as a class purely to describe it would leave two
 * definitions of the same shape free to drift apart, and the one in the docs
 * is the one nobody would notice going stale.
 */
function toOpenApi(schema: ZodType, io: 'input' | 'output'): SwaggerSchema {
  const json = z.toJSONSchema(schema, {
    io,
    // A few rules - cross-field checks, for instance - have no JSON Schema
    // equivalent. Describe the rest rather than refusing to describe anything.
    unrepresentable: 'any',
  }) as Record<string, unknown>;

  // OpenAPI carries its own version; a nested $schema only confuses tooling.
  delete json.$schema;
  return json;
}

/** Documents a JSON request body from the schema that validates it. */
export function ApiZodBody(schema: ZodType): MethodDecorator {
  return ApiBody({ schema: toOpenApi(schema, 'input') });
}

/**
 * Documents query parameters from the schema that validates them, one entry
 * per property so they render as individual fields rather than one blob.
 */
export function ApiZodQuery(schema: ZodType): MethodDecorator {
  const json = toOpenApi(schema, 'input') as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const required = new Set(json.required ?? []);

  return applyDecorators(
    ...Object.entries(json.properties ?? {}).map(([name, property]) =>
      ApiQuery({
        name,
        required: required.has(name),
        schema: property as SwaggerSchema,
      }),
    ),
  );
}

export function ApiZodResponse(
  status: number,
  schema: ZodType,
  description?: string,
): MethodDecorator {
  return ApiResponse({
    status,
    description,
    schema: toOpenApi(schema, 'output'),
  });
}

export function ApiZodArrayResponse(
  status: number,
  schema: ZodType,
  description?: string,
): MethodDecorator {
  return ApiResponse({
    status,
    description,
    schema: { type: 'array', items: toOpenApi(schema, 'output') },
  });
}
