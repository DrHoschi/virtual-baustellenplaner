/**
 * main.js
 * Version: v1.0.0-hardcut-modular (2026-02-04)
 *
 * HARD-CUT:
 * - main.js ist ab jetzt NUR noch der Bootstrap.
 * - Keine manuellen Module, keine inline Project-Daten, keine UI/Router-Logik.
 * - Alles läuft über: core/loader.js → project.json → defaults → plugins → modules.
 */

import { startApp } from "./core/loader.js";

// Standard-Projekt (kannst du später über Query-Param ?project=... überschreiben)
const DEFAULT_PROJECT_PATH = "projects/P-2026-0001/project.json";

// Optionaler Query-Override: /?project=projects/P-2026-0002/project.json
const params = new URLSearchParams(location.search);
const projectPath = params.get("project") || DEFAULT_PROJECT_PATH;

startApp({ projectPath }).catch((err) => {
  console.error("[Baustellenplaner] startApp failed:", err);
  const pre = document.querySelector("#snapshot");
  if (pre) {
    pre.textContent = String(err?.stack || err);
  }
});
