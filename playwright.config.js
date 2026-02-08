// playwright.config.js
// Version: v1.2.0-esm-final (2026-02-08)
//
// WICHTIG:
// - Repo nutzt `"type": "module"`
// - Deshalb MUSS diese Config ESM sein
// - KEIN module.exports, KEIN require

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'tests',
  timeout: 30_000,
  retries: 0,

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    baseURL: 'http://localhost:3000',
  },

  reporter: [['list']],
};

export default config;
