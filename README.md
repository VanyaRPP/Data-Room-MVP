# Data Room

A due diligence data room: folders, PDF files, upload with progress, an in-browser
viewer, rename/move/delete, and sharing via public link or per-user access grants.

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query |
| Backend | NestJS 11, Prisma, PostgreSQL |
| Storage | Supabase Storage (presigned URLs) |
| Auth | Email/password (argon2id) + JWT in an httpOnly cookie |
| Validation | zod, shared end-to-end via `packages/shared` |

## Setup locally

Prerequisites: Node 22+, [pnpm](https://pnpm.io) (`corepack enable`), Docker Desktop.

```bash
# 1. Start local Postgres
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Copy env files and fill in the blanks (see comments in each file)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4. Run both apps
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000 (proxied through the web app at `/api/*`, see
  "Design decisions" below)

### Verifying the setup

```bash
pnpm typecheck && pnpm lint && pnpm build
```

`GET http://localhost:3000/api/health` should return `{"status":"ok",...}`.

## Design decisions

_Filled in as each part of the system is built._

- **Same-origin API via Next.js rewrite, not CORS.** `next.config.ts` proxies
  `/api/*` to the NestJS server. The browser only ever talks to the Next.js
  origin, so the session cookie can be `SameSite=Lax` with zero CORS
  configuration, which also closes off the usual CSRF surface.

## How it scales

_Written once the relevant parts of the system exist — see the project spec's
three scaling questions (subtree size/count, 100k files, viewer/editor roles)._

## AI usage

<!-- TODO: author to fill in personally. -->

## What I'd do next

_Filled in during the final polish pass._
