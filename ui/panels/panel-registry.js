/**
 * ui/panels/panel-registry.js
 * Version: v1.0.1-hardcut-modular-v3-assets-tab (2026-02-07)
 *
 * Registry für Plugin-Panels:
 * - key = `${anchor}:${tabId}`
 * - value = factory(ctx) -> { mount(), unmount() }
 *
 * Dadurch bleibt core/loader.js stabil: neue Panels = nur Registry erweitern.
 */

import { ProjectGeneralPanel } from "./ProjectGeneralPanel.js";
import { ProjectWizardPanel } from "./ProjectWizardPanel.js";
import { ProjectProjectsPanel } from "./ProjectProjectsPanel.js";
import { AssetLab3DPanel } from "./AssetLab3DPanel.js";
import { AssetLibraryPanel } from "./AssetLibraryPanel.js";

function key(anchor, tabId) {
  return `${anchor || "tools"}:${tabId || "default"}`;
}

export function createPanelRegistry() {
  const map = new Map();

  function register(anchor, tabId, factory) {
    map.set(key(anchor, tabId), factory);
  }

  function get(anchor, tabId) {
    return map.get(key(anchor, tabId)) || null;
  }

  // ------------------------------------------------------------
  // v3: Erstes echtes Panel
  // ------------------------------------------------------------
  register("projectPanel", "projects", (ctx) => new ProjectProjectsPanel(ctx));
  register("projectPanel", "general", (ctx) => new ProjectGeneralPanel(ctx));
  register("projectPanel", "wizard", (ctx) => new ProjectWizardPanel(ctx));
  register("projectPanel", "assetlab3d", (ctx) => new AssetLab3DPanel(ctx));
  register("projectPanel", "assets", (ctx) => new AssetLibraryPanel(ctx));
  return { register, get };
}
