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
import { initCrashRecorder } from "./core/crash-recorder.js";

// Crash-/Reload-Recorder sehr frueh starten, damit auch Loader-Fehler erfasst werden.
const crashRecorder = initCrashRecorder({ max: 220 });

// Standard-Projekt (kannst du später über Query-Param ?project=... überschreiben)
const DEFAULT_PROJECT_PATH = "projects/P-2026-0001/project.json";

// Optionaler Query-Override: /?project=projects/P-2026-0002/project.json
const params = new URLSearchParams(location.search);
const projectPath = params.get("project") || DEFAULT_PROJECT_PATH;

crashRecorder?.log?.("app:start", { projectPath });

startApp({ projectPath }).catch((err) => {
  crashRecorder?.log?.("app:startApp:failed", { message: err?.message || String(err), stack: err?.stack || null });
  console.error("[Baustellenplaner] startApp failed:", err);
  const pre = document.querySelector("#snapshot");
  if (pre) {
    pre.textContent = String(err?.stack || err);
  }
});
