/**
 * core/persist/app-persist.js
 * Version: v1.0.0-hardcut-modular-v3.2 (2026-02-04)
 *
 * Zentrale Persistenz-Schicht für den Baustellenplaner (Browser-only).
 *
 * Motivation:
 * - In GitHub Pages / Static Hosting kann project.json nicht "überschrieben" werden.
 * - Trotzdem müssen Änderungen im Editor (Panels) über Tab-Wechsel & Reload erhalten bleiben.
 *
 * Lösung:
 * - Wir persistieren den relevanten App-State (app.project + app.settings) in localStorage.
 * - Key ist projektbezogen: "baustellenplaner:project:<projectId>"
 *
 * Wichtig:
 * - Das ist KEIN Export in eine Datei. Export kommt separat (Download project.json).
 */

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function safeJsonStringify(obj) {
  try { return JSON.stringify(obj); } catch { return null; }
}

export function createAppPersistor({ bus, store, projectId }) {
  const key = `baustellenplaner:project:${projectId || "unknown"}`;

  let unsub = null;
  let t = null;

  function load() {
    const raw = localStorage.getItem(key);
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  }

  function saveNow() {
    if (!store) return;
    const app = store.get("app");
    if (!app || typeof app !== "object") return;

    const payload = {
      // --------------------------------------------------------
      // Wir persistieren bewusst nur, was der Editor verändern darf.
      //
      // Neu (v1.1.x): zusätzlich UI-Drafts, damit Wizard/Forms
      // auch nach Tab-Wechsel oder Reload stabil bleiben.
      // --------------------------------------------------------
      project: app.project || {},
      settings: app.settings || {},
      ui: {
        // Nur Drafts persistieren (keine DOM-States)
        drafts: (app.ui && app.ui.drafts) ? app.ui.drafts : {}
      },
      _meta: {
        savedAt: new Date().toISOString(),
        projectId: projectId || "unknown"
      }
    };

    const txt = safeJsonStringify(payload);
    if (!txt) return;
    localStorage.setItem(key, txt);
    if (bus) bus.emit("cb:persist:saved", { key, meta: payload._meta });
  }

  function scheduleSave() {
    if (t) clearTimeout(t);
    t = setTimeout(() => saveNow(), 300);
  }

  function enableAutosave() {
    if (!bus) return;
    if (unsub) return;

    unsub = bus.on("cb:store:changed", ({ key: changedKey }) => {
      if (changedKey !== "app") return;
      scheduleSave();
    });
  }

  function disableAutosave() {
    if (unsub) {
      unsub();
      unsub = null;
    }
    if (t) {
      clearTimeout(t);
      t = null;
    }
  }

  return { key, load, saveNow, enableAutosave, disableAutosave };
}
