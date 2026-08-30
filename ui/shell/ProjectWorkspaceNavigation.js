import { clickLegacyTarget } from "./ModuleNavigation.js";
import { DEFAULT_PROJECT_WORKSPACE_REGISTRY } from "../../core/navigation/project-workspace-registry.js";

const PROJECT_VIEWS = Object.freeze(DEFAULT_PROJECT_WORKSPACE_REGISTRY.listAvailable());
const PANEL_TO_VIEW = new Map(PROJECT_VIEWS.map((item) => [item.panelId, item.id]));

export function createProjectWorkspaceNavigation({ rootEl, onNavigate } = {}) {
  if (!rootEl) throw new Error("createProjectWorkspaceNavigation: rootEl fehlt");

  rootEl.innerHTML = "";
  rootEl.classList.add("bp-project-workspace-nav");
  rootEl.hidden = true;
  rootEl.setAttribute("aria-label", "Projektbereiche");
  rootEl.dataset.workspaceContract = "ui-mig-04b";

  const buttons = new Map();
  for (const item of PROJECT_VIEWS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bp-project-workspace-nav__item";
    button.dataset.projectView = item.id;
    button.dataset.targetPanel = item.panelId;
    button.textContent = item.label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      onNavigate?.(item);
      if (!clickLegacyTarget(item.panelId)) {
        console.warn("[UI-MIG-04B] Project workspace target not ready:", item.panelId);
      }
    });
    buttons.set(item.id, button);
    rootEl.appendChild(button);
  }

  function sync(panelId, moduleId) {
    const isProject = moduleId === "module.project";
    rootEl.hidden = !isProject;
    const activeView = PANEL_TO_VIEW.get(String(panelId || "")) || null;
    for (const [id, button] of buttons.entries()) {
      const active = isProject && id === activeView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    rootEl.dataset.activeView = activeView || "";
  }

  return Object.freeze({
    sync,
    listVisibleViews: () => [...PROJECT_VIEWS]
  });
}
