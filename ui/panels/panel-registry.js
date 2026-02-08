/**
 * ui/panels/panel-registry.js
 * Version: v1.0.3-minimal-panelid-align (2026-02-08)
 *
 * Fix (Minimal-Patch für "Tabs leer"):
 * - Mehrere Panels (General/Wizard/Projektliste/Assets) erwarten Panel-IDs im Format:
 *     "projectPanel:<tabId>"
 *   (siehe Kommentare in ProjectProjectsPanel.js, ProjectAssetsPanel.js etc.)
 *
 * - In einem Zwischenstand war die Registry aber auf "project:<tabId>" verdrahtet.
 *   => Ergebnis: Menü klickbar, aber PanelRegistry findet keinen Treffer → View bleibt leer.
 *
 * Lösung:
 * - Wir registrieren die kanonischen Keys "projectPanel:<tabId>".
 * - Zusätzlich bieten wir `resolve(panelId)` an, weil der Loader defensiv
 *   entweder `panels.get(panelId)` ODER `panels.resolve(panelId)` aufruft.
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

  /**
   * register()
   * - Unterstützt beide Formen:
   *   (a) register(anchor, tabId, factory)
   *   (b) register(panelIdString, factory)
   */
  function register(a, b, c) {
    // (b) register("projectPanel:general", factory)
    if (typeof a === "string" && typeof b === "function" && c == null && a.includes(":")) {
      map.set(a, b);
      return;
    }
    // (a) register(anchor, tabId, factory)
    map.set(key(a, b), c);
  }

  /**
   * get()
   * - Unterstützt beide Formen:
   *   (a) get(anchor, tabId)
   *   (b) get(panelIdString)
   */
  function get(a, b) {
    if (typeof a === "string" && b == null && a.includes(":")) return map.get(a) || null;
    return map.get(key(a, b)) || null;
  }

  /**
   * resolve(panelId)
   * - Loader-Fallback: Wenn er nur eine Panel-ID hat, kann er hier auflösen.
   */
  function resolve(panelId) {
    return map.get(String(panelId || "")) || null;
  }

  // ------------------------------------------------------------
  // Projekt-Panels (Sidepanel Tabs) – KANONISCH: projectPanel:<tabId>
  // ------------------------------------------------------------
  register("projectPanel", "general", (ctx) => new ProjectGeneralPanel(ctx));
  register("projectPanel", "wizard", (ctx) => new ProjectWizardPanel(ctx));
  register("projectPanel", "projects", (ctx) => new ProjectProjectsPanel(ctx));
  register("projectPanel", "assets", (ctx) => new ProjectAssetsPanel(ctx));
  register("projectPanel", "libraries", (ctx) => new ProjectLibrariesPanel(ctx));

  // ------------------------------------------------------------
  // AssetLab (wird aus Projekt-Assets heraus geöffnet)
  // ProjectAssetsPanel nutzt panel: "projectPanel:assetlab3d"
  // ------------------------------------------------------------
  register("projectPanel", "assetlab3d", (ctx) => new AssetLab3DPanel(ctx));

  // ------------------------------------------------------------
// Fehlende Tabs aus menu.registry.json / manifest-pack.json
// -> Damit Manifest Integrity Check grün wird und UI nicht leer ist
// ------------------------------------------------------------

class PlaceholderPanel {
  constructor(ctx, title) {
    this.ctx = ctx;
    this.title = title;
  }
  mount(el) {
    el.innerHTML = `
      <div class="panel">
        <h2>${this.title}</h2>
        <p style="opacity:.8">
          Panel ist registriert, aber noch nicht implementiert.
          (Stub – damit Menü/Manifest/CI konsistent ist.)
        </p>
      </div>
    `;
  }
  unmount() {}
}

// helper: Factory für Placeholder
function stub(title) {
  return (ctx) => new PlaceholderPanel(ctx, title);
}

// diese IDs kommen bei dir im CI-Fehler vor:
register("projectPanel", "app_settings", stub("App Settings"));
register("projectPanel", "palette",      stub("Palette"));
register("projectPanel", "license",      stub("License"));
register("projectPanel", "plugins",      stub("Plugins"));
register("projectPanel", "structure",    stub("Structure"));
register("projectPanel", "versions",     stub("Versions"));
register("projectPanel", "workspace",    stub("Workspace"));
  
  return { register, get, resolve };
}
