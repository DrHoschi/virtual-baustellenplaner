// playwright.config.mjs
// Version: v1.2.0-ci-webserver-baseurl (2026-02-08)
//
// Ziel:
// - CI: garantiert einen Static-Server starten (webServer)
// - baseURL ist konsistent (Tests dürfen mit /index.html oder index.html navigieren)
// - Trace/Video/Screenshots bei Failure für Debug
//
// Hinweis:
// - Wir nutzen scripts/static-server.mjs (liegt im Repo) statt "http-server".
//
// Doku:
// - webServer startet automatisch VOR den Tests und stoppt danach.
// - reuseExistingServer: lokal schnell, CI immer neu.

import { defineConfig } from "playwright/test";

const PORT = Number(process.env.PW_PORT || 4173);
const HOST = process.env.PW_HOST || "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,

  // CI: nicht parallelisieren, lokal ok
  workers: process.env.CI ? 1 : undefined,

  // Sauberer Output in CI
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    // ✅ WICHTIG: damit page.goto("/index.html") oder page.goto("index.html") gültig ist
    baseURL: BASE_URL,

    // Bei Failure: direkt Artefakte
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // ✅ Server wird vor den Tests gestartet
  webServer: {
    command: `node scripts/static-server.mjs --port ${PORT} --root .`,
    url: `${BASE_URL}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
