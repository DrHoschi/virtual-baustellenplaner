/**
 * Baustellenplaner – Core Loader / App Bootstrap
 * Datei: core/loader.js
 * Version: v1.2.3-workarea-autoswitch-activate-req (2026-02-24)
 *
 * Fixes / Features:
 * - UI-Aktivierung zentral über switchView (Single Source)
 * - NEU: Panels dürfen "Aktivieren" anfordern:
 *        req:ui:module:activate / req:ui:activeModule:set / req:panel:activate
 * - NEU: Beim Laden automatisch Workarea aktivieren, wenn ein Projekt vorhanden ist
 *        (und wenn UI-State noch "Default" ist)
 * - NEU: Legacy Mapping: projectPanel:workarea -> tools:workarea
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

import { renderMenu } from "../app/ui/menu.js";
import { createPanelRegistry } from "../ui/panels/panel-registry.js";

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const VERSION = "v1.2.3-workarea-autoswitch-activate-req (2026-02-24)";
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

/**
 * v1.2.3 – Mini-Helfer:
 * Prüft, ob ein Panel im Registry registriert ist (ohne Exceptions).
 */
function hasPanelFactory(panels, panelId) {
  try {
    const f =
      (typeof panels.get === "function" && panels.get(panelId)) ||
      (typeof panels.resolve === "function" && panels.resolve(panelId)) ||
      null;
    return !!f;
  } catch {
    return false;
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
      try {
        localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "local:" + activeProjectRef.id);
      } catch {}
    } else if (/^file:/i.test(val)) {
      activeProjectRef = { kind: "file", url: val.slice("file:".length) };
      try {
        localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "file:" + activeProjectRef.url);
      } catch {}
    } else {
      // treat raw value as file url
      activeProjectRef = { kind: "file", url: val };
      try {
        localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "file:" + activeProjectRef.url);
      } catch {}
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

      const proj = (obj && (obj.project || obj)) || {};
      projectJson = proj;

      metaJson = metaJson || {};
      metaJson.settings = (obj && obj.app && obj.app.settings) || metaJson.settings || {};

      uiState = (obj && obj.app && obj.app.ui) || uiState;
    } else {
      projectJson = await loadJson(projectUrl);
    }

    // Normalize / guarantee project.id
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

        if (activeProjectRef.kind === "file" && !activeProjectRef.id && projectJson.id) {
          activeProjectRef.id = String(projectJson.id);
        }
      }
    } catch {
      // niemals fatal
    }

    metaJson = await loadJson(new URL("./meta.json", projectBaseUrl).toString());

    // local projectfile overrides
    if (activeProjectRef.kind === "local" && localProjectFileObj && localProjectFileObj.app) {
      metaJson = metaJson || {};
      metaJson.settings = Object.assign({}, metaJson.settings || {}, localProjectFileObj.app.settings || {});
    }

    uiConfig = await loadJson(new URL("./ui/ui.config.json", projectBaseUrl).toString());

    // Wenn uiState schon aus localProjectFileObj kam, NICHT stumpf überschreiben:
    // -> wir mergen später store.init("ui") trotzdem sauber.
    const fileUiState = await loadJson(new URL("./ui/ui.state.json", projectBaseUrl).toString());
    uiState = uiState || fileUiState;
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

  // App-State: zentrale Quelle für Panels
  const _appInitProject = (projectJson && (projectJson.project || projectJson)) || (projectJson || {});
  const _appInitSettings = metaJson && metaJson.settings ? metaJson.settings : {};
  const _appInitUi = uiState || {};
  store.init("app", {
    project: _appInitProject,
    settings: _appInitSettings,
    ui: _appInitUi,
    activeProject: activeProjectRef,
    activeProjectId: _appInitProject && _appInitProject.id ? String(_appInitProject.id) : activeProjectRef.id || null
  });

  // FeatureGate (DEV ignoriert requires)
  const gate = createFeatureGate({ appMode: DEV ? "dev" : "prod", projectJson: projectJson || {} });

  // --- Manifest Pack + Plugin Manifests (optional)
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
    if (moduleKey) switchView(moduleKey, { reason: "menu" });
  });

  // -----------------------------------------------------------------------------
  // UI Navigation (Panels dürfen andere Panels öffnen, z.B. ProjectAssets -> AssetLab)
  // -----------------------------------------------------------------------------
  bus.on("ui:navigate", (msg = {}) => {
    try {
      const panelId = msg.panel || msg.module || msg.moduleKey || msg.view || msg.id || "";
      if (!panelId) return;

      // optional: Kontext (AssetLab) übernehmen
      const ctx = msg.payload && "context" in msg.payload ? msg.payload.context : msg.context;
      if (ctx !== undefined) {
        store.update("app", (app) => {
          app = app || {};
          app.ui = app.ui || {};
          app.ui.assetlab = app.ui.assetlab || {};
          app.ui.assetlab.context = ctx;
          return app;
        });
      }

      switchView(panelId, { reason: "ui:navigate" });
    } catch (e) {
      console.error("[loader] ui:navigate failed", e);
    }
  });

  // -----------------------------------------------------------------------------
  // v1.2.3: Activate-Requests (WorkareaPanel & andere Panels können damit View wechseln)
  // -----------------------------------------------------------------------------
  function normalizeRequestedPanelId(msg = {}) {
    const raw = msg?.moduleId || msg?.moduleKey || msg?.panelId || msg?.panel || msg?.id || "";
    return String(raw || "").trim();
  }

  function requestActivateHandler(msg = {}, src = "req") {
    try {
      const panelId = normalizeRequestedPanelId(msg);
      if (!panelId) return;

      // Wenn ein Panel nicht existiert, brechen wir sauber ab (kein Crash)
      const mapped = applyLegacyPanelMap(panelId);
      const can = hasPanelFactory(panels, mapped);
      if (!can) {
        console.warn("[loader] activate request: unknown panel:", panelId, "mapped->", mapped);
        return;
      }

      switchView(mapped, { reason: src, payload: msg });
    } catch (e) {
      console.error("[loader] activate request handler failed:", e);
    }
  }

  bus.on("req:ui:module:activate", (msg) => requestActivateHandler(msg, "req:ui:module:activate"));
  bus.on("req:ui:activeModule:set", (msg) => requestActivateHandler(msg, "req:ui:activeModule:set"));
  bus.on("req:panel:activate", (msg) => requestActivateHandler(msg, "req:panel:activate"));

  // --- Snapshot Live
  updateSnapshot(store);
  bus.on("cb:store:changed", () => updateSnapshot(store));

  // --- View Switch
  let currentPanel = null;

  // ------------------------------------------------------------
  // Legacy Panel Mapping (Umbenennungen / Menü-Reorg)
  // Damit alte gespeicherte ui.activeModule Werte nicht "leere" Views erzeugen.
  // ------------------------------------------------------------
  const LEGACY_PANEL_MAP = {
    "projectPanel:workspace": "settings:workspace",
    "projectPanel:app_settings": "settings:app_settings",

    // NEU: alte/andere Benennung -> echtes Workarea
    "projectPanel:workarea": "tools:workarea"
  };

  function applyLegacyPanelMap(panelId) {
    const key = String(panelId || "");
    return LEGACY_PANEL_MAP[key] || key;
  }

  async function switchView(moduleKey, { reason = "switchView", payload = null } = {}) {
    try {
      setActiveSubTitle("(lädt...)");

      // 1) Legacy mapping anwenden (wichtig: vor registry lookup)
      const requestedId = String(moduleKey || "");
      const panelId = applyLegacyPanelMap(requestedId);

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

      // 2) UI-State aktualisieren (damit es in Snapshots sauber steht)
      //    -> Wichtig für "Projekt öffnen" / Reload / Persist
      try {
        store.update("ui", (u) => {
          u = u || {};
          u.activeModule = panelId;
          return u;
        });
      } catch {}
      try {
        store.update("app", (app) => {
          app = app || {};
          app.ui = app.ui || {};
          app.ui.activeModule = panelId;
          return app;
        });
      } catch {}

      // 3) vorheriges Panel sauber unmounten
      try {
        if (currentPanel && typeof currentPanel.unmount === "function") currentPanel.unmount();
      } catch (e) {
        console.warn("[loader] panel.unmount failed:", e);
      }

      const view = $("#view");
      if (!view) return;
      view.innerHTML = "";

      // ctx an Panels weiterreichen (PanelBase nutzt ctx.rootEl)
      const ctx = {
        bus,
        store,
        registry,
        gate,
        moduleKey: panelId,
        panelId,
        version: VERSION,
        rootEl: view,

        // Debug: warum umgeschaltet wurde
        nav: { reason, payload }
      };

      const panel = factory(ctx);
      currentPanel = panel;

      // Panels nutzen:
      // - PanelBase.mount() (nutzt this.rootEl aus ctx)
      // - mount(el) (Legacy)
      // - render(el) (Legacy)
      if (panel && typeof panel.mount === "function") {
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

      // 4) Debug Event (optional)
      try {
        bus.emit("cb:ui:activeModuleChanged", { moduleKey: panelId, reason });
      } catch {}
    } catch (e) {
      console.error("[loader] switchView FAILED:", e);
      showFatalInView({ title: `FATAL: switchView(${moduleKey})`, error: e });
      setActiveSubTitle("Fehler (Console)");
    }
  }

  // --- initiales Modul
  // Lifecycle-Härtung + NEU: Auto Workarea
  //
  // Regel:
  // - Wenn uiState.activeModule sinnvoll ist -> respektieren
  // - SONST: wenn Projekt vorhanden -> tools:workarea (falls registriert)
  // - Fallback: erstes Menü-Item oder projectPanel:general
  const snapUi = uiState && typeof uiState === "object" ? uiState : store.get("ui") || null;
  let desiredKey = snapUi && snapUi.activeModule ? String(snapUi.activeModule) : "";

  // NEU: Workarea bevorzugen, wenn Projekt aktiv und activeModule "Default" ist
  const hasProject = !!(store.get("app")?.activeProjectId);
  const isDefaultKey = !desiredKey || desiredKey === "projectPanel:general" || desiredKey === "projectPanel:wizard";

  // Nur wenn Workarea existiert (PanelRegistry Eintrag)
  const workareaId = "tools:workarea";
  if (hasProject && isDefaultKey && hasPanelFactory(panels, workareaId)) {
    desiredKey = workareaId;
  }

  const firstKey = menuModel?.[0]?.items?.[0]?.moduleKey || "projectPanel:general";
  await switchView(desiredKey || firstKey, { reason: "init" });

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
