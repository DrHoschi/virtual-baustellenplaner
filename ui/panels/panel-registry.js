/**
 * ui/panels/panel-registry.js
 * Version: v1.0.2-clean-separated (2026-02-08)
 *
 * Zentrale Registry für UI-Panels.
 * - key = `${anchor}:${tabId}`
 * - value = factory(ctx) -> PanelInstance
 *
 * REGEL:
 * - Nur Panels mit echtem UI-Zugriff werden registriert
 * - AssetLab ist KEIN projectPanel
 */

import { ProjectGeneralPanel } from "./ProjectGeneralPanel.js";
import { ProjectWizardPanel } from "./ProjectWizardPanel.js";
import { ProjectProjectsPanel } from "./ProjectProjectsPanel.js";
import { ProjectAssetsPanel } from "./ProjectAssetsPanel.js";
import { ProjectLibrariesPanel } from "./ProjectLibrariesPanel.js";
import { AssetLab3DPanel } from "./AssetLab3DPanel.js";

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
  // Projekt-Panels (Topbar → Projekt)
  // ------------------------------------------------------------
  register("project", "general", ctx => new ProjectGeneralPanel(ctx));
  register("project", "wizard", ctx => new ProjectWizardPanel(ctx));
  register("project", "projects", ctx => new ProjectProjectsPanel(ctx));
  register("project", "assets", ctx => new ProjectAssetsPanel(ctx));
  register("project", "libraries", ctx => new ProjectLibrariesPanel(ctx));

  // ------------------------------------------------------------
  // AssetLab (eigener Arbeitsmodus)
  // ------------------------------------------------------------
  register("assetlab", "3d", ctx => new AssetLab3DPanel(ctx));

  return { register, get };
}
