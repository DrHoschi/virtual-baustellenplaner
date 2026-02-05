/**
 * core/loader.js
 * Version: v1.0.0-hardcut-modular-v3.2 (2026-02-04)
 *
 * HARD-CUT Loader (Single Entry Orchestrator) – v2
 * ============================================================
 * Ziel: EIN Bootpfad, EINE Wahrheit.
 *
 *  index.html → main.js → startApp() →
 *    1) project.json
 *    2) defaults (Settings)
 *    3) manifest-pack.json + plugin manifests
 *    4) module registration (dynamisch)
 *    5) registry.initAll()
 *    6) UI (Menü) + View Router (inkl. Plugin-Panels)
 *
 * Was ist neu in v3?
 * - Panel-System ist aktiv: Plugin-MenuEntries können echte Editor-Panels öffnen (statt JSON-Placeholder).
 * - Erstes echtes Panel: "Projekt → Allgemein" (Edit + Apply/Reset → Store).
 * - Fallback bleibt: für nicht implementierte Panels wird weiterhin ein Manifest/JSON-Placeholder angezeigt.
 *
 * Hinweis:
 * - Das ist noch nicht der finale Inspector-Stack.
 * - Aber: Der Pack/Plugins werden real genutzt und sind sichtbar/bedienbar.
 */

import { createBus } from "../app/bus.js";
import { createStore } from "../app/store.js";
import { createRegistry } from "../app/registry.js";
import { renderMenu } from "../app/ui/menu.js";

import { createFeatureGate } from "./featureGate.js";
import { createPanelRegistry } from "../ui/panels/panel-registry.js";
import { createAppPersistor } from "./persist/app-persist.js";

// -----------------------------
// Utils
// -----------------------------

