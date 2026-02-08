// playwright.config.js
// CI-stabile CommonJS-Config

module.exports = {
  testDir: 'tests',
  timeout: 30_000,

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    baseURL: 'http://localhost:3000',
  },

  retries: 0,
};
