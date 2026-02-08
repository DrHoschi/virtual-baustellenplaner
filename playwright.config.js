// playwright.config.js  (ESM, wenn package.json: "type":"module")
export default {
  testDir: "tests",
  timeout: 30_000,
  retries: 0,
  use: { headless: true, viewport: { width: 1280, height: 800 } },
};
