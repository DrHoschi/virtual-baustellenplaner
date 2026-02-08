// playwright.config.mjs
// Version: v1.2.1-ci-debug-standard (2026-02-08)
//
// Repo ist ESM -> .mjs ist eindeutig und stressfrei.
// Startet selbst einen Static Server, damit page.goto('/index.html') in CI funktioniert.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  webServer: {
    command: "npx -y http-server@14 . -p 3000 -a 127.0.0.1 -c-1",
    url: "http://127.0.0.1:3000/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
