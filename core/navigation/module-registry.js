/**
 * UI-MIG-02-IM01 – Module Registry Foundation
 *
 * Fachmodule werden von ihrer aktuellen Panel-/Menürepräsentation getrennt.
 * Diese Registry enthält bewusst nur stabile Metadaten. Lizenz-, Installations-
 * und Kompatibilitätszustände folgen erst in einer späteren Migrationstranche.
 */

const MODULES = Object.freeze([
  {
    id: "module.project",
    label: "Projekt",
    iconId: "project",
    workspaceId: "workspace.project",
    navigationZone: "base",
    order: 10,
    status: "available"
  },
  {
    id: "module.planning",
    label: "Planung",
    iconId: "planning",
    workspaceId: "workspace.planning",
    navigationZone: "base",
    order: 20,
    status: "available"
  },
  {
    id: "module.asset-development",
    label: "Asset-Entwicklung",
    iconId: "asset-edit",
    workspaceId: "workspace.asset-development",
    navigationZone: "base",
    order: 30,
    status: "available"
  },
  {
    id: "module.assembly-development",
    label: "Baugruppenentwicklung",
    iconId: "assembly-edit",
    workspaceId: "workspace.assembly-development",
    navigationZone: "specialist",
    order: 40,
    status: "planned"
  },
  {
    id: "module.simulation",
    label: "Simulation",
    iconId: "simulation",
    workspaceId: "workspace.simulation",
    navigationZone: "base",
    order: 50,
    status: "planned"
  },
  {
    id: "module.analysis",
    label: "Analyse",
    iconId: "analysis",
    workspaceId: "workspace.analysis",
    navigationZone: "base",
    order: 60,
    status: "planned"
  },
  {
    id: "module.settings",
    label: "Einstellungen",
    iconId: "settings",
    workspaceId: "workspace.settings",
    navigationZone: "system",
    order: 1000,
    status: "available"
  }
]);

export function createModuleRegistry(seed = MODULES) {
  const byId = new Map();

  for (const item of Array.isArray(seed) ? seed : []) {
    if (!item?.id) continue;
    byId.set(String(item.id), Object.freeze({ ...item }));
  }

  return Object.freeze({
    get(id) {
      return byId.get(String(id || "")) || null;
    },

    has(id) {
      return byId.has(String(id || ""));
    },

    list() {
      return [...byId.values()].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }
  });
}

export const DEFAULT_MODULE_REGISTRY = createModuleRegistry();
