/**
 * core/persist/app-persist.js
 * Version: v1.1.0-lifecycle-normalize-sync (2026-02-15)
 *
 * Zentrale Persistenz-Schicht für den Baustellenplaner (Browser-only).
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
 * CENTRAL MIGRATION: projectAssets Drift stoppen (LOAD + SAVE)
 * ========================================================================== */

function __bp_isObj(x) { return !!x && typeof x === "object"; }
function __bp_arr(v) { return Array.isArray(v) ? v : []; }
function __bp_str(v) { return (typeof v === "string") ? v : ""; }

function __bp_scoreProjectAssets(list) {
  const arr = __bp_arr(list);
  let score = 0;
  score += arr.length * 10;

  for (const pa of arr) {
    const slots = __bp_arr(pa?.slots);
    score += slots.length * 2;
    for (const s of slots) {
      if (s?.hasModel === true) score += 20;
      if (__bp_str(s?.lastImportName).trim()) score += 10;
      if (__bp_str(s?.updatedAt).trim()) score += 2;
      if (__bp_str(s?.lastAction).toLowerCase().includes("import")) score += 1;
      if (s?.exportRef) score += 5;
      if (s?.model) score += 5;
    }
  }
  return score;
}

function __bp_firstSlotId(pa) {
  const slots = __bp_arr(pa?.slots);
  return slots[0]?.id || null;
}

function __bp_hasAssetId(list, id) {
  return __bp_arr(list).some((a) => a && a.id === id);
}

function __bp_migrateProjectAssets({ project, app }) {
  const proj = __bp_isObj(project) ? project : {};
  const a = __bp_isObj(app) ? app : {};

  const candA = __bp_arr(proj.projectAssets);
  const candB = __bp_arr(a?.project?.projectAssets);
  const candC = __bp_arr(a?.settings?.projectAssets);

  const scored = [
    { key: "project.projectAssets", list: candA, score: __bp_scoreProjectAssets(candA) },
    { key: "app.project.projectAssets", list: candB, score: __bp_scoreProjectAssets(candB) },
    { key: "app.settings.projectAssets", list: candC, score: __bp_scoreProjectAssets(candC) },
  ].sort((x, y) => y.score - x.score);

  const best = scored[0];
  const canonical = (best?.list && best.list.length) ? best.list : candA;

  proj.projectAssets = canonical;

  a.project = __bp_isObj(a.project) ? a.project : {};
  a.settings = __bp_isObj(a.settings) ? a.settings : {};
  a.project.projectAssets = canonical;
  a.settings.projectAssets = canonical;

  // AssetLab context härten
  try {
    const ctx = a?.ui?.assetlab?.context;
    if (ctx && (ctx.projectAssetId || ctx.slotId)) {
      const wantAssetId = ctx.projectAssetId;
      const wantSlotId = ctx.slotId;

      if (wantAssetId && !__bp_hasAssetId(canonical, wantAssetId)) {
        if (canonical.length === 1 && canonical[0]?.id) {
          ctx.projectAssetId = canonical[0].id;
          ctx.slotId = __bp_firstSlotId(canonical[0]);
        } else {
          ctx.projectAssetId = null;
          ctx.slotId = null;
        }
      } else if (wantAssetId && wantSlotId) {
        const asset = __bp_arr(canonical).find((x) => x && x.id === wantAssetId) || null;
        const slots = __bp_arr(asset?.slots);
        const slotExists = slots.some((s) => s && s.id === wantSlotId);
        if (!slotExists) ctx.slotId = __bp_firstSlotId(asset);
      }
    }
  } catch {
    // non-fatal
  }

  return { project: proj, app: a, report: { chosenFrom: best?.key || "project.projectAssets" } };
}

/* ============================================================================
 * PERSISTOR
 * ========================================================================== */

export function createAppPersistor({ bus, store, projectId }) {
  const key = `baustellenplaner:project:${projectId || "unknown"}`;

  let unsub = null;
  let t = null;

  function load() {
    const raw = localStorage.getItem(key);
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;

    // ✅ Migration beim Laden (bevor normalizeProject)
    try {
      const appCandidate = { project: parsed.project || {}, settings: parsed.settings || {}, ui: parsed.ui || {} };
      const migrated = __bp_migrateProjectAssets({ project: parsed.project || {}, app: appCandidate });
      parsed.project = migrated.project;
      parsed.settings = migrated.app.settings || parsed.settings || {};
      parsed.ui = migrated.app.ui || parsed.ui || {};
    } catch {
      // non-fatal
    }

    if (parsed.project && typeof parsed.project === "object") {
      parsed.project = normalizeProject(parsed.project);
    }
    return parsed;
  }

  function saveNow() {
    if (!store) return;
    const app = store.get("app");
    if (!app || typeof app !== "object") return;

    // ✅ Migration beim Speichern (drift kill)
    try {
      const migrated = __bp_migrateProjectAssets({ project: app.project || {}, app });
      store.set("app", migrated.app);
      store.set("project", migrated.project);
    } catch {
      // non-fatal
    }

    const app2 = store.get("app");

    const normalizedProject = normalizeProject(app2.project || {});

    const payload = {
      project: normalizedProject,
      settings: app2.settings || {},
      ui: {
        drafts: (app2.ui && app2.ui.drafts) ? app2.ui.drafts : {},
        // Wichtig für AssetLab-Reload/Restore:
        assetlab: (app2.ui && app2.ui.assetlab) ? app2.ui.assetlab : undefined
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

    // Mirror-Regel nachziehen
    try {
      const state = { project: store.get("project"), app: store.get("app") };
      syncProjectRoot(state);
      store.set("project", state.project);
      store.set("app", state.app);
    } catch {
      // bewusst still
    }
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
