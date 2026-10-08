/**
 * core/persist/app-persist.js
 * Version: v1.2.2-clean-manual-save-reasoned (2026-05-23)
 *
 * Zentrale Persistenz-Schicht für den Baustellenplaner (Browser-only).
 *
 * WICHTIG:
 * - KEINE projectAssets-Migration mehr hier.
 * - Migration läuft zentral im Loader.
 * - Persistor ist nur noch für Load/Save/Autosave zuständig.
 */

import { normalizeProject } from "../project-normalize.js";

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function safeJsonStringify(obj) {
  try { return JSON.stringify(obj); } catch { return null; }
}

/* ============================================================================
 * PERSISTOR
 * ========================================================================== */

export function createAppPersistor({ bus, store, projectId }) {
  const key = `baustellenplaner:project:${projectId || "unknown"}`;

  let unsub = null;
  let t = null;

  /* --------------------------------------------------------------------------
   * LOAD
   * -------------------------------------------------------------------------- */

  function load() {
    const raw = localStorage.getItem(key);
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;

    if (parsed.project && typeof parsed.project === "object") {
      parsed.project = normalizeProject(parsed.project);
    }

    return parsed;
  }

  /* --------------------------------------------------------------------------
   * SAVE (sofort)
   * -------------------------------------------------------------------------- */

  function saveNow(reason = "manual") {
    if (!store) return false;

    const app = store.get("app");
    if (!app || typeof app !== "object") return false;

    const normalizedProject = normalizeProject(app.project || {});

    const payload = {
      project: normalizedProject,
      settings: (() => {
        const s = (app.settings && typeof app.settings === "object") ? { ...app.settings } : {};
        // BP 2.0: projectAssets gehören ausschließlich ins Projekt (app.project.projectAssets).
        // In settings sind sie eine gefährliche Doppelquelle.
        if (s.projectAssets) delete s.projectAssets;
        return s;
      })(),
      ui: {
        drafts: (app.ui && app.ui.drafts) ? app.ui.drafts : {},
        assetlab: (app.ui && app.ui.assetlab) ? app.ui.assetlab : undefined
      },
      _meta: {
        savedAt: new Date().toISOString(),
        projectId: projectId || "unknown"
      }
    };

    const txt = safeJsonStringify(payload);
    if (!txt) return false;

    localStorage.setItem(key, txt);

    if (bus) {
      bus.emit("cb:persist:saved", {
        key,
        meta: { ...payload._meta, reason }
      });
    }

    return true;

    // WICHTIG: Kein store.set() nach dem Speichern.
    // -----------------------------------------------------------------------
    // Alter Stand:
    //   saveNow() -> syncProjectRoot() -> store.set("project")/store.set("app")
    // Das hat bei manuellem Speichern erneut cb:store:changed ausgelöst.
    // In Kombination mit Workarea/Debug-Snapshot/Save-Manager konnte Safari
    // dadurch direkt nach dem Speichern wieder in eine schwere Render-/Save-
    // Kette laufen.
    //
    // Der Persistor ist ab jetzt reine IO-Schicht:
    //   Store lesen -> Payload normalisieren -> localStorage schreiben -> saved melden.
    // Root-Sync/Migration passiert im Loader beim Laden und nicht als Feedback-
    // Schleife nach jedem Save.
  }

  /* --------------------------------------------------------------------------
   * AUTOSAVE
   * -------------------------------------------------------------------------- */

  function scheduleSave() {
    if (t) clearTimeout(t);
    t = setTimeout(() => saveNow("autosave:store-changed"), 300);
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

  return {
    key,
    load,
    saveNow,
    enableAutosave,
    disableAutosave
  };
}
