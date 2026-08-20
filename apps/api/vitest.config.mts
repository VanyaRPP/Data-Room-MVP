import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only: services are constructed directly with stubbed
    // collaborators, so no Nest DI container and no database are involved.
    include: ["src/**/*.spec.ts"],
    environment: "node",
  },
});
