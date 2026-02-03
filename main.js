/**
 * Blueprint Demo Entry
 * - Registriert Module
 * - Baut Menü datengetrieben
 * - Zeigt activeModule + Store Snapshot
 */
import { createBus } from "./app/bus.js";
import { createStore } from "./app/store.js";
import { createRegistry } from "./app/registry.js";
import { renderMenu } from "./app/ui/menu.js";

import { registerCoreModule } from "./modules/core/module.logic.js";
import { registerLayoutModule } from "./modules/layout/module.logic.js";
import { registerHall3DModule } from "./modules/hall3d/module.logic.js";
import { createHall3DView } from "./modules/hall3d/view.js";

// --- Setup
const bus = createBus();
const store = createStore({ bus });
const registry = createRegistry();

// --- Module registrieren (Blueprint: manuell; später: automatisch aus module.json)
registerCoreModule(registry);
registerLayoutModule(registry);
registerHall3DModule(registry);

// --- "Projekt" (hier minimal statisch)
const project = {
  id: "P-2026-0001",
  name: "Baustelle Musterhalle",
  modules: ["core", "layout", "hall3d"]
};

// --- UI Config (hier minimal statisch)
const uiConfig = {
  groups: [
    { key: "projekt", label: "Projekt", order: 1 },
    { key: "planung", label: "Planung", order: 2 },
    { key: "betrieb", label: "Betrieb", order: 3 },
    { key: "analyse", label: "Analyse", order: 4 },
    { key: "tools", label: "Tools", order: 5 }
  ]
};

// --- Init
registry.initAll({
  activeModuleKeys: project.modules,
  ctx: { bus, store, project }
});

// --- Menü bauen + rendern
const menuModel = registry.computeMenuModel({
  uiConfig,
  activeModuleKeys: project.modules
});

renderMenu({
  rootEl: document.querySelector("#menu"),
  menuModel,
  bus
});


// --- View Manager (einfacher Router)
// Ziel: Bei core.ui.activeModule (aus Menü) die passende Ansicht in #view mounten.
const viewRoot = document.querySelector("#view");
if (!viewRoot) {
  console.warn("Hinweis: #view nicht gefunden – 3D Ansicht wird nicht gerendert.");
}

// Views (später: Registry-basiert / Plugin-basiert)
const views = {
  hall3d: viewRoot ? createHall3DView({ bus, store, rootEl: viewRoot }) : null
};

let currentKey = null;

async function switchView(moduleKey) {
  if (!viewRoot) return;

  // unmount alt
  if (currentKey && views[currentKey]?.unmount) {
    try { views[currentKey].unmount(); } catch (e) { console.warn(e); }
  }
  currentKey = moduleKey;

  // mount neu
  if (views[moduleKey]?.mount) {
    try { await views[moduleKey].mount(); } catch (e) { console.error(e); }
  } else {
    // Fallback: leere Ansicht mit Hinweis
    viewRoot.innerHTML = `<div style="padding:12px;opacity:.7">Keine View für Modul <b>${moduleKey}</b> registriert.</div>`;
  }
}

// Beim ActiveModule-Wechsel umschalten
bus.on("cb:core:activeModuleChanged", ({ moduleKey }) => {
  switchView(moduleKey);
});

// Initial: Core default aktive Ansicht
switchView(store.get("core")?.ui?.activeModule || "layout");

// --- UI outputs
const elActive = document.querySelector("#active");
const elSnap = document.querySelector("#snapshot");

function refresh() {
  const core = store.get("core");
  elActive.textContent = core?.ui?.activeModule || "(unknown)";
  elSnap.textContent = JSON.stringify(store.snapshot(), null, 2);
}

bus.on("cb:store:inited", refresh);
bus.on("cb:store:changed", refresh);
bus.on("cb:core:activeModuleChanged", refresh);

// initial
refresh();

// --- Test button (Layout)
document.querySelector("#btnAddArea").addEventListener("click", () => {
  const area = {
    id: `A-${Date.now()}`,
    name: "Dummy Area",
    points: [{ x: 10, y: 10 }, { x: 80, y: 10 }, { x: 80, y: 60 }, { x: 10, y: 60 }]
  };
  bus.emit("req:layout:addArea", area);
});
