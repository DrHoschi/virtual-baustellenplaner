// playwright.config.js
// Version: v1.0.0 (2026-02-08)
//
// Minimaler Playwright-Setup für CI:
// - Startet einen Node Static Server (scripts/static-server.mjs)
// - Führt UI-Wiring Tests aus

import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.PW_PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 10000 },

  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    // Bei Fehlern helfen Trace/Screenshot ungemein
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },

  webServer: {
    command: `node scripts/static-server.mjs --port ${PORT} --root .`,
    url: BASE_URL,
    reuseExistingServer: !!process.env.CI ? false : true,
    timeout: 30000
  }
});
