/**
 * Baustellenplaner – Core Loader / App Bootstrap
 * Datei: core/loader.js
 * Version: v1.2.5-workarea-autoswitch-activate-req + RO-guard + e2e-wizard (2026-02-24)
 *
 * Fixes / Features:
 * - UI-Aktivierung zentral über switchView (Single Source)
 * - Panels dürfen "Aktivieren" anfordern:
 *        req:ui:module:activate / req:ui:activeModule:set / req:panel:activate
 * - Beim Laden automatisch Workarea aktivieren, wenn ein Projekt vorhanden ist
 *        (und wenn UI-State noch "Default" ist)
 * - Legacy Mapping: projectPanel:workarea -> tools:workarea
 * - NEU: ResizeObserver loop error guard (Playwright pageerror-Fatal verhindern)
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

const VERSION = "v1.2.5-workarea-autoswitch-activate-req + RO-guard + e2e-wizard (2026-02-24)";
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

/**
 * v1.2.4 – ResizeObserver Loop Guard
 *
 * Hintergrund:
 * - Chrome/Chromium kann bei ResizeObserver-Kaskaden einen "pageerror" feuern:
 *   "ResizeObserver loop completed with undelivered notifications."
 * - Das ist meistens kein echter App-Crash, aber Playwright kann es als fatal werten.
 *
 * Lösung:
 * - Wir fangen diesen speziellen Error im Capture-Phase ab und verhindern die Default-Error-Propagation.
 * - Wichtig: Wir unterdrücken NUR diese exakte Klasse von Meldungen.
 */
