import { clickLegacyTarget } from "./ModuleNavigation.js";
import {
  DEFAULT_PROJECT_WORKSPACE_REGISTRY,
  PROJECT_WORKSPACE_STATE
} from "../../core/navigation/project-workspace-registry.js";

const PROJECT_VIEWS = Object.freeze(DEFAULT_PROJECT_WORKSPACE_REGISTRY.listAvailable());
const PANEL_TO_VIEW = new Map(PROJECT_VIEWS.map((item) => [item.panelId, item.id]));

export function createProjectWorkspaceNavigation({ rootEl, onNavigate } = {}) {
  if (!rootEl) throw new Error("createProjectWorkspaceNavigation: rootEl fehlt");

  rootEl.innerHTML = "";
  rootEl.classList.add("bp-project-workspace-nav");
  rootEl.hidden = true;
  rootEl.setAttribute("aria-label", "Projektbereiche");
  rootEl.dataset.workspaceContract = "project-ui-02a";
  rootEl.dataset.projectState = "";

  const buttons = new Map();
  for (const item of PROJECT_VIEWS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bp-project-workspace-nav__item";
    button.dataset.projectView = item.id;
    button.dataset.targetPanel = item.panelId;
    button.dataset.projectState = item.workspaceState || "";
    button.textContent = item.label;
    button.setAttribute("aria-pressed", "false");
    button.hidden = true;
    button.addEventListener("click", () => {
      onNavigate?.(item);
      if (!clickLegacyTarget(item.panelId)) {
        console.warn("[PROJECT-UI-02A] Project workspace target not ready:", item.panelId);
      }
    });
    buttons.set(item.id, button);
    rootEl.appendChild(button);
  }

  function sync(panelId, moduleId) {
    const isProject = moduleId === "module.project";
    const projectState = isProject
      ? DEFAULT_PROJECT_WORKSPACE_REGISTRY.resolveWorkspaceState(panelId)
      : null;

    // PROJECT-UI-02A beschränkt ausschließlich die Projektinhalt-Navigation.
    // Die UI-REC-01B Global Shell/Drawer-Navigation (inkl. 3D Halle) wird hier
    // weder erzeugt noch verborgen oder umgeroutet.
    const showOpenNavigation = isProject && projectState === PROJECT_WORKSPACE_STATE.OPEN;
    rootEl.hidden = !showOpenNavigation;
    rootEl.dataset.projectState = projectState || "";

    const activeView = PANEL_TO_VIEW.get(String(panelId || "")) || null;
    for (const [id, button] of buttons.entries()) {
      const item = DEFAULT_PROJECT_WORKSPACE_REGISTRY.get(id);
      const allowed = showOpenNavigation && item?.workspaceState === PROJECT_WORKSPACE_STATE.OPEN;
      button.hidden = !allowed;

      const active = allowed && id === activeView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }

    rootEl.dataset.activeView = showOpenNavigation ? (activeView || "") : "";
  }

  return Object.freeze({
    sync,
    listVisibleViews: (state = PROJECT_WORKSPACE_STATE.OPEN) =>
      DEFAULT_PROJECT_WORKSPACE_REGISTRY.listAvailableForState(state),
    resolveWorkspaceState: (panelId) =>
      DEFAULT_PROJECT_WORKSPACE_REGISTRY.resolveWorkspaceState(panelId)
  });
}
