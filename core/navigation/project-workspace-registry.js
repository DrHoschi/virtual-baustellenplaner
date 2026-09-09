/**
 * PROJECT-UI-02A – Project Workspace State Shell Foundation
 *
 * Fachliche Sicht auf den Projekt-Workspace. Diese Registry entscheidet NICHT
 * über Persistenz oder Panel-Implementierung, sondern beschreibt ausschließlich
 * die sichtbaren Project-Workspace-Zustände und deren erlaubte Navigationsträger.
 *
 * PROJECT_STATE_NONE
 * - Projektverwaltung / Create Flow
 * - keine Projektinhalt-Tabs sichtbar
 *
 * PROJECT_STATE_OPEN
 * - Übersicht / Assets / Bibliotheken
 * - Projektverwaltung ist kein gleichrangiger Projektinhalt-Tab
 *
 * Wichtig:
 * - structure/versions bleiben geplant und unsichtbar.
 * - AssetLab bleibt separater Asset-Development-Kontext.
 * - Storage, Lifecycle, Dirty/Save und Workarea-Save werden hier nicht verändert.
 */

export const PROJECT_WORKSPACE_STATE = Object.freeze({
  NONE: "PROJECT_STATE_NONE",
  OPEN: "PROJECT_STATE_OPEN"
});

const PROJECT_WORKSPACE_ITEMS = Object.freeze([
  Object.freeze({
    id: "general",
    label: "Übersicht",
    panelId: "projectPanel:general",
    status: "available",
    owner: "project",
    workspaceState: PROJECT_WORKSPACE_STATE.OPEN,
    navigationRole: "project-content"
  }),
  Object.freeze({
    id: "projects",
    label: "Projekte",
    panelId: "projectPanel:projects",
    status: "available",
    owner: "project",
    workspaceState: PROJECT_WORKSPACE_STATE.NONE,
    navigationRole: "project-management"
  }),
  Object.freeze({
    id: "assets",
    label: "Assets",
    panelId: "projectPanel:assets",
    status: "available",
    owner: "project",
    workspaceState: PROJECT_WORKSPACE_STATE.OPEN,
    navigationRole: "project-content"
  }),
  Object.freeze({
    id: "libraries",
    label: "Bibliotheken",
    panelId: "projectPanel:libraries",
    status: "available",
    owner: "project",
    workspaceState: PROJECT_WORKSPACE_STATE.OPEN,
    navigationRole: "project-content"
  }),
  Object.freeze({
    id: "structure",
    label: "Projektstruktur",
    panelId: "projectPanel:structure",
    status: "planned",
    owner: "project",
    workspaceState: PROJECT_WORKSPACE_STATE.OPEN,
    navigationRole: "project-content",
    reason: "registered-placeholder-only"
  }),
  Object.freeze({
    id: "versions",
    label: "Versionen",
    panelId: "projectPanel:versions",
    status: "planned",
    owner: "project",
    workspaceState: PROJECT_WORKSPACE_STATE.OPEN,
    navigationRole: "project-content",
    reason: "registered-placeholder-only"
  })
]);

const STATE_ONLY_PANELS = Object.freeze({
  "projectPanel:wizard": PROJECT_WORKSPACE_STATE.NONE
});

const SETTINGS_OWNERSHIP = Object.freeze({
  workspace: Object.freeze({
    panelId: "settings:workspace",
    owner: "application",
    statePath: "app.settings.workspace",
    reason: "controls-workarea-and-viewport-globally"
  }),
  app: Object.freeze({ panelId: "settings:app_settings", owner: "application" }),
  plugins: Object.freeze({ panelId: "settings:plugins", owner: "application" }),
  license: Object.freeze({ panelId: "settings:license", owner: "application" }),
  palette: Object.freeze({ panelId: "settings:palette", owner: "application" })
});

export function createProjectWorkspaceRegistry(seed = PROJECT_WORKSPACE_ITEMS) {
  const items = Array.isArray(seed) ? [...seed] : [];
  const byId = new Map(items.filter((item) => item?.id).map((item) => [String(item.id), item]));
  const byPanel = new Map(items.filter((item) => item?.panelId).map((item) => [String(item.panelId), item]));

  function normalizeState(state) {
    return Object.values(PROJECT_WORKSPACE_STATE).includes(state) ? state : null;
  }

  return Object.freeze({
    list() {
      return [...items];
    },

    listAvailable() {
      return items.filter((item) => item?.status === "available");
    },

    listAvailableForState(state) {
      const normalized = normalizeState(state);
      if (!normalized) return [];
      return items.filter((item) => item?.status === "available" && item?.workspaceState === normalized);
    },

    listPlanned() {
      return items.filter((item) => item?.status === "planned");
    },

    get(id) {
      return byId.get(String(id || "")) || null;
    },

    getByPanel(panelId) {
      return byPanel.get(String(panelId || "")) || null;
    },

    resolveWorkspaceState(panelId) {
      const key = String(panelId || "");
      return byPanel.get(key)?.workspaceState || STATE_ONLY_PANELS[key] || null;
    },

    settingsOwnership() {
      return SETTINGS_OWNERSHIP;
    }
  });
}

export const DEFAULT_PROJECT_WORKSPACE_REGISTRY = createProjectWorkspaceRegistry();
export { SETTINGS_OWNERSHIP };
