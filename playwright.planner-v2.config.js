import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PW_PLANNER_V2_PORT || 4174);
const HOST = process.env.PW_HOST || "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/static-server.mjs --port ${PORT} --root .`,
    url: `${BASE_URL}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
