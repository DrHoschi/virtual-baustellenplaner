/**
 * Baustellenplaner – Core Loader / App Bootstrap
 * Datei: core/loader.js
 * Version: v1.2.0-browser-jsonfix-menu-wire (2026-02-09)
 *
 * Fixes (aus CI + iOS Debug):
 * - Entfernt Import-Assertions ( `import x from "*.json" assert {type:"json"}` ),
 *   weil das je nach Engine/Flags mit "Unexpected identifier 'assert'" scheitern kann.
 * - Korrigiert createStore-Aufruf: createStore({ bus }) (statt createStore(bus)).
 * - Lädt Manifest-Pack + Menü-Registry per fetch (browser-kompatibel).
 * - Verdrahtet Menü-Klicks (ui:menu:select) -> switchView.
 * - Startet mit projectPath aus index.html (Standard: projects/P-2026-0001).
 *
 * Debug/Checker bleiben drin.
 */

/* ============================================================================
 * IMPORTS
 * ========================================================================== */

import { createBus } from "../app/bus.js";
import { createStore } from "../app/store.js";
import { createRegistry } from "../app/registry.js";

import { createFeatureGate } from "./featureGate.js";
import { loadManifestPack } from "./manifest-pack.js";

// Persistenz + Daten-Härtung
import { createAppPersistor } from "./persist/app-persist.js";
import { normalizeProject } from "./project-normalize.js";

import { renderMenu } from "../app/ui/menu.js";
import { createPanelRegistry } from "../ui/panels/panel-registry.js";

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const VERSION = "v1.2.2-panel-rootel-mountfix (2026-02-09)";
const DEV = (() => {
  try {
    return !!(globalThis?.location && /localhost|127\.0\.0\.1/i.test(globalThis.location.host));
  } catch {
    return false;
  }
})();

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function $(sel) {
  return document.querySelector(sel);
}

function setActiveSubTitle(text) {
  const el = $("#active");
  if (el) el.textContent = text;
}

function safeStringify(v) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`loadJson: ${res.status} ${res.statusText} (${url})`);
  return await res.json();
}

function showFatalInView({ title, error, extra = "" }) {
  const view = $("#view");
  if (!view) return;

  const pre = document.createElement("pre");
  pre.style.whiteSpace = "pre-wrap";
  pre.style.padding = "12px";
  pre.style.border = "1px solid rgba(255,0,0,.35)";
  pre.style.background = "rgba(255,0,0,.06)";
  pre.style.borderRadius = "10px";

  const msg =
    `${title}\n` +
    `------------------------------------------------------------\n` +
    `${String(error?.message || error)}\n` +
    (error?.stack ? `\n${error.stack}\n` : "") +
    (extra ? `\n${extra}\n` : "");

  pre.textContent = msg;
  view.innerHTML = "";
  view.appendChild(pre);
}

function renderMissingPanel({ store, panelId, moduleKey, reason }) {
  const view = $("#view");
  if (!view) return;

  const snap = (() => {
    try {
      return store?.snapshot?.() ?? {};
    } catch {
      return {};
    }
  })();

  const box = document.createElement("div");
  box.style.padding = "12px";
  box.style.border = "1px solid rgba(255,165,0,.35)";
  box.style.background = "rgba(255,165,0,.08)";
  box.style.borderRadius = "10px";

  const h = document.createElement("h3");
  h.textContent = "⚠️ Panel fehlt / nicht registriert";
  h.style.margin = "0 0 8px 0";
  box.appendChild(h);

  const p = document.createElement("div");
  p.style.fontSize = "14px";
  p.style.lineHeight = "1.3";
  p.innerHTML =
    `<b>moduleKey:</b> ${moduleKey || "-"}<br>` +
    `<b>panelId:</b> ${panelId || "-"}<br>` +
    (reason ? `<b>Grund:</b> ${reason}<br>` : "");
  box.appendChild(p);

  if (DEV) {
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.marginTop = "10px";
    pre.textContent = "Store Snapshot:\n" + safeStringify(snap);
    box.appendChild(pre);
  }

  view.innerHTML = "";
  view.appendChild(box);
}

function updateSnapshot(store) {
  try {
    const el = $("#snapshot");
    if (!el) return;
    const snap = store?.snapshot?.() ?? {};
    el.textContent = safeStringify(snap);
  } catch {
    // Snapshot ist Debug – darf nie crashen.
  }
}

/* ============================================================================
 * MENU MODEL BUILDER
 * ========================================================================== */

