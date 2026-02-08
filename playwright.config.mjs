// playwright.config.mjs
// Version: v1.2.0-ci-stable
// ESM-only (package.json: "type": "module")

export default {
  testDir: 'tests',
  timeout: 30_000,
  retries: 0,

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    baseURL: 'http://localhost:3000',
  },

  // 🔥 DAS ist der entscheidende Teil
  webServer: {
    command: 'npx serve . -l 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 30_000,
  },
};
