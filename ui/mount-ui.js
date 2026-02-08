// ui/mount-ui.js
// Version: v1.0.0 (2026-02-08)
//
// Zweck:
// - Kompatibilitäts-Entry für ältere Stände / alte index.html,
//   die noch `./ui/mount-ui.js` laden.
// - Delegiert vollständig an `core/loader.js`.
//
// Hinweis:
// - Dieser Einstieg macht KEINE eigene UI-Logik.
// - Wenn du inzwischen `index.html` mit `import { startApp } from './core/loader.js'` nutzt,
//   ist diese Datei optional – sie verhindert aber 404er und "Import Graph" Fehler.

import { startApp } from "../core/loader.js";

// Auto-Start (wie früher), aber nur wenn die Seite nicht schon gestartet wurde.
if (!window.__BP_APP_STARTED__) {
  window.__BP_APP_STARTED__ = true;
  startApp();
}

// Export, damit andere Module (oder Tests) gezielt starten können.
export { startApp };