async function buildMenuModel({ projectBaseUrl, uiConfig }) {
  // Menü-Einträge kommen in deinem Stand aus menu.registry.json
  const menuRegistryUrl = new URL("./menu.registry.json", window.location.href).toString();
  const reg = await loadJson(menuRegistryUrl);

  const groups = Array.isArray(uiConfig?.groups) ? uiConfig.groups : [];
  const groupMap = new Map(groups.map((g) => [g.key, { ...g, items: [] }]));

  // Mapping: Anchor -> UI-Gruppe
  const anchorToGroup = {
    projectPanel: "projekt",
    topbar: "tools"
  };

  const entries = Array.isArray(reg?.entries) ? reg.entries : [];
  for (const e of entries) {
    const anchor = e?.anchor || "tools";
    const tabId = e?.tabId || "default";
    const moduleKey = `${anchor}:${tabId}`;

    const gKey = anchorToGroup[anchor] || "tools";
    const g = groupMap.get(gKey) || groupMap.get("tools");
    if (!g) continue;

    g.items.push({
      moduleKey,
      label: e?.title || moduleKey,
      icon: null,
      order: e?.order ?? 999
    });
  }

  for (const g of groupMap.values()) {
    g.items.sort((a, b) => (a.order || 0) - (b.order || 0) || a.label.localeCompare(b.label));
  }

  return groups
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((g) => groupMap.get(g.key))
    .filter((g) => g && g.items && g.items.length);
}

/* ============================================================================
 * CORE BOOTSTRAP
 * ========================================================================== */

