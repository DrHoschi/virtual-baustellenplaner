import { clickLegacyTarget } from "./ModuleNavigation.js";

const PROJECT_VIEWS = Object.freeze([
  { id: "general", label: "Übersicht", panel: "projectPanel:general" },
  { id: "projects", label: "Projekte", panel: "projectPanel:projects" },
  { id: "assets", label: "Assets", panel: "projectPanel:assets" },
  { id: "libraries", label: "Bibliotheken", panel: "projectPanel:libraries" }
]);

const PANEL_TO_VIEW = new Map(PROJECT_VIEWS.map((item) => [item.panel, item.id]));

export function createProjectWorkspaceNavigation({ rootEl, onNavigate } = {}) {
  if (!rootEl) throw new Error("createProjectWorkspaceNavigation: rootEl fehlt");

  rootEl.innerHTML = "";
  rootEl.classList.add("bp-project-workspace-nav");
  rootEl.hidden = true;
  rootEl.setAttribute("aria-label", "Projektbereiche");

  const buttons = new Map();
  for (const item of PROJECT_VIEWS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bp-project-workspace-nav__item";
    button.dataset.projectView = item.id;
    button.dataset.targetPanel = item.panel;
    button.textContent = item.label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      onNavigate?.(item);
      if (!clickLegacyTarget(item.panel)) {
        console.warn("[UI-MIG-04A] Project workspace target not ready:", item.panel);
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

  return Object.freeze({ sync });
}
