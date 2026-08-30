import { DEFAULT_MODULE_REGISTRY } from "../../core/navigation/module-registry.js";

const MODULE_TARGETS = Object.freeze({
  "module.project": "projectPanel:general",
  "module.planning": "tools:workarea",
  "module.asset-development": "projectPanel:assetlab3d",
  "module.settings": "settings:workspace"
});

const ACTIVE_PANEL_TO_MODULE = Object.freeze({
  "projectPanel:general": "module.project",
  "projectPanel:projects": "module.project",
  "projectPanel:wizard": "module.project",
  "projectPanel:assets": "module.project",
  "projectPanel:libraries": "module.project",
  "projectPanel:structure": "module.project",
  "projectPanel:versions": "module.project",
  "tools:workarea": "module.planning",
  "topbar:workarea": "module.planning",
  "projectPanel:assetlab3d": "module.asset-development",
  "assetlab:3d": "module.asset-development",
  "settings:workspace": "module.settings",
  "settings:app_settings": "module.settings",
  "settings:plugins": "module.settings",
  "settings:license": "module.settings",
  "settings:palette": "module.settings"
});

function visibleModules() {
  return DEFAULT_MODULE_REGISTRY
    .list()
    .filter((item) => item.status === "available" && MODULE_TARGETS[item.id]);
}

export function resolveModuleFromPanel(panelId) {
  return ACTIVE_PANEL_TO_MODULE[String(panelId || "").trim()] || null;
}

export function createModuleNavigation({ rootEl, bus, onNavigate } = {}) {
  if (!rootEl) throw new Error("createModuleNavigation: rootEl fehlt");

  const buttons = new Map();
  rootEl.innerHTML = "";
  rootEl.classList.add("bp-module-nav");

  const label = document.createElement("div");
  label.className = "bp-module-nav__brand";
  label.innerHTML = `<strong>Baustellenplaner</strong><span>Arbeitsbereiche</span>`;
  rootEl.appendChild(label);

  const list = document.createElement("nav");
  list.className = "bp-module-nav__list";
  list.setAttribute("aria-label", "Arbeitsbereiche");

  for (const mod of visibleModules()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bp-module-nav__item";
    button.dataset.moduleId = mod.id;
    button.dataset.iconId = mod.iconId || "";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<span class="bp-module-nav__mark" aria-hidden="true"></span><span class="bp-module-nav__text"></span>`;
    button.querySelector(".bp-module-nav__text").textContent = mod.label;

    button.addEventListener("click", () => {
      const target = MODULE_TARGETS[mod.id];
      if (!target) return;
      onNavigate?.(mod.id, target);
      bus?.emit?.("ui:navigate", { panel: target, source: "ui-mig-im02-module-nav" });
    });

    buttons.set(mod.id, button);
    list.appendChild(button);
  }

  rootEl.appendChild(list);

  function setActiveModule(moduleId) {
    for (const [id, button] of buttons.entries()) {
      const active = id === moduleId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    rootEl.dataset.activeModule = moduleId || "";
  }

  function syncFromPanel(panelId) {
    const moduleId = resolveModuleFromPanel(panelId);
    if (moduleId) setActiveModule(moduleId);
    return moduleId;
  }

  return Object.freeze({ setActiveModule, syncFromPanel });
}
