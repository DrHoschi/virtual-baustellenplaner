/**
 * UI-MIG-02-IM01 – Workspace Registry Foundation
 *
 * Ein Workspace ist die fachliche Arbeitsfläche eines Moduls. Während IM01
 * zeigen seine Views noch auf bestehende Panel-IDs. Damit kann die neue
 * Navigation parallel zur bisherigen Panel-Architektur eingeführt werden.
 */

const WORKSPACES = Object.freeze([
  {
    id: "workspace.project",
    moduleId: "module.project",
    defaultViewId: "general",
    views: Object.freeze({
      general: "projectPanel:general",
      projects: "projectPanel:projects",
      wizard: "projectPanel:wizard",
      structure: "projectPanel:structure",
      assets: "projectPanel:assets",
      libraries: "projectPanel:libraries",
      versions: "projectPanel:versions"
    })
  },
  {
    id: "workspace.planning",
    moduleId: "module.planning",
    defaultViewId: "main",
    views: Object.freeze({
      main: "tools:workarea"
    })
  },
  {
    id: "workspace.asset-development",
    moduleId: "module.asset-development",
    defaultViewId: "main",
    views: Object.freeze({
      main: "projectPanel:assetlab3d"
    })
  },
  {
    id: "workspace.assembly-development",
    moduleId: "module.assembly-development",
    defaultViewId: "main",
    status: "planned",
    views: Object.freeze({})
  },
  {
    id: "workspace.simulation",
    moduleId: "module.simulation",
    defaultViewId: "main",
    status: "planned",
    views: Object.freeze({})
  },
  {
    id: "workspace.analysis",
    moduleId: "module.analysis",
    defaultViewId: "main",
    status: "planned",
    views: Object.freeze({})
  },
  {
    id: "workspace.settings",
    moduleId: "module.settings",
    defaultViewId: "workspace",
    views: Object.freeze({
      workspace: "settings:workspace",
      app: "settings:app_settings",
      plugins: "settings:plugins",
      license: "settings:license",
      palette: "settings:palette"
    })
  }
]);

export function createWorkspaceRegistry(seed = WORKSPACES) {
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
      return [...byId.values()];
    },

    resolve(workspaceId, viewId = null) {
      const workspace = byId.get(String(workspaceId || "")) || null;
      if (!workspace) return null;

      const resolvedViewId = String(viewId || workspace.defaultViewId || "main");
      const legacyPanelId = workspace.views?.[resolvedViewId] || null;

      return {
        workspaceId: workspace.id,
        moduleId: workspace.moduleId || null,
        viewId: resolvedViewId,
        legacyPanelId,
        status: workspace.status || "available"
      };
    }
  });
}

export const DEFAULT_WORKSPACE_REGISTRY = createWorkspaceRegistry();
