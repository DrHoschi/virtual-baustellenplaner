/**
 * ui/panels/panel-registry.js
 * Version: v1.0.0-hardcut-modular-v3 (2026-02-04)
 *
 * Registry für Plugin-Panels:
 * - key = `${anchor}:${tabId}`
 * - value = factory(ctx) -> { mount(), unmount() }
 *
 * Dadurch bleibt core/loader.js stabil: neue Panels = nur Registry erweitern.
 */

import { ProjectGeneralPanel } from "./ProjectGeneralPanel.js";
import { ProjectWizardPanel } from "./ProjectWizardPanel.js";
import { ProjectListPanel } from "./ProjectListPanel.js";

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
  // Projektliste soll vor dem Wizard sichtbar sein (UX)
  register("projectPanel", "projects", (ctx) => new ProjectListPanel(ctx));
  register("projectPanel", "general", (ctx) => new ProjectGeneralPanel(ctx));
  register("projectPanel", "wizard", (ctx) => new ProjectWizardPanel(ctx));

  return { register, get };
}