async function loadJson(url) {
  // ------------------------------------------------------------
  // Local Project Support (Wizard / Browser-only FS)
  // ------------------------------------------------------------
  // Konvention (neu):
  //   url = "local:<projectId>"
  //   localStorage keys:
  //     - baustellenplaner:project:<id>  (ProjectState)
  //     - baustellenplaner:ui:<id>       (UIState)
  //   Loader braucht hier NUR das project.json-Äquivalent.
  //   Das liefern wir als: ProjectState.project (oder fallback meta).
  if (typeof url === "string" && url.startsWith("local:")) {
    const projectId = url.slice("local:".length).trim();
    const rawNew = localStorage.getItem(`baustellenplaner:project:${projectId}`);
    const rawLegacy = localStorage.getItem(`baustellenplaner:projectfile:${projectId}`); // backward compat
    const raw = rawNew || rawLegacy;
    if (!raw) throw new Error(`Local project not found: ${url}`);
    try {
      const parsed = JSON.parse(raw);
      // Neuer Style: ProjectState → project.json
      if (parsed && typeof parsed === "object" && (parsed.project || parsed.meta)) {
        return parsed.project || parsed.meta;
      }
      // Legacy: direkt project.json
      return parsed;
    } catch {
      throw new Error(`Local project JSON parse failed: ${url}`);
    }
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load JSON: ${url} (${res.status})`);
  return await res.json();
}

function deepMerge(a, b) {
  // a,b = plain objects
  if (a == null) return structuredClone(b);
  if (b == null) return structuredClone(a);
  if (Array.isArray(a) || Array.isArray(b)) return structuredClone(b); // "b gewinnt"
  if (typeof a !== "object" || typeof b !== "object") return structuredClone(b);
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (k in out) out[k] = deepMerge(out[k], v);
    else out[k] = structuredClone(v);
  }
  return out;
}

function dirname(p) {
  const i = p.lastIndexOf("/");
  return i <= 0 ? "" : p.slice(0, i);
}

function joinPath(base, rel) {
  if (!base) return rel;
  if (rel.startsWith("/")) return rel;
  return `${base}/${rel}`.replace(/\/+?/g, "/");
}

function safeText(s) {
  return String(s ?? "");
}

function prettyJson(obj) {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}

// -----------------------------
// Module Import Map
// -----------------------------
// Wichtig: nur hier wird festgelegt, welche Modul-Keys existieren.
// Später kann das aus module.json generiert werden.

/**
 * Modul-Discovery & Manifest Single-Source
 * ---------------------------------------
 * In Static-Hosting / Browser-ESM können wir Module nicht per Directory-Scan finden.
 * Deshalb nutzen wir eine Registry-Datei: /modules/modules.registry.json
 *
 * Ziele:
 * 1) Auto-Discovery: nur modules.registry.json pflegen (statt MODULE_IMPORTS hardcoded)
 * 2) Single-Source: Manifest kommt aus module.json (nicht doppelt im module.logic.js)
 * 3) Optional: Styles pro Modul automatisch laden
 */

const MODULES_REGISTRY_URL = "modules/modules.registry.json";

async function loadModulesRegistry() {
  return await loadJson(MODULES_REGISTRY_URL);
}

function normalizeModuleSpec(spec) {
  // Defensive defaults – damit später Erweiterungen möglich sind
  return {
    key: spec.key,
    logic: spec.logic || `modules/${spec.key}/module.logic.js`,
    manifest: spec.manifest || `modules/${spec.key}/module.json`,
    styles: spec.styles || null
  };
}

async function importLogicModule(spec) {
  // Wichtig: relative URL (vom root aus). Loader liegt in /core/, daher "../"
  const url = `../${spec.logic}`;
  return await import(url);
}

function pickRegisterFn(loadedModule) {
  // Legacy & Zukunft: mehrere mögliche Exporte akzeptieren
  return (
    loadedModule.registerModule ||
    loadedModule.registerCoreModule ||
    loadedModule.registerLayoutModule ||
    loadedModule.registerHall3DModule ||
    null
  );
}

async function registerModulesByKey({ registry, moduleKeys }) {
  const reg = await loadModulesRegistry();
  const list = (reg?.modules || []).map(normalizeModuleSpec);

  // Map für schnellen Zugriff
  const byKey = new Map(list.map((s) => [s.key, s]));

  for (const key of moduleKeys) {
    const spec = byKey.get(key);
    if (!spec) {
      throw new Error(`Unbekanntes Modul "${key}" (nicht in ${MODULES_REGISTRY_URL}).`);
    }

    // Manifest ist Single-Source-of-Truth
    const manifest = await loadJson(spec.manifest);

    // Logic importieren & registrieren
    const loaded = await importLogicModule(spec);
    const registerFn = pickRegisterFn(loaded);
    if (!registerFn) {
      throw new Error(`Modul "${key}" exportiert keine Register-Funktion (registerModule/registerXModule).`);
    }

    // Wichtig: registerFn soll manifest akzeptieren, aber Legacy ohne manifest weiterhin funktionieren
    try {
      registerFn(registry, manifest);
    } catch (e) {
      // Fallback: manche ältere Register-Funktionen hatten nur (registry)
      registerFn(registry);
    }
  }
}

// -----------------------------
// Module Styles Loader
// -----------------------------

const _loadedCss = new Set();

function ensureStylesheet(href) {
  if (!href) return;
  if (_loadedCss.has(href)) return;
  _loadedCss.add(href);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function loadActiveModuleStyles(moduleKeys) {
  const reg = await loadModulesRegistry();
  const list = (reg?.modules || []).map(normalizeModuleSpec);
  const byKey = new Map(list.map((s) => [s.key, s]));

  for (const key of moduleKeys) {
    const spec = byKey.get(key);
    if (!spec) continue;

    // Wenn explizit im registry spec angegeben, nutzen wir das.
    // Ansonsten versuchen wir eine Konvention.
    const stylePath = (spec.styles === false) ? null : (spec.styles || `modules/${key}/module.styles.css`);
    // Loader liegt in /core/, daher "../"
    const href = `../${stylePath}`;
    ensureStylesheet(href);
  }
}
// -----------------------------
// Plugin Loading
// -----------------------------

async function loadPluginPack(packUrl) {
  const pack = await loadJson(packUrl);
  const manifests = [];
  const paths = Array.isArray(pack.plugins) ? pack.plugins : [];
  for (const p of paths) manifests.push(await loadJson(p));
  return { pack, manifests };
}

// -----------------------------
// Menü-Modell: Module + Plugins
// -----------------------------

const DEFAULT_GROUPS = [
  { key: "projekt", label: "Projekt", order: 1 },
  { key: "planung", label: "Planung", order: 2 },
  { key: "betrieb", label: "Betrieb", order: 3 },
  { key: "analyse", label: "Analyse", order: 4 },
  { key: "tools", label: "Tools", order: 5 }
];

const ANCHOR_TO_GROUP = {
  projectPanel: "projekt",
  workspacePanel: "planung",
  structurePanel: "planung",
  librariesPanel: "planung",
  assetsPanel: "planung",
  simPanel: "betrieb",
  analysisPanel: "analyse",
  exportPanel: "betrieb",
  pluginsPanel: "tools",
  licensePanel: "projekt",
  settingsPanel: "tools",
  palettePanel: "tools"
};

function buildPluginMenuItems(pluginManifests) {
  /** @type {Array<{moduleKey:string,label:string,group:string,order:number,icon?:string|null}>} */
  const items = [];

  for (const pm of pluginManifests || []) {
    const entries = pm?.ui?.menuEntries;
    if (!Array.isArray(entries)) continue;

    for (const e of entries) {
      const anchor = e?.anchor || "tools";
      const tabId = e?.tabId || "default";

      const group = ANCHOR_TO_GROUP[anchor] || "tools";
      const label = e?.title || `${pm.pluginId || "plugin"}:${tabId}`;
      const order = typeof e?.order === "number" ? e.order : 999;
      const icon = e?.icon || null;

      items.push({
        // Wir benutzen absichtlich moduleKey, damit der bestehende Menu-Renderer + Core-Handler weiter funktionieren.
        // Das sind "virtual views".
        moduleKey: `panel:${anchor}:${tabId}`,
        label,
        group,
        order,
        icon
      });
    }
  }

  return items;
}

function mergeMenuModels({ moduleGroups, pluginItems, uiGroups }) {
  const groups = (uiGroups?.groups || DEFAULT_GROUPS).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const map = new Map(groups.map((g) => [g.key, { ...g, items: [] }]));

  // 1) Module (aus registry.computeMenuModel)
  for (const g of moduleGroups || []) {
    const target = map.get(g.key) || map.get("tools");
    if (!target) continue;
    for (const it of g.items || []) target.items.push({ ...it });
  }

  // 2) Plugins
  for (const p of pluginItems || []) {
    const target = map.get(p.group) || map.get("tools");
    if (!target) continue;
    target.items.push({
      moduleKey: p.moduleKey,
      label: p.label,
      icon: p.icon ? `icon-${p.icon}` : null,
      order: p.order
    });
  }

  // Sort items
  for (const g of map.values()) {
    g.items.sort((a, b) => (a.order || 0) - (b.order || 0) || safeText(a.label).localeCompare(safeText(b.label)));
  }

  return groups.map((g) => map.get(g.key)).filter(Boolean);
}

// -----------------------------
// Views / Router (minimal, aber erweitert)
// -----------------------------

async function createViewFactory({ bus, store, viewRoot, plugins, panelRegistry }) {
  // Lazy View-Imports, damit wir nicht unnötig rendern.
  const cache = new Map();

  async function getView(moduleKey) {
    if (cache.has(moduleKey)) return cache.get(moduleKey);

    // --- Reale Module ---
    if (moduleKey === "hall3d") {
      const { createHall3DView } = await import("../modules/hall3d/view.js");
      const v = createHall3DView({ bus, store, rootEl: viewRoot });
      cache.set(moduleKey, v);
      return v;
    }

    if (moduleKey === "layout") {
      const { createLayoutView } = await import("../modules/layout/view.js");
      const v = createLayoutView({ bus, store, rootEl: viewRoot });
      cache.set(moduleKey, v);
      return v;
    }

    if (moduleKey === "core") {
      const v = {
        async mount() {
          viewRoot.innerHTML = "";
          const wrap = document.createElement("div");
          wrap.style.padding = "12px";
          wrap.innerHTML = `
            <h3 style="margin:0 0 8px;">Core</h3>
            <div style="opacity:.8; margin:0 0 10px;">Projekt: <b>${safeText(store.get("project")?.meta?.name || store.get("project")?.project?.name || store.get("project")?.meta?.id || store.get("project")?.project?.id || "")}</b></div>
            <pre style="margin:0;">${prettyJson(store.get("core"))}</pre>
          `;
          viewRoot.appendChild(wrap);
        },
        unmount() {
          viewRoot.innerHTML = "";
        }
      };
      cache.set(moduleKey, v);
      return v;
    }

    // --- Plugin Panels (virtual) ---
    if (moduleKey.startsWith("panel:")) {
      const v = createPluginPanelView({ moduleKey, bus, store, viewRoot, plugins, panelRegistry });
      cache.set(moduleKey, v);
      return v;
    }

    // Default Placeholder View
    const v = {
      async mount() {
        viewRoot.innerHTML = `<div style="padding:12px;opacity:.75">Keine View für <b>${safeText(moduleKey)}</b> registriert.</div>`;
      },
      unmount() {
        // noop
      }
    };
    cache.set(moduleKey, v);
    return v;
  }

  return { getView };
}

function createPluginPanelView({ moduleKey, bus, store, viewRoot, plugins, panelRegistry }) {
  // moduleKey = "panel:<anchor>:<tabId>"
  const parts = moduleKey.split(":");
  const anchor = parts[1] || "tools";
  const tabId = parts[2] || "default";

  function findMenuEntry() {
    for (const pm of plugins?.manifests || []) {
      const entries = pm?.ui?.menuEntries;
      if (!Array.isArray(entries)) continue;
      const hit = entries.find((e) => e?.anchor === anchor && (e?.tabId || "default") === tabId);
      if (hit) return { plugin: pm, entry: hit };
    }
    return null;
  }

  return {
    async mount() {
      viewRoot.innerHTML = "";

      const hit = findMenuEntry();
      const wrap = document.createElement("div");
      wrap.style.padding = "12px";


// Wenn ein echtes Panel für (anchor, tabId) registriert ist, benutzen wir das.
const panelFactory = panelRegistry?.get?.(anchor, tabId) || null;
if (panelFactory) {
  // Panel bekommt (bus/store/rootEl) + Kontext (Plugin/Entry)
  const panel = panelFactory({
    bus,
    store,
    rootEl: wrap,
    context: {
      anchor,
      tabId,
      pluginId: hit?.plugin?.pluginId || "",
      entry: hit?.entry || null,
      plugin: hit?.plugin || null
    }
  });

  // Defensive: Panel muss mount/unmount bieten
  if (panel && typeof panel.mount === "function") {
    await panel.mount();
    viewRoot.appendChild(wrap);

    // Cache-Handle für unmount
    this._panel = panel;
    return;
  }
}

// Fallback (v2): Placeholder-Ansicht (Manifest/JSON)
const title = hit?.entry?.title || `${anchor} / ${tabId}`;
const pid = hit?.plugin?.pluginId || "(unknown)";
const settingsPath = hit?.plugin?.settings?.path || "";      wrap.innerHTML = `
        <h3 style="margin:0 0 8px;">${safeText(title)}</h3>
        <div style="opacity:.75; margin:0 0 10px;">Plugin: <b>${safeText(pid)}</b> &nbsp; <span style="opacity:.6;">(${safeText(moduleKey)})</span></div>
        ${settingsPath ? `<div style="opacity:.8; margin:0 0 10px;">Settings-Pfad: <code>${safeText(settingsPath)}</code></div>` : ""}
        <div style="display:grid; gap:10px; grid-template-columns: 1fr;">
          <div>
            <div style="font-weight:700; margin:0 0 6px;">Aktuelle Settings</div>
            <pre style="margin:0;">${prettyJson(currentSettings)}</pre>
          </div>
          <div>
            <div style="font-weight:700; margin:0 0 6px;">Plugin-Manifest (Auszug)</div>
            <pre style="margin:0;">${prettyJson({ pluginId: pid, ui: hit?.plugin?.ui || null, settings: hit?.plugin?.settings || null })}</pre>
          </div>
        </div>
      `;

      viewRoot.appendChild(wrap);
    },
    unmount() {
      // Panel sauber abbauen
      if (this._panel && typeof this._panel.unmount === "function") {
        try { this._panel.unmount(); } catch (e) { /* ignore */ }
      }
      this._panel = null;
      viewRoot.innerHTML = "";
    }
  };
}

// -----------------------------
// Public API
// -----------------------------

export async function startApp({ projectPath }) {
  // --------------------------------------------------
  // 1) Project
  // --------------------------------------------------
  const project = await loadJson(projectPath);
  const projectDir = dirname(projectPath);

  // --------------------------------------------------
  // 2) Settings: Defaults → Project Overrides
  // --------------------------------------------------
  const DEFAULT_SETTINGS_PATHS = [
    "defaults/appSettings.ui.json",
    "defaults/projectSettings.general.json",
    "defaults/projectSettings.workspace.json",
    "defaults/projectSettings.sim_basic.json",
    "defaults/projectSettings.analysis_basic.json",
    "defaults/projectSettings.export_basic.json",
    "defaults/projectSettings.assets.json",
    "defaults/projectSettings.structure.json",
    "defaults/projectSettings.plugins.json"
  ];

  const extraDefaults = Array.isArray(project?.settingsDefaults) ? project.settingsDefaults : [];
  const overridePaths = Array.isArray(project?.settingsOverrides) ? project.settingsOverrides : [];

  const settingsPaths = [...DEFAULT_SETTINGS_PATHS, ...extraDefaults];
  let settings = {};
  for (const p of settingsPaths) settings = deepMerge(settings, await loadJson(p));
  for (const p of overridePaths) settings = deepMerge(settings, await loadJson(joinPath(projectDir, p)));

  // --------------------------------------------------
  // 3) Plugins
  // --------------------------------------------------
  const packUrl = project?.pluginPack || "manifest-pack.json";
  const { pack, manifests } = await loadPluginPack(packUrl);

  // FeatureGate: wird erst später wirklich genutzt (wenn Plugins requires aktiv werden)
  const gate = createFeatureGate({ appMode: "dev", projectJson: project });

  // --------------------------------------------------
  // 4) App Core (Bus/Store/Persist)
  // --------------------------------------------------
  const bus = createBus();
  const store = createStore({ bus });
  const registry = createRegistry();

  // Persistor: spiegelt Store("project"/"ui") in localStorage
  const projectId = project?.id || "unknown";
  const persistor = createAppPersistor({ bus, store, projectId });

  // ----------------------------
  // Initial ProjectState
  // ----------------------------
  let areas = [];
  let objects = [];
  let routes = [];
  try { areas = await loadJson(joinPath(projectDir, "data/areas.json")); } catch { areas = []; }
  try { objects = await loadJson(joinPath(projectDir, "data/objects.json")); } catch { objects = []; }
  try { routes = await loadJson(joinPath(projectDir, "data/routes.json")); } catch { routes = []; }

  const projectState = {
    meta: {
      id: project?.id || projectId,
      name: project?.name || project?.id || projectId,
      templateKey: project?.templateKey || project?.uiPreset || "structure",
      createdAt: project?.createdAt || null,
      updatedAt: project?.updatedAt || null,
      version: project?.version || "1.0.0"
    },
    // project.json Äquivalent (für Loader/Export)
    project: project,
    // gemergte Settings (Defaults + Overrides)
    settings,
    // fachliche Daten (Planung) – zunächst aus projects/<id>/data/
    model: {
      areas: Array.isArray(areas) ? areas : [],
      objects: Array.isArray(objects) ? objects : [],
      routes: Array.isArray(routes) ? routes : [],
      modules: {}
    },
    runtimeHints: {
      lastOpenPanel: null,
      flags: {}
    }
  };

  // ----------------------------
  // Initial UIState
  // ----------------------------
  let uiState = null;
  try {
    uiState = await loadJson(joinPath(projectDir, "ui/ui.state.json"));
  } catch {
    uiState = {
      layout: { activePanelId: "project.general", panelSizes: {}, collapsed: {} },
      inspector: { tabOrder: [], openTabs: [], filters: {}, snapshotCollapsed: true },
      draft: { formDraftsByPanel: {} }
    };
  }

  // Persisted Overrides (localStorage) schlagen geladene Defaults/Project-Werte.
  const persisted = persistor.load();
  if (persisted && typeof persisted === "object") {
    if (persisted.projectState) {
      // Merge: persisted gewinnt
      Object.assign(projectState, deepMerge(projectState, persisted.projectState));
    }
    if (persisted.uiState) {
      uiState = deepMerge(uiState || {}, persisted.uiState);
    }
    bus.emit("cb:persist:loaded", { key: persistor.kProject(projectId), meta: persisted._meta || null });
  }

  // Store initialisieren
  store.init("project", projectState);
  store.init("ui", uiState);

  // Autosave aktivieren
  persistor.enableAutosave();

  // Wizard-Command: Projekt erstellen
  bus.on("req:project:create", async (payload) => {
    try {
      const created = await persistor.createProject(payload);
      bus.emit("cb:project:created", { id: created.id });
    } catch (e) {
      console.error("[persist] createProject failed", e);
      bus.emit("cb:persist:status", { ok: false, error: String(e?.message || e) });
    }
  });

  // --------------------------------------------------
  // 5) Modules: declarative via project.json
  // --------------------------------------------------
  const activeModuleKeys = Array.isArray(project?.modules) ? project.modules.slice() : [];
  if (activeModuleKeys.length === 0) {
    throw new Error("project.json enthält keine Module. Erwartet: project.modules = [\"core\", ...]");
  }

  await registerModulesByKey({ registry, moduleKeys: activeModuleKeys });

  // Styles der aktiven Module automatisch laden (module.styles.css)
  await loadActiveModuleStyles(activeModuleKeys);

  // Module ctx sollte auf Store-States basieren (project/settings)
  registry.initAll({
    activeModuleKeys,
    ctx: {
      bus,
      store,
      project: store.get("project")?.project || project,
      settings: store.get("project")?.settings || settings,
      plugins: { pack, manifests },
      gate
    }
  });

  // --------------------------------------------------
  // 6) UI Config (aus Projekt-UI)
  // --------------------------------------------------
  // Convention: projects/<id>/ui/ui.config.json
  let uiConfig = null;
  try {
    uiConfig = await loadJson(joinPath(projectDir, "ui/ui.config.json"));
  } catch (_) {
    uiConfig = { groups: DEFAULT_GROUPS };
  }

  // Menü: Module + Plugins zusammenführen
  const moduleMenuGroups = registry.computeMenuModel({ uiConfig, activeModuleKeys });
  const pluginItems = buildPluginMenuItems(manifests);
  const menuModel = mergeMenuModels({ moduleGroups: moduleMenuGroups, pluginItems, uiGroups: uiConfig });

  renderMenu({
    rootEl: document.querySelector("#menu"),
    menuModel,
    bus
  });

  // --------------------------------------------------
  // 7) View Router
  // --------------------------------------------------
  const viewRoot = document.querySelector("#view");
  if (!viewRoot) {
    console.warn("Hinweis: #view nicht gefunden – keine Ansicht wird gerendert.");
  }

  const elActive = document.querySelector("#active");
  const elSnap = document.querySelector("#snapshot");

  function refresh() {
    const core = store.get("core");
    if (elActive) elActive.textContent = core?.ui?.activeModule || "(unknown)";
    if (elSnap) elSnap.textContent = JSON.stringify(store.snapshot(), null, 2);
  }

  bus.on("cb:store:inited", refresh);
  bus.on("cb:store:changed", refresh);
  bus.on("cb:core:activeModuleChanged", refresh);

  // View switching
  let currentKey = null;
  const panelRegistry = createPanelRegistry();
  const viewFactory = viewRoot ? await createViewFactory({ bus, store, viewRoot, plugins: { pack, manifests }, panelRegistry }) : null;

  async function switchView(moduleKey) {
    if (!viewRoot || !viewFactory) return;

    // unmount alt
    if (currentKey) {
      const prev = await viewFactory.getView(currentKey);
      if (prev?.unmount) {
        try { prev.unmount(); } catch (e) { console.warn(e); }
      }
    }

    currentKey = moduleKey;
    const next = await viewFactory.getView(moduleKey);
    if (next?.mount) {
      try { await next.mount(); } catch (e) { console.error(e); }
    }
  }

  bus.on("cb:core:activeModuleChanged", ({ moduleKey }) => {
    switchView(moduleKey);
  });

  // Initial
  refresh();
  const initialModule = store.get("core")?.ui?.activeModule || activeModuleKeys[0];
  switchView(initialModule);

  // --------------------------------------------------
  // 8) Dev-Only: Button wiring (legacy demo)
  // --------------------------------------------------
  const btnAddArea = document.querySelector("#btnAddArea");
  if (btnAddArea) {
    btnAddArea.addEventListener("click", () => {
      const area = {
        id: `A-${Date.now()}`,
        name: "Dummy Area",
        points: [
          { x: 10, y: 10 },
          { x: 80, y: 10 },
          { x: 80, y: 60 },
          { x: 10, y: 60 }
        ]
      };
      bus.emit("req:layout:addArea", area);
    });
  }

  return { bus, store, registry, project, settings, plugins: { pack, manifests }, gate };
}
