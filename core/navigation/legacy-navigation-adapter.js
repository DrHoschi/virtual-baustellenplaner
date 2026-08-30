/**
 * UI-MIG-02-IM01 – Legacy Navigation Adapter
 *
 * Übersetzt historische Panel-/Menü-IDs in die neue fachliche
 * Workspace-/View-Semantik. Alte Keys bleiben damit während der Migration
 * weiterhin gültig und gespeicherte UI-Zustände brechen nicht.
 */

const LEGACY_MAP = Object.freeze({
  "projectPanel:general": { workspaceId: "workspace.project", viewId: "general" },
  "projectPanel:projects": { workspaceId: "workspace.project", viewId: "projects" },
  "projectPanel:wizard": { workspaceId: "workspace.project", viewId: "wizard" },
  "projectPanel:structure": { workspaceId: "workspace.project", viewId: "structure" },
  "projectPanel:assets": { workspaceId: "workspace.project", viewId: "assets" },
  "projectPanel:libraries": { workspaceId: "workspace.project", viewId: "libraries" },
  "projectPanel:versions": { workspaceId: "workspace.project", viewId: "versions" },
  "projectPanel:assetlab3d": { workspaceId: "workspace.asset-development", viewId: "main" },
  "tools:workarea": { workspaceId: "workspace.planning", viewId: "main" },
  "topbar:workarea": { workspaceId: "workspace.planning", viewId: "main" },
  "settings:workspace": { workspaceId: "workspace.settings", viewId: "workspace" },
  "projectPanel:workspace": { workspaceId: "workspace.settings", viewId: "workspace" },
  "settings:app_settings": { workspaceId: "workspace.settings", viewId: "app" },
  "projectPanel:app_settings": { workspaceId: "workspace.settings", viewId: "app" },
  "settings:plugins": { workspaceId: "workspace.settings", viewId: "plugins" },
  "settings:license": { workspaceId: "workspace.settings", viewId: "license" },
  "settings:palette": { workspaceId: "workspace.settings", viewId: "palette" },
  "topbar:simulation": { workspaceId: "workspace.simulation", viewId: "main" },
  "topbar:analysis": { workspaceId: "workspace.analysis", viewId: "main" }
});

export function createLegacyNavigationAdapter(map = LEGACY_MAP) {
  const entries = new Map(Object.entries(map || {}));

  return Object.freeze({
    resolve(input) {
      const key = String(input || "");
      const target = entries.get(key) || null;
      return target ? { legacyKey: key, ...target } : null;
    },

    has(input) {
      return entries.has(String(input || ""));
    },

    list() {
      return [...entries.entries()].map(([legacyKey, target]) => ({ legacyKey, ...target }));
    }
  });
}

export const DEFAULT_LEGACY_NAVIGATION_ADAPTER = createLegacyNavigationAdapter();