async function init({ projectPath } = {}) {
  console.log(`[loader] ${VERSION}`);

  // --- Core Instanzen
  const bus = createBus();
  const store = createStore({ bus });
  const registry = createRegistry();
  const panels = createPanelRegistry();

  // --- Project Bundle
  const pPath = projectPath || "./projects/P-2026-0001/project.json";
  const projectUrl = new URL(pPath, window.location.href).toString();
  const projectBaseUrl = projectUrl.replace(/\/project\.json(\?.*)?$/, "/");

  let projectJson = null;
  let metaJson = null;
  let uiConfig = null;
  let uiState = null;

  // ------------------------------------------------------------
  // Active Project (URL / localStorage)
  // ------------------------------------------------------------
  // Unterstützt:
  //   ?project=local:<ID>   -> lädt Projektfile aus localStorage
  //   (Fallback) localStorage["baustellenplaner:activeProject"] = "local:<ID>" oder "file:<url>"
  //
  // Wichtig: Viele Panels arbeiten mit store.get("app").project (nicht store.get("project")).
  // Deshalb initialisieren wir später store.app.project + store.project konsistent.
  const LS_ACTIVE_PROJECT_KEY = "baustellenplaner:activeProject";
  const LS_PROJECTFILE_PREFIX = "baustellenplaner:projectfile:";

  /** @type {{kind:"local"|"file", id?:string, url?:string}} */
  let activeProjectRef = { kind: "file", url: projectUrl };
  let localProjectFileObj = null;

  // 1) URL hat Vorrang (Wizard setzt z.B. ?project=local:P-2026-1234)
  const urlProjectParam = new URLSearchParams(location.search).get("project");
  if (urlProjectParam) {
    const val = String(urlProjectParam).trim();
    if (/^local:/i.test(val)) {
      activeProjectRef = { kind: "local", id: val.slice("local:".length) };
      try { localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "local:" + activeProjectRef.id); } catch {}
    } else if (/^file:/i.test(val)) {
      activeProjectRef = { kind: "file", url: val.slice("file:".length) };
      try { localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "file:" + activeProjectRef.url); } catch {}
    } else {
      // treat raw value as file url
      activeProjectRef = { kind: "file", url: val };
      try { localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "file:" + activeProjectRef.url); } catch {}
    }
  } else {
    // 2) Fallback: letzte Auswahl merken
    try {
      const last = localStorage.getItem(LS_ACTIVE_PROJECT_KEY);
      if (last && /^local:/i.test(last)) activeProjectRef = { kind: "local", id: last.slice("local:".length) };
      if (last && /^file:/i.test(last)) activeProjectRef = { kind: "file", url: last.slice("file:".length) };
    } catch {}
  }


  try {
    // Projekt JSON: entweder aus Datei (Default) oder aus localStorage (Wizard/Projektliste)
    if (activeProjectRef.kind === "local") {
      const key = LS_PROJECTFILE_PREFIX + activeProjectRef.id;
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error("[loader] local projectfile not found: " + key);
      const obj = JSON.parse(raw);
      localProjectFileObj = obj;
      // Unterstützt beide Formen:
      //  A) { schema:"bp-projectfile", project:{...}, app:{...} }
      //  B) { id,name,... } (direkt Projekt-Objekt)
      //  C) { project:{...} } (nested)
      const proj = (obj && (obj.project || obj)) || {};
      projectJson = proj;
      // app/settings/ui können später aus obj.app übernommen werden (Fallback leer)
      metaJson = metaJson || {};
      metaJson.settings = (obj && obj.app && obj.app.settings) || metaJson.settings || {};
      // uiState: wenn im projectfile vorhanden, nutzen (sonst später Template/fallback)
      uiState = (obj && obj.app && obj.app.ui) || uiState;
    } else {
      projectJson = await loadJson(projectUrl);
    }

    // ------------------------------------------------------------
    // Normalize / guarantee project.id
    // ------------------------------------------------------------
    // Viele Panels (Assets/Allgemein/AssetLab) zeigen die Projekt-ID an und
    // benutzen sie auch für Kontext-URLs. In manchen Projectfile-Varianten
    // (z.B. älteren Wizard-Ständen) kann die ID aber fehlen.
    //
    // Regel:
    // - local:<ID>  -> project.id MUSS = <ID> sein
    // - file:<url>  -> project.id falls möglich aus Pfad ableiten (P-YYYY-NNNN)
    try {
      if (projectJson && typeof projectJson === "object") {
        const curId = projectJson.id;

        if (activeProjectRef.kind === "local" && activeProjectRef.id) {
          if (!curId) projectJson.id = String(activeProjectRef.id);
        }

        if (activeProjectRef.kind === "file" && !curId) {
          const m = String(pPath || "").match(/P-\d{4}-\d{4}/);
          if (m) projectJson.id = m[0];
        }

        // Falls wir bei file-Projekten eine ID ableiten konnten, speichern wir sie
        // zusätzlich im activeProjectRef (hilft später bei Persist/Navigation).
        if (activeProjectRef.kind === "file" && !activeProjectRef.id && projectJson.id) {
          activeProjectRef.id = String(projectJson.id);
        }
      }
    } catch {
      // niemals fatal
    }
    // meta.json / ui.state / ui.config
    //
    // Lifecycle-Härtung:
    // - Bei lokalen Projekten (localStorage) NICHT automatisch Bundle-UI-State überschreiben.
    // - Lokale Projekte können vollständige Snapshots enthalten (project/meta/ui/config/app/plugins).

    const isLocalProject = activeProjectRef.kind === "local";

    const defaultMeta = {
      schema: "baustellenplaner.meta.v1",
      author: "",
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      settings: {},
    };

    const defaultUiState = {
      schema: "baustellenplaner.ui.state.v1",
      activeModule: "projectPanel:general",
      window: { leftPanelOpen: true },
    };

    if (!isLocalProject) {
      metaJson = await loadJson(new URL("./meta.json", projectBaseUrl).toString());
      uiConfig = await loadJson(new URL("./ui/ui.config.json", projectBaseUrl).toString());
      uiState = await loadJson(new URL("./ui/ui.state.json", projectBaseUrl).toString());
    } else {
      // Snapshot bevorzugen
      metaJson = localProjectFileObj?.meta ?? null;
      uiConfig = localProjectFileObj?.config ?? null;
      uiState = localProjectFileObj?.ui ?? null;

      if (!metaJson) metaJson = { ...defaultMeta };
      if (!uiState) uiState = { ...defaultUiState };

      // uiConfig ist eher "appweit" – wenn nicht im Snapshot, Bundle-Fallback
      if (!uiConfig) uiConfig = await loadJson(new URL("./ui/ui.config.json", projectBaseUrl).toString());

      // settings aus Snapshot-App mergen
      const appSettings = localProjectFileObj?.app?.settings;
      if (appSettings && typeof appSettings === "object") {
        if (!metaJson.settings || typeof metaJson.settings !== "object") metaJson.settings = {};
        Object.assign(metaJson.settings, appSettings);
      }
    }

    // Plausibilisierung / leichte Migration
    if (!projectJson.projectAssets) projectJson.projectAssets = [];
    if (!metaJson.schema) metaJson.schema = "baustellenplaner.meta.v1";
    if (!metaJson.settings) metaJson.settings = {};
    if (!uiState.schema) uiState.schema = "baustellenplaner.ui.state.v1";
    if (!uiState.window) uiState.window = { leftPanelOpen: true };

  } catch (e) {
    console.error("[loader] Project bundle load FAILED:", e);
    showFatalInView({
      title: "FATAL: Projekt-Dateien konnten nicht geladen werden",
      error: e,
      extra: `projectPath=${pPath}`
    });
  }

  // Store initialisieren (Panels erwarten diese Keys)
  store.init("project", projectJson || {});
  store.init("meta", metaJson || {});
  store.init("ui", uiState || {});
  store.init("config", uiConfig || {});

  // App-State: zentrale Quelle für Panels (Wizard/Assets/Allgemein etc.)
  // Achtung: Einige Panels greifen bewusst auf store.get("app").project zu.
  const _appInitProject = (projectJson && (projectJson.project || projectJson)) || (projectJson || {});
  const _appInitSettings = (metaJson && metaJson.settings) ? metaJson.settings : {};
  const _appInitUi = uiState || {};
  store.init("app", {
    project: _appInitProject,
    settings: _appInitSettings,
    ui: _appInitUi,
    activeProject: activeProjectRef,
    // Convenience (Single Source): aktive Projekt-ID
    activeProjectId: (_appInitProject && _appInitProject.id) ? String(_appInitProject.id) : (activeProjectRef.id || null)
  });

  // ------------------------------------------------------------
  // Lifecycle-Härtung (2026-02):
  // 1) normalizeProject(project): ergänzt fehlende Felder
  // 2) Root-Sync: store.project und store.app.project konsistent
  //    -> app.project ist Source-of-Truth (eine Richtung)
  // 3) Persistenz: single write path über app-persist (Autosave)
  // ------------------------------------------------------------

  // 1) Normalisieren (defensiv)
  try {
    const p = store.get("project");
    if (p && typeof p === "object") normalizeProject(p);
    const a = store.get("app");
    if (a && a.project && typeof a.project === "object") normalizeProject(a.project);
  } catch (e) {
    console.warn("[loader] normalizeProject failed", e);
  }

  // 2) Root-Sync (app.project -> project)
  try {
    const a = store.get("app");
    if (a && a.project && typeof a.project === "object") {
      store.set("project", a.project);
    }
  } catch (e) {
    console.warn("[loader] project root sync failed", e);
  }

  // 3) Persistenz aktivieren + persisted state anwenden
  try {
    const a = store.get("app") || {};
    const activeId = a.activeProjectId || (a.activeProject && a.activeProject.id) || null;
    if (activeId) {
      const pers = createAppPersistor({ bus, store, projectId: activeId });

      // persisted (falls vorhanden) *vor* UI Mount mergen
      const persisted = pers.load();
      if (persisted && typeof persisted === "object" && persisted.project) {
        const next = store.get("app") || {};
        next.project = persisted.project || next.project || {};
        next.settings = persisted.settings || next.settings || {};
        next.ui = next.ui || {};
        if (persisted.ui && persisted.ui.drafts) next.ui.drafts = persisted.ui.drafts;
        try { normalizeProject(next.project); } catch {}
        store.set("app", next);
        store.set("project", next.project);
      }

      pers.enableAutosave();
      // Debug/Inspector: Zugriff auf aktuellen Persistor
      window.__BP_PERSISTOR__ = pers;
    }
  } catch (e) {
    console.warn("[loader] persistor init failed", e);
  }

  // FeatureGate (DEV ignoriert requires)
  const gate = createFeatureGate({ appMode: DEV ? "dev" : "prod", projectJson: projectJson || {} });

  // --- Manifest Pack + Plugin Manifests (optional, für später)
  // (für dieses Blueprint bauen wir das Menü aus menu.registry.json;
  //  trotzdem laden wir die Plugin-Manifeste, damit sie im Store/Debug verfügbar sind.)
  let pack = null;
  let pluginManifests = [];
  try {
    const packUrl = new URL("./manifest-pack.json", window.location.href).toString();
    const r = await loadManifestPack(packUrl);
    pack = r.pack;
    pluginManifests = r.manifests;
  } catch (e) {
    console.warn("[loader] manifest-pack load failed (non-fatal):", e);
  }

  store.init("plugins", { pack: pack || null, manifests: pluginManifests || [] });

  // --- Menü aufbauen
  let menuModel = [];
  try {
    menuModel = await buildMenuModel({ projectBaseUrl, uiConfig });
  } catch (e) {
    console.error("[loader] buildMenuModel FAILED:", e);
    menuModel = [];
  }

  try {
    const menuRoot = $("#menu");
    if (menuRoot) renderMenu({ rootEl: menuRoot, menuModel, bus });
  } catch (e) {
    console.error("[loader] renderMenu FAILED:", e);
    showFatalInView({ title: "FATAL: Menü konnte nicht gerendert werden", error: e });
  }

  // --- Menü-Klick -> View
  bus.on("ui:menu:select", ({ moduleKey } = {}) => {
    if (moduleKey) switchView(moduleKey);
  });

  // -----------------------------------------------------------------------------
