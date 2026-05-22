// playwright.config.mjs
// Version: v1.0.0 (2026-02-08)
//
// WICHTIG:
// - Dein Repo hat `"type": "module"` in package.json.
// - Dadurch ist `playwright.config.mjs` automatisch ESM.
// - Also: `export default` statt `module.exports`.

// Die MJS-Konfiguration importiert die vollständige Konfiguration aus der
// `playwright.config.js`. Diese Datei definiert einen Static-Server mit
// baseURL und verhindert damit Navigationsfehler wie
// "Cannot navigate to invalid URL" in den Tests. Wenn Playwright diese
// Datei läd, wird die JS-Konfiguration wiederverwendet.

import config from "./playwright.config.js";

export default config;
