/**
 * playwright.config.js
 * Version: v1.2.0-esm-webserver-ci-stable (2026-02-08)
 *
 * WICHTIG:
 * - Dein Repo ist ESM ("type": "module" in package.json).
 * - Deshalb ist auch diese Datei ESM, obwohl sie .js heißt.
 * - KEIN module.exports verwenden -> das führt zu "module is not defined".
 *
 * Ziel:
 * - CI-sicher: startet selbst einen Static Server (webServer)
 * - baseURL ist gesetzt, sodass page.goto('/index.html') funktioniert
 * - Diagnose: trace/screenshot/video bei Fehlern
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",

  // CI: lieber etwas mehr Luft – eure App lädt teils länger
  timeout: 60_000,
  expect: { timeout: 20_000 },

  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [["list"]],

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },

    // baseURL + webServer => page.goto('/index.html') ist gültig
    baseURL: "http://127.0.0.1:3000",

    // Diagnose – wenn es knallt, bekommst du verwertbare Artefakte:
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  /**
   * Static Server für euer Repo-Root:
   * - Wir serven einfach das Repo als statische Seite,
   *   damit /index.html erreichbar ist.
   *
   * - "-c-1" = keine Cache-Header (wichtig bei Debug/CI)
   * - "reuseExistingServer" lokal true, in CI false
   */
  webServer: {
    command: "npx -y http-server@14 . -p 3000 -a 127.0.0.1 -c-1",
    url: "http://127.0.0.1:3000/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
