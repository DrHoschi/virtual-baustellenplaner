// playwright.config.js
// Version: v1.1.0-esm-ci (2026-02-08)
//
// Minimal & CI-stabil
// KEIN require / KEIN module.exports

export default {
  testDir: 'tests',
  timeout: 30_000,
  retries: 0,

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
};