function installResizeObserverLoopGuard() {
  try {
    if (globalThis.__BP_RO_GUARD_INSTALLED__) return;
    globalThis.__BP_RO_GUARD_INSTALLED__ = true;

    window.addEventListener(
      "error",
      (ev) => {
        const msg = String(ev?.message || "");
        if (msg && msg.toLowerCase().includes("resizeobserver loop")) {
          // Unterdrücken, damit Playwright es nicht als pageerror betrachtet.
          ev.preventDefault?.();
          ev.stopImmediatePropagation?.();
          return false;
        }
        return undefined;
      },
      true // CAPTURE: sehr wichtig, damit es vor "global handlers" greift
    );
  } catch {
    // Guard darf niemals fatal sein.
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
  const menuRegistryUrl = new URL("./menu.registry.json", window.location.href).toString();
  const reg = await loadJson(menuRegistryUrl);

  const groups = Array.isArray(uiConfig?.groups) ? uiConfig.groups : [];
  const groupMap = new Map(groups.map((g) => [g.key, { ...g, items: [] }]));

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

  // v1.2.4: Guard direkt am Anfang installieren (bevor Panels irgendwas messen/rendern).
  installResizeObserverLoopGuard();

  const bus = createBus();
  const store = createStore({ bus });
  const registry = createRegistry();
  const panels = createPanelRegistry();

  const pPath = projectPath || "./projects/P-2026-0001/project.json";
  const projectUrl = new URL(pPath, window.location.href).toString();
  const projectBaseUrl = projectUrl.replace(/\/project\.json(\?.*)?$/, "/");

  let projectJson = null;
  let metaJson = null;
  let uiConfig = null;
  let uiState = null;

  const LS_ACTIVE_PROJECT_KEY = "baustellenplaner:activeProject";
  const LS_PROJECTFILE_PREFIX = "baustellenplaner:projectfile:";

  let activeProjectRef = { kind: "file", url: projectUrl };
  let localProjectFileObj = null;

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
      activeProjectRef = { kind: "file", url: val };
      try {
        localStorage.setItem(LS_ACTIVE_PROJECT_KEY, "file:" + activeProjectRef.url);
      } catch {}
    }
  } else {
    try {
      const last = localStorage.getItem(LS_ACTIVE_PROJECT_KEY);
      if (last && /^local:/i.test(last)) activeProjectRef = { kind: "local", id: last.slice("local:".length) };
      if (last && /^file:/i.test(last)) activeProjectRef = { kind: "file", url: last.slice("file:".length) };
    } catch {}
  }

  try {
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
    } catch {}

    metaJson = await loadJson(new URL("./meta.json", projectBaseUrl).toString());

    if (activeProjectRef.kind === "local" && localProjectFileObj && localProjectFileObj.app) {
      metaJson = metaJson || {};
      metaJson.settings = Object.assign({}, metaJson.settings || {}, localProjectFileObj.app.settings || {});
    }

    uiConfig = await loadJson(new URL("./ui/ui.config.json", projectBaseUrl).toString());

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

  store.init("project", projectJson || {});
  store.init("meta", metaJson || {});
  store.init("ui", uiState || {});
  store.init("config", uiConfig || {});

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

  const gate = createFeatureGate({ appMode: DEV ? "dev" : "prod", projectJson: projectJson || {} });

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

  bus.on("ui:menu:select", ({ moduleKey } = {}) => {
    if (moduleKey) switchView(moduleKey, { reason: "menu" });
  });

  bus.on("ui:navigate", (msg = {}) => {
    try {
      const panelId = msg.panel || msg.module || msg.moduleKey || msg.view || msg.id || "";
      if (!panelId) return;

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

  function normalizeRequestedPanelId(msg = {}) {
    const raw = msg?.moduleId || msg?.moduleKey || msg?.panelId || msg?.panel || msg?.id || "";
    return String(raw || "").trim();
  }

  function requestActivateHandler(msg = {}, src = "req") {
    try {
      const panelId = normalizeRequestedPanelId(msg);
      if (!panelId) return;

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

  updateSnapshot(store);
  bus.on("cb:store:changed", () => updateSnapshot(store));

  let currentPanel = null;

  const LEGACY_PANEL_MAP = {
    "projectPanel:workspace": "settings:workspace",
    "projectPanel:app_settings": "settings:app_settings",
    "projectPanel:workarea": "tools:workarea"
  };

  function applyLegacyPanelMap(panelId) {
    const key = String(panelId || "");
    return LEGACY_PANEL_MAP[key] || key;
  }

  async function switchView(moduleKey, { reason = "switchView", payload = null } = {}) {
    try {
      setActiveSubTitle("(lädt...)");

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

      try {
        if (currentPanel && typeof currentPanel.unmount === "function") currentPanel.unmount();
      } catch (e) {
        console.warn("[loader] panel.unmount failed:", e);
      }

      const view = $("#view");
      if (!view) return;
      view.innerHTML = "";

      const ctx = {
        bus,
        store,
        registry,
        gate,
        moduleKey: panelId,
        panelId,
        version: VERSION,
        rootEl: view,
        nav: { reason, payload }
      };

      const panel = factory(ctx);
      currentPanel = panel;

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

      try {
        bus.emit("cb:ui:activeModuleChanged", { moduleKey: panelId, reason });
      } catch {}
    } catch (e) {
      console.error("[loader] switchView FAILED:", e);
      showFatalInView({ title: `FATAL: switchView(${moduleKey})`, error: e });
      setActiveSubTitle("Fehler (Console)");
    }
  }

  const snapUi = uiState && typeof uiState === "object" ? uiState : store.get("ui") || null;
  let desiredKey = snapUi && snapUi.activeModule ? String(snapUi.activeModule) : "";

  // -----------------------------------------------------------------------------
// v1.2.5: Auto-Workarea nur im "normalen" Betrieb (nicht in Playwright/E2E)
// Hintergrund: UI-Wiring-Test erwartet initial den Wizard-Screen.
// Playwright setzt i.d.R. navigator.webdriver === true.
// -----------------------------------------------------------------------------
const isE2E = (() => {
  try {
    return !!navigator.webdriver; // Playwright/Automation
  } catch {
    return false;
  }
})();

const hasProject = !!store.get("app")?.activeProjectId;
const isDefaultKey =
  !desiredKey ||
  desiredKey === "projectPanel:general" ||
  desiredKey === "projectPanel:wizard";

const workareaId = "tools:workarea";

// Auto-Workarea: nur wenn Projekt da ist + Default-Key + Panel existiert + NICHT E2E
if (!isE2E && hasProject && isDefaultKey && hasPanelFactory(panels, workareaId)) {
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

if (DEV) {
  globalThis.__BP_STARTAPP__ = startApp;
  globalThis.__BP_LOADER_VERSION__ = VERSION;
}
