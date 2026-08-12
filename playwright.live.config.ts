import { defineConfig, devices } from "@playwright/test";

const backendTarget = "http://127.0.0.1:63183";

const previews = [
  { port: 63184, actor: "e2e-operator-one", target: backendTarget },
  { port: 63185, actor: "e2e-operator-two", target: backendTarget },
  { port: 63186, actor: "e2e-reviewer", target: backendTarget },
  { port: 63187, actor: "e2e-reporter", target: backendTarget },
  { port: 63188, actor: "e2e-publisher", target: backendTarget },
  { port: 63190, actor: "e2e-outside-operator", target: backendTarget },
  { port: 63191, authMode: "anonymous", target: backendTarget },
  {
    port: 63192,
    actor: "e2e-operator-one",
    target: "http://127.0.0.1:63199",
  },
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
    baseURL: `http://127.0.0.1:${previews[0].port}`,
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
    ...previews.map((preview) => ({
      command: `npm run preview -- --config vite.live-e2e.config.ts --host 127.0.0.1 --port ${preview.port} --strictPort`,
      url: `http://127.0.0.1:${preview.port}`,
      env: {
        ...("actor" in preview ? { LIVE_E2E_ACTOR: preview.actor } : {}),
        LIVE_E2E_AUTH_MODE: "authMode" in preview ? preview.authMode : "fixed",
        LIVE_E2E_API_TARGET: preview.target,
      },
      reuseExistingServer: false,
      timeout: 120000,
    })),
  ],
});
