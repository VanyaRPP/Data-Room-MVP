import { defineConfig } from "@playwright/test";

const WEB_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // One happy path, run start to finish: it shares a database with whatever
  // else is running, so parallel copies would fight over the same demo data.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
  },
  webServer: {
    // Brings up the API and the web app together. A dev stack already running
    // locally is reused rather than fought with.
    command: "pnpm dev",
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
