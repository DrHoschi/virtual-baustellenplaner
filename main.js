/**
 * main.js
 * Version: v1.0.1-hardcut-modular-crash-recorder-optional (2026-05-18)
 *
 * HARD-CUT:
 * - main.js ist ab jetzt NUR noch der Bootstrap.
 * - Keine manuellen Module, keine inline Project-Daten, keine UI/Router-Logik.
 * - Alles läuft über: core/loader.js → project.json → defaults → plugins → modules.
 *
 * Patch-Hinweis:
 * - Der Crash-Recorder wird absichtlich NICHT statisch importiert.
 * - Grund: Wenn core/crash-recorder.js beim Hochladen/Commit vergessen wird,
 *   soll der Import-Graph-Check nicht hart abbrechen und die App bekommt einen
 *   kleinen Noop-/Fallback-Recorder.
 */

import { startApp } from "./core/loader.js";

function createFallbackCrashRecorder() {
  const events = [];
  const max = 80;

  const api = {
    log(event, data = null) {
      try {
        events.push({
          t: new Date().toISOString(),
          event: String(event || "event"),
          data: data && typeof data === "object" ? data : (data == null ? null : { value: String(data) })
        });
        while (events.length > max) events.shift();
      } catch {}
      return null;
    },
    text() {
      try {
        return [
          "Baustellenplaner Crash Recorder Fallback",
          `Export: ${new Date().toISOString()}`,
          `Events: ${events.length}`,
          "",
          ...events.map((e, i) => `${String(i + 1).padStart(3, "0")} ${e.t} ${e.event} ${JSON.stringify(e.data || {})}`)
        ].join("\n");
      } catch {
        return "Baustellenplaner Crash Recorder Fallback: export failed";
      }
    },
    async copy() {
      const txt = api.text();
      try {
        await navigator.clipboard.writeText(txt);
        return true;
      } catch {
        return false;
      }
    },
    showInSnapshot() {
      const txt = api.text();
      try {
        const pre = document.querySelector("#snapshot");
        if (pre) pre.textContent = txt;
      } catch {}
      return txt;
    },
    sizeOf(value) {
      try { return new Blob([JSON.stringify(value)]).size; } catch {}
      try { return JSON.stringify(value).length; } catch {}
      return 0;
    }
  };

  return api;
}

async function initOptionalCrashRecorder() {
  let crashRecorder = createFallbackCrashRecorder();
  window.BP_CRASH_RECORDER = crashRecorder;

  try {
    const mod = await import("./core/crash-recorder.js");
    if (mod?.initCrashRecorder) {
      crashRecorder = mod.initCrashRecorder({ max: 220 }) || crashRecorder;
      window.BP_CRASH_RECORDER = crashRecorder;
      crashRecorder?.log?.("crash-recorder:ready", { mode: "module" });
    }
  } catch (e) {
    crashRecorder?.log?.("crash-recorder:optional-import-failed", {
      message: e?.message || String(e)
    });
    console.warn("[Baustellenplaner] Optionaler Crash-Recorder konnte nicht geladen werden:", e);
  }

  return crashRecorder;
}

async function main() {
  const crashRecorder = await initOptionalCrashRecorder();

  // Standard-Projekt (kannst du später über Query-Param ?project=... überschreiben)
  const DEFAULT_PROJECT_PATH = "projects/P-2026-0001/project.json";

  // Optionaler Query-Override: /?project=projects/P-2026-0002/project.json
  const params = new URLSearchParams(location.search);
  const projectPath = params.get("project") || DEFAULT_PROJECT_PATH;

  crashRecorder?.log?.("app:start", { projectPath });

  try {
    await startApp({ projectPath });
  } catch (err) {
    crashRecorder?.log?.("app:startApp:failed", { message: err?.message || String(err), stack: err?.stack || null });
    console.error("[Baustellenplaner] startApp failed:", err);
    const pre = document.querySelector("#snapshot");
    if (pre) {
      pre.textContent = String(err?.stack || err);
    }
  }
}

main();
