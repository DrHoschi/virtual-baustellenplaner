/**
 * UI-MIG-04B – Project Workspace Completion
 *
 * Fachliche Sicht auf den Projekt-Workspace. Diese Registry entscheidet NICHT
 * über Persistenz oder Panel-Implementierung, sondern beschreibt nur, welche
 * Projektbereiche im neuen Produkt-UI bereits belastbar angeboten werden dürfen.
 *
 * Wichtig:
 * - structure/versions bleiben als geplante Projektbereiche dokumentiert,
 *   werden aber nicht als fertige UI-Ziele veröffentlicht, solange nur Stubs existieren.
 * - Workspace-/Viewport-Einstellungen gehören aktuell zu app.settings.workspace
 *   und damit zur globalen Anwendungsebene, nicht zum Projekt-Workspace.
 */

const PROJECT_WORKSPACE_ITEMS = Object.freeze([
  Object.freeze({
    id: "general",
    label: "Übersicht",
    panelId: "projectPanel:general",
    status: "available",
    owner: "project"
  }),
  Object.freeze({
    id: "projects",
    label: "Projekte",
    panelId: "projectPanel:projects",
    status: "available",
    owner: "project"
  }),
  Object.freeze({
    id: "assets",
    label: "Assets",
    panelId: "projectPanel:assets",
    status: "available",
    owner: "project"
  }),
  Object.freeze({
    id: "libraries",
    label: "Bibliotheken",
    panelId: "projectPanel:libraries",
    status: "available",
    owner: "project"
  }),
  Object.freeze({
    id: "structure",
    label: "Projektstruktur",
    panelId: "projectPanel:structure",
    status: "planned",
    owner: "project",
    reason: "registered-placeholder-only"
  }),
  Object.freeze({
    id: "versions",
    label: "Versionen",
    panelId: "projectPanel:versions",
    status: "planned",
    owner: "project",
    reason: "registered-placeholder-only"
  })
]);

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

  return Object.freeze({
    list() {
      return [...items];
    },

    listAvailable() {
      return items.filter((item) => item?.status === "available");
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

    settingsOwnership() {
      return SETTINGS_OWNERSHIP;
    }
  });
}

export const DEFAULT_PROJECT_WORKSPACE_REGISTRY = createProjectWorkspaceRegistry();
export { SETTINGS_OWNERSHIP };
