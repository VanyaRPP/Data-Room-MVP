import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the API will ever need, validated once at boot
 * so misconfiguration fails fast with a clear message instead of surfacing
 * as a confusing runtime error deep in a request handler.
 *
 * Plain z.object (not strictObject): process.env always carries dozens of
 * ambient OS/shell variables beyond the ones we declare, and that's fine -
 * unlike request DTOs, extra keys here aren't a validation concern.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Neon needs a separate non-pooled URL for migrations; local docker-compose
  // Postgres has no pooler, so DATABASE_URL and DIRECT_URL are the same value there.
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url().optional(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_BUCKET: z.string().min(1),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  DIRECT_URL: parsed.DIRECT_URL ?? parsed.DATABASE_URL,
};

export type Env = typeof env;
