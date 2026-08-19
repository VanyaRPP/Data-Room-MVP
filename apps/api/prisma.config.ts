import "dotenv/config";
import { defineConfig } from "prisma/config";

// Connection URLs stay in schema.prisma's own datasource block (env-driven)
// so there is exactly one place that defines how Prisma reaches the
// database; this file only configures CLI behavior around that.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
