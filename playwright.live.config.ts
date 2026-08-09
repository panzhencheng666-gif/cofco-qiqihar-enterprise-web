import { defineConfig, devices } from "@playwright/test";

const backendTarget = "http://127.0.0.1:63183";

const accounts = [
  [63184, "e2e-operator-one"],
  [63185, "e2e-operator-two"],
  [63186, "e2e-reviewer"],
  [63187, "e2e-reporter"],
  [63188, "e2e-publisher"],
] as const;

export default defineConfig({
  testDir: "./e2e/live",
  testMatch: "**/*.e2e.ts",
  globalTeardown: "./e2e/live/global-teardown.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  outputDir: "test-results/live",
  use: {
    baseURL: `http://127.0.0.1:${accounts[0][0]}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/live/start-backend.mjs",
      url: "http://127.0.0.1:63189/health",
      reuseExistingServer: false,
      timeout: 240000,
    },
    ...accounts.map(([port, actor]) => ({
      command: `npm run preview -- --config vite.live-e2e.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
      url: `http://127.0.0.1:${port}`,
      env: {
        LIVE_E2E_ACTOR: actor,
        LIVE_E2E_API_TARGET: backendTarget,
      },
      reuseExistingServer: false,
      timeout: 120000,
    })),
  ],
});
