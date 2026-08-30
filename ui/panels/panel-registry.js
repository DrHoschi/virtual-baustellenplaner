/**
 * ui/panels/panel-registry.js
 * Version: v1.1.0-ui-mig-navigation-foundation (2026-08-30)
 *
 * UI-MIG-02-IM01:
 * - Bestehende Panel-Factories bleiben unverändert.
 * - get()/resolve() führen Keys zuerst durch den neuen NavigationController.
 * - Legacy-Panel-IDs, neue Workspace-IDs und neue Module-IDs können damit
 *   parallel auf dieselben bestehenden Panels zeigen.
 * - Unbekannte Keys werden bewusst als Legacy-Passthrough behandelt.
 */

/* ==========================================================================
 * IMPORTS
 * ========================================================================= */

import { ProjectGeneralPanel } from "./ProjectGeneralPanel.js";
import { ProjectWizardPanel } from "./ProjectWizardPanel.js";
import { ProjectProjectsPanel } from "./ProjectProjectsPanel.js";
import { ProjectAssetsPanel } from "./ProjectAssetsPanel.js";
import { ProjectLibrariesPanel } from "./ProjectLibrariesPanel.js";
import { AssetLab3DPanel } from "./AssetLab3DPanel.js";
import { WorkareaPanel } from "./WorkareaPanel.js";
import { WorkspaceSettingsPanel } from "./WorkspaceSettingsPanel.js";
import { DEFAULT_NAVIGATION_CONTROLLER } from "../../core/navigation/navigation-controller.js";

/* ==========================================================================
 * HELPERS
 * ========================================================================= */

function key(anchor, tabId) {
  return `${anchor || "tools"}:${tabId || "default"}`;
}

class PlaceholderPanel {
  constructor({ rootEl } = {}, title = "(Placeholder)") {
    this.rootEl = rootEl;
    this.title = title;
  }

  async mount() {
    if (!this.rootEl) return;
    this.rootEl.innerHTML = `
      <div class="panel-root" style="display:flex;flex-direction:column;min-height:0;overflow:hidden;">
        <h3 style="margin:0 0 6px;">${this.title}</h3>
        <div style="opacity:.75;font-size:12px;margin:0 0 10px;">
          Panel ist registriert, aber noch nicht implementiert. (Stub)
        </div>
        <div class="panel-content-wrap" style="overflow:auto;min-height:0;">
          <div style="padding:8px;opacity:.8;">Damit Menü/Manifest/CI konsistent bleibt.</div>
        </div>
      </div>
    `;
  }

  async unmount() {
    // nothing
  }
}

function stub(title) {
  return (ctx) => new PlaceholderPanel(ctx, title);
}

/* ==========================================================================
 * REGISTRY
 * ========================================================================= */

export function createPanelRegistry() {
  const map = new Map();

  function resolveNavigationKey(input) {
    const raw = String(input || "");
    return DEFAULT_NAVIGATION_CONTROLLER.resolvePanelId(raw) || raw;
  }

  /**
   * register()
   * - Unterstützt:
   *   register(anchor, tabId, factory)
   *   register("projectPanel:general", factory)
   */
  function register(a, b, c) {
    if (typeof a === "string" && typeof b === "function" && c == null && a.includes(":")) {
      map.set(a, b);
      return;
    }
    map.set(key(a, b), c);
  }

  /**
   * get()
   * - get("projectPanel:general") ODER get("projectPanel", "general")
   * - neu zusätzlich: get("workspace.project/general"), get("module.planning")
   */
  function get(a, b) {
    const requested = (typeof a === "string" && b == null)
      ? a
      : key(a, b);
    const resolved = resolveNavigationKey(requested);
    return map.get(resolved) || null;
  }

  /**
   * resolve(panelId)
   * - Loader-Fallback
   * - nutzt ebenfalls die Navigation Foundation
   */
  function resolve(panelId) {
    const resolved = resolveNavigationKey(panelId);
    return map.get(resolved) || null;
  }

  // ------------------------------------------------------------
  // Kanonische Projekt-Panels: projectPanel:<tabId>
  // ------------------------------------------------------------
  register("projectPanel", "general", (ctx) => new ProjectGeneralPanel(ctx));
  register("projectPanel", "wizard", (ctx) => new ProjectWizardPanel(ctx));
  register("projectPanel", "projects", (ctx) => new ProjectProjectsPanel(ctx));
  register("projectPanel", "assets", (ctx) => new ProjectAssetsPanel(ctx));
  register("projectPanel", "libraries", (ctx) => new ProjectLibrariesPanel(ctx));

  // AssetLab wird aus Projekt-Assets heraus geöffnet.
  register("projectPanel", "assetlab3d", (ctx) => new AssetLab3DPanel(ctx));

  // ------------------------------------------------------------
  // Backward-Compatible Aliase (ältere Keys)
  // ------------------------------------------------------------
  register("project", "general", (ctx) => new ProjectGeneralPanel(ctx));
  register("project", "wizard", (ctx) => new ProjectWizardPanel(ctx));
  register("project", "projects", (ctx) => new ProjectProjectsPanel(ctx));
  register("project", "assets", (ctx) => new ProjectAssetsPanel(ctx));
  register("project", "libraries", (ctx) => new ProjectLibrariesPanel(ctx));

  register("assetlab", "3d", (ctx) => new AssetLab3DPanel(ctx));

  // ------------------------------------------------------------
  // Fehlende Tabs aus menu/manifest (CI-Check) -> als Stub registrieren
  // ------------------------------------------------------------
  register("projectPanel", "app_settings", stub("App Settings"));
  register("projectPanel", "palette", stub("Palette"));
  register("projectPanel", "license", stub("Lizenz / Edition"));
  register("projectPanel", "plugins", stub("Plugins"));
  register("projectPanel", "structure", stub("Struktur & Logik"));
  register("projectPanel", "versions", stub("Versionen"));
  register("projectPanel", "workspace", stub("Arbeitsbereich"));

  // ------------------------------------------------------------
  // Einstellungen
  // ------------------------------------------------------------
  register("settings", "workspace", (ctx) => new WorkspaceSettingsPanel(ctx));
  register("settings", "app_settings", stub("App-Einstellungen"));
  register("settings", "plugins", stub("Plugins"));
  register("settings", "license", stub("Lizenz / Edition"));
  register("settings", "palette", stub("Bauteile / Palette"));

  // ------------------------------------------------------------
  // Tools: Workarea
  // ------------------------------------------------------------
  register("tools", "workarea", (ctx) => new WorkareaPanel(ctx));
  register("topbar", "workarea", (ctx) => new WorkareaPanel(ctx));

  return {
    register,
    get,
    resolve,
    navigation: DEFAULT_NAVIGATION_CONTROLLER
  };
}
