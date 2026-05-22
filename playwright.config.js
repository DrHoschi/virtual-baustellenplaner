// playwright.config.js
// Version: v1.2.2-ci-webserver-baseurl-no-alias-cycle (2026-05-22)
//
// Zweck:
// - Vollständige Playwright-Konfiguration für GitHub Actions und lokale Tests.
// - Startet einen kleinen Static-Server.
// - Setzt baseURL, damit page.goto("/index.html") funktioniert.
//
// WICHTIG:
// - Diese Datei importiert NICHT playwright.config.mjs.
// - Dadurch entsteht keine Kreisreferenz und kein Fehler:
//   "Cannot access 'config' before initialization".

import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PW_PORT || 4173);
const HOST = process.env.PW_HOST || "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  retries: 1,

  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : "list",

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },

    // Damit page.goto("/index.html") eine gültige URL bekommt.
    baseURL: BASE_URL,

    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  webServer: {
    command: `node scripts/static-server.mjs --port ${PORT} --root .`,
    url: `${BASE_URL}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