// UI Navigation (Panels dürfen andere Panels öffnen, z.B. ProjectAssets -> AssetLab)
// -----------------------------------------------------------------------------
bus.on("ui:navigate", (msg = {}) => {
  try {
    const panelId = msg.panel || msg.moduleKey || msg.view || "";
    if (!panelId) return;

    // optional: Kontext (AssetLab) übernehmen
    const ctx = (msg.payload && "context" in msg.payload) ? msg.payload.context : msg.context;
    if (ctx !== undefined) {
      store.update("app", (app) => {
        app = app || {};
        app.ui = app.ui || {};
        app.ui.assetlab = app.ui.assetlab || {};
        app.ui.assetlab.context = ctx;
        return app;
      });
    }

    // View wechseln
    switchView(panelId);
  } catch (e) {
    console.error("[loader] ui:navigate failed", e);
  }
});
  
  // --- Snapshot Live
  updateSnapshot(store);
  bus.on("cb:store:changed", () => updateSnapshot(store));

  // --- View Switch
  let currentPanel = null;

  async function switchView(moduleKey) {
    try {
      setActiveSubTitle("(lädt...)");

      const panelId = String(moduleKey || "");
      const factory =
        (typeof panels.get === "function" && panels.get(panelId)) ||
        (typeof panels.resolve === "function" && panels.resolve(panelId)) ||
        null;

      if (!factory) {
        console.warn("[loader] missing panel factory:", panelId);
        renderMissingPanel({ store, panelId, moduleKey, reason: "PanelRegistry hat keinen Eintrag" });
        setActiveSubTitle(panelId);
        return;
      }

      // vorheriges Panel sauber unmounten
      try {
        if (currentPanel && typeof currentPanel.unmount === "function") currentPanel.unmount();
      } catch (e) {
        console.warn("[loader] panel.unmount failed:", e);
      }
const view = $("#view");
if (!view) return;
view.innerHTML = "";

// ctx an Panels weiterreichen (PanelBase nutzt ctx.rootEl)
const ctx = { bus, store, registry, gate, moduleKey, panelId, version: VERSION, rootEl: view };

const panel = factory(ctx);
currentPanel = panel;

// Panels in deinem Projekt nutzen entweder:
// - PanelBase.mount() (nutzt this.rootEl aus ctx)
// - mount(el) (Legacy)
// - render(el) (Legacy)
if (panel && typeof panel.mount === "function") {
  // Wenn mount eine Signatur mount(el) erwartet, geben wir view mit.
  // Sonst (PanelBase) setzen wir defensiv rootEl und rufen ohne Argumente.
  if (panel.mount.length >= 1) {
    await panel.mount(view);
  } else {
    if (!panel.rootEl) panel.rootEl = view;
    await panel.mount();
  }
} else if (panel && typeof panel.render === "function") {
  panel.render(view);
} else {
  view.textContent = `Panel Factory lieferte kein mount/render: ${panelId}`;
}

setActiveSubTitle(panelId);
    } catch (e) {
      console.error("[loader] switchView FAILED:", e);
      showFatalInView({ title: `FATAL: switchView(${moduleKey})`, error: e });
      setActiveSubTitle("Fehler (Console)");
    }
  }

  // --- initiales Modul
  const firstKey = menuModel?.[0]?.items?.[0]?.moduleKey || "projectPanel:general";
  await switchView(firstKey);

  return { bus, store, registry, panels, gate, switchView, VERSION };
}

/* ============================================================================
 * PUBLIC EXPORTS (für index.html + Tests)
 * ========================================================================== */

export async function startApp(opts = {}) {
  return await init(opts);
}

// Debug: manuelle Starts in Dev
if (DEV) {
  globalThis.__BP_STARTAPP__ = startApp;
  globalThis.__BP_LOADER_VERSION__ = VERSION;
}
