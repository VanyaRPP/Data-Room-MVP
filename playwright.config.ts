import { defineConfig } from "@playwright/test";

// Point at a deployment to smoke-test it: E2E_BASE_URL=https://... pnpm test:e2e
// Without it the suite runs against a local dev stack it starts itself.
const DEPLOYED_URL = process.env.E2E_BASE_URL;
const WEB_URL = DEPLOYED_URL ?? "http://localhost:3000";

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
  webServer: DEPLOYED_URL
    ? undefined
    : {
        // Brings up the API and the web app together. A dev stack already
        // running locally is reused rather than fought with.
        command: "pnpm dev",
        url: WEB_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
