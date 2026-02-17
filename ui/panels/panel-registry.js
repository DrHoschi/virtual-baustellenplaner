/**
 * ui/panels/panel-registry.js
 * Version: v1.0.4-panelid-align-stubs (2026-02-09)
 *
 * Warum:
 * - Menü/Manifeste arbeiten mit Panel-IDs im Format "projectPanel:<tabId>".
 * - In einem Zwischenstand waren hier aber nur Aliase wie "project:*" registriert.
 *   => Menü klickbar, aber PanelRegistry findet keinen Treffer -> View bleibt leer.
 * - Zusätzlich prüft der CI "Manifest Integrity Check" ob jeder Menü-Tab
 *   auch ein Panel hat. Dafür brauchen wir mind. Stubs.
 *
 * Lösung:
 * - Kanonisch registrieren: projectPanel:<tabId>
 * - Backward-Compatible Aliase: project:<tabId>
 * - resolve(panelId) für defensive Loader-Aufrufe
 * - Fehlende Tabs als Placeholder registrieren (damit CI grün und UI nicht leer)
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

  /**
   * register()
   * - Unterstützt:
   *   register(anchor, tabId, factory)
   *   register("projectPanel:general", factory)
   */
  function register(a, b, c) {
    // register("projectPanel:general", factory)
    if (typeof a === "string" && typeof b === "function" && c == null && a.includes(":")) {
      map.set(a, b);
      return;
    }
    // register(anchor, tabId, factory)
    map.set(key(a, b), c);
  }

  /**
   * get()
   * - get("projectPanel:general") ODER get("projectPanel", "general")
   */
  function get(a, b) {
    if (typeof a === "string" && b == null && a.includes(":")) return map.get(a) || null;
    return map.get(key(a, b)) || null;
  }

  /**
   * resolve(panelId)
   * - Loader-Fallback
   */
  function resolve(panelId) {
    return map.get(String(panelId || "")) || null;
  }

  // ------------------------------------------------------------
  // Kanonische Projekt-Panels: projectPanel:<tabId>
  // ------------------------------------------------------------
  register("projectPanel", "general", (ctx) => new ProjectGeneralPanel(ctx));
  register("projectPanel", "wizard", (ctx) => new ProjectWizardPanel(ctx));
  register("projectPanel", "projects", (ctx) => new ProjectProjectsPanel(ctx));
  register("projectPanel", "assets", (ctx) => new ProjectAssetsPanel(ctx));
  register("projectPanel", "libraries", (ctx) => new ProjectLibrariesPanel(ctx));

  // AssetLab wird aus Projekt-Assets heraus geöffnet
  // (ProjectAssetsPanel nutzt i.d.R. panelId: "projectPanel:assetlab3d")
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
  // Settings (Einstellungen): eigene Anchor-Keys für saubere Zuordnung im Menü
  // - Damit kann z.B. "Arbeitsbereich" (Settings) unter "Einstellungen" einsortiert werden.
  // - Wir lassen projectPanel:* als Backward-Compatibility bestehen.
  // ------------------------------------------------------------
  register("settings", "app_settings", stub("App-Einstellungen"));
  register("settings", "palette", stub("Bauteile / Palette"));
  register("settings", "license", stub("Lizenz / Edition"));
  register("settings", "plugins", stub("Plugins"));
  register("settings", "workspace", stub("Arbeitsbereich"));


  return { register, get, resolve };
}
