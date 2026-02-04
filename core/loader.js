/**
 * core/loader.js
 * Version: v1.0.0-hardcut-modular (2026-02-04)
 *
 * HARD-CUT Loader (Single Entry Orchestrator)
 * ============================================================
 * Ziel: EIN Bootpfad, EINE Wahrheit.
 *
 *  index.html → main.js → startApp() →
 *    1) project.json
 *    2) defaults (Settings)
 *    3) manifest-pack.json + plugin manifests
 *    4) module registration (dynamisch)
 *    5) registry.initAll()
 *    6) UI (Menü) + View Router
 *
 * Hinweis:
 * - Diese Version ist bewusst minimal, aber "echt" (keine Pseudocode-Template-Welt).
 * - Der Menü-Renderer bleibt der Blueprint-Menu-Renderer (app/ui/menu.js).
 * - Plugins werden geladen und im Store abgelegt (sichtbar im Snapshot) – UI-Integration der Tabs ist der nächste Schritt.
 */

import { createBus } from "../app/bus.js";
import { createStore } from "../app/store.js";
import { createRegistry } from "../app/registry.js";
import { renderMenu } from "../app/ui/menu.js";

import { createFeatureGate } from "./featureGate.js";

// -----------------------------
// Utils
// -----------------------------

async function loadJson(url) {
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
  return `${base}/${rel}`.replace(/\/+/g, "/");
}

// -----------------------------
// Module Import Map
// -----------------------------
// Wichtig: nur hier wird festgelegt, welche Modul-Keys existieren.
// Später kann das aus module.json generiert werden, aber für hardcut-v1 ist diese Map die klare Wahrheit.

const MODULE_IMPORTS = {
  core: () => import("../modules/core/module.logic.js"),
  layout: () => import("../modules/layout/module.logic.js"),
  hall3d: () => import("../modules/hall3d/module.logic.js")
};

async function registerModulesByKey({ registry, moduleKeys }) {
  for (const key of moduleKeys) {
    const importer = MODULE_IMPORTS[key];
    if (!importer) throw new Error(`Unbekanntes Modul "${key}" (kein Importer in MODULE_IMPORTS).`);
    const mod = await importer();

    // Konvention: jede module.logic.js exportiert eine "registerXModule" Funktion.
    // Wir versuchen mehrere Namen – damit bleibt das robust, auch wenn du später standardisierst.
    const candidates = [
      mod.registerModule,
      mod.registerCoreModule,
      mod.registerLayoutModule,
      mod.registerHall3DModule
    ].filter(Boolean);

    if (candidates.length === 0) {
      throw new Error(`Modul "${key}" exportiert keine Register-Funktion (erwartet registerModule/registerXModule).`);
    }

    // Nimm die erste gefundene Register-Funktion.
    candidates[0](registry);
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
// Views / Router (minimal)
// -----------------------------

async function createViewFactory({ bus, store, viewRoot }) {
  // Lazy View-Imports, damit wir nicht unnötig rendern.
  const cache = new Map();

  async function getView(moduleKey) {
    if (cache.has(moduleKey)) return cache.get(moduleKey);

    if (moduleKey === "hall3d") {
      const { createHall3DView } = await import("../modules/hall3d/view.js");
      const v = createHall3DView({ bus, store, rootEl: viewRoot });
      cache.set(moduleKey, v);
      return v;
    }

    // Default Placeholder View
    const v = {
      async mount() {
        viewRoot.innerHTML = `<div style="padding:12px;opacity:.75">Keine View für Modul <b>${moduleKey}</b> registriert.</div>`;
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
  // Minimaler Resolver: feste Default-Liste + optionale overrides aus project.json.
  // (Du kannst später project.settingsPaths hinzufügen.)
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
  // 4) App Core
  // --------------------------------------------------
  const bus = createBus();
  const store = createStore({ bus });
  const registry = createRegistry();

  // App-Root State (damit Snapshot alles zeigt)
  store.init("app", {
    project,
    settings,
    plugins: {
      pack,
      manifests,
      gate: {
        appMode: "dev",
        // gate intern nicht serialisieren – nur Flags, die du im UI brauchst
        enabled: true
      }
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

  registry.initAll({
    activeModuleKeys,
    ctx: { bus, store, project, settings, plugins: { pack, manifests }, gate }
  });

  // --------------------------------------------------
  // 6) UI Config (aus Projekt-UI)
  // --------------------------------------------------
  // Convention: projects/<id>/ui/ui.config.json
  let uiConfig = null;
  try {
    uiConfig = await loadJson(joinPath(projectDir, "ui/ui.config.json"));
  } catch (_) {
    uiConfig = {
      groups: [
        { key: "projekt", label: "Projekt", order: 1 },
        { key: "planung", label: "Planung", order: 2 },
        { key: "betrieb", label: "Betrieb", order: 3 },
        { key: "analyse", label: "Analyse", order: 4 },
        { key: "tools", label: "Tools", order: 5 }
      ]
    };
  }

  // Menü rendern (derzeit: Module-Menü)
  const menuModel = registry.computeMenuModel({ uiConfig, activeModuleKeys });
  renderMenu({
    rootEl: document.querySelector("#menu"),
    menuModel,
    bus
  });

  // --------------------------------------------------
  // 7) View Router (minimal)
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
  const viewFactory = viewRoot ? await createViewFactory({ bus, store, viewRoot }) : null;

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
  // Dieser Button bleibt in index.html erstmal bestehen.
  // Später wird das als Dev-Plugin ins Inspector/Tools verschoben.
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

  // Return handles for advanced integration/testing
  return { bus, store, registry, project, settings, plugins: { pack, manifests }, gate };
}
