/**
 * core/persist/app-persist.js
 * Version: v1.2.0-clean-centralized-migration (2026-02-25)
 *
 * Zentrale Persistenz-Schicht für den Baustellenplaner (Browser-only).
 *
 * WICHTIG:
 * - KEINE projectAssets-Migration mehr hier.
 * - Migration läuft zentral im Loader.
 * - Persistor ist nur noch für Load/Save/Autosave zuständig.
 */

import { normalizeProject } from "../project-normalize.js";
import { syncProjectRoot } from "../project-sync.js";

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

  function saveNow() {
    if (!store) return;

    const app = store.get("app");
    if (!app || typeof app !== "object") return;

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
    if (!txt) return;

    localStorage.setItem(key, txt);

    if (bus) {
      bus.emit("cb:persist:saved", {
        key,
        meta: payload._meta
      });
    }

    // Root-Spiegelung nachziehen
    try {
      const state = {
        project: store.get("project"),
        app: store.get("app")
      };

      syncProjectRoot(state);

      store.set("project", state.project);
      store.set("app", state.app);
    } catch {
      // bewusst still
    }
  }

  /* --------------------------------------------------------------------------
   * AUTOSAVE
   * -------------------------------------------------------------------------- */

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

  return {
    key,
    load,
    saveNow,
    enableAutosave,
    disableAutosave
  };
}
