// playwright.config.mjs
// Version: v1.0.0-esm (2026-02-08)
//
// Minimal-Config für CI (ESM-safe)
// Läuft sauber mit: npx -y @playwright/test test

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'tests',
  timeout: 30_000,
  retries: 0,

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
};

export default config;
