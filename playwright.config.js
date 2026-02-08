// playwright.config.mjs
// Version: v1.0.0 (2026-02-08)
//
// WICHTIG:
// - Dein Repo hat `"type": "module"` in package.json.
// - Dadurch ist `playwright.config.mjs` automatisch ESM.
// - Also: `export default` statt `module.exports`.

export default {
  testDir: "tests",
  timeout: 60_000,
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
};
