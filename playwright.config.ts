import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:63180",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node e2e/support/api-server.mjs",
      url: "http://127.0.0.1:63181/health",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "npm run preview:e2e",
      url: "http://127.0.0.1:63180",
      env: {
        E2E_API_TARGET: "http://127.0.0.1:63181",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
