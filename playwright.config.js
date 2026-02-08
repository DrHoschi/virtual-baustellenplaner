// playwright.config.js
// Minimal-config für CI mit npx playwright (ohne package.json)

module.exports = {
  testDir: "tests",
  timeout: 30_000,
  retries: 0,

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
};
