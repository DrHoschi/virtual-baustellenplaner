import { DEFAULT_MODULE_REGISTRY } from "../../core/navigation/module-registry.js";

const MODULE_TARGETS = Object.freeze({
  "module.project": "projectPanel:general",
  "module.planning": "tools:workarea",
  "module.hall3d": "projectPanel:hall3d",
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
  "projectPanel:hall3d": "module.hall3d",
  "projectPanel:assetlab3d": "module.asset-development",
  "assetlab:3d": "module.asset-development",
  "settings:workspace": "module.settings",
  "settings:app_settings": "module.settings",
  "settings:plugins": "module.settings",
  "settings:license": "module.settings",
  "settings:palette": "module.settings"
});

const PRIMARY_MODULE_IDS = Object.freeze([
  "module.project",
  "module.planning",
  "module.asset-development",
  "module.settings"
]);

const ICONS = Object.freeze({
  project: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h6l2 2H20v11H4z"/><path d="M4 9h16"/></svg>',
  planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  hall3d: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5 12 12 4 7.5z"/><path d="M4 7.5V16.5L12 21V12"/><path d="M20 7.5V16.5L12 21"/></svg>',
  "asset-edit": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></svg>'
});

function moduleIcon(iconId) {
  return ICONS[iconId] || ICONS.project;
}

function availableModule(id) {
  const item = DEFAULT_MODULE_REGISTRY.get(id);
  return item?.status === "available" && MODULE_TARGETS[item.id] ? item : null;
}

function createNavButton(mod, { secondary = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `bp-module-nav__item${secondary ? " bp-module-nav__item--secondary" : ""}`;
  button.dataset.moduleId = mod.id;
  button.dataset.iconId = mod.iconId || "";
  button.dataset.zone = mod.navigationZone || "";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", mod.label);
  button.title = mod.label;
  button.innerHTML = `<span class="bp-module-nav__icon">${moduleIcon(mod.iconId)}</span><span class="bp-module-nav__text"></span>`;
  button.querySelector(".bp-module-nav__text").textContent = mod.label;
  return button;
}

export function resolveModuleFromPanel(panelId) {
  return ACTIVE_PANEL_TO_MODULE[String(panelId || "").trim()] || null;
}

export function clickLegacyTarget(target) {
  const selector = `#menu button[data-module-key="${CSS.escape(String(target || ""))}"]`;
  const button = document.querySelector(selector);
  if (!button) return false;
  button.click();
  return true;
}

export function createModuleNavigation({ rootEl, onNavigate } = {}) {
  if (!rootEl) throw new Error("createModuleNavigation: rootEl fehlt");

  const buttons = new Map();
  rootEl.innerHTML = "";
  rootEl.classList.add("bp-module-nav");

  const brand = document.createElement("div");
  brand.className = "bp-module-nav__brand";
  brand.innerHTML = '<span class="bp-module-nav__brand-mark" aria-hidden="true">BP</span><span class="bp-module-nav__brand-text">Baustellenplaner</span>';
  rootEl.appendChild(brand);

  const list = document.createElement("nav");
  list.className = "bp-module-nav__list";
  list.setAttribute("aria-label", "Arbeitsbereiche");

  const navigate = (mod) => {
    const target = MODULE_TARGETS[mod.id];
    if (!target) return;
    onNavigate?.(mod.id, target);
    if (!clickLegacyTarget(target)) {
      console.warn("[UI-REC-01B] Legacy navigation target not ready:", target);
    }
  };

  for (const moduleId of PRIMARY_MODULE_IDS) {
    const mod = availableModule(moduleId);
    if (!mod) continue;

    const button = createNavButton(mod);
    button.addEventListener("click", () => navigate(mod));
    buttons.set(mod.id, button);
    list.appendChild(button);

    if (mod.id === "module.planning") {
      const hall = availableModule("module.hall3d");
      if (hall) {
        const hallButton = createNavButton(hall, { secondary: true });
        hallButton.addEventListener("click", () => navigate(hall));
        buttons.set(hall.id, hallButton);
        list.appendChild(hallButton);
      }
    }
  }

  rootEl.appendChild(list);

  function setActiveModule(moduleId) {
    for (const [id, button] of buttons.entries()) {
      const active = id === moduleId;
      const parentActive = id === "module.planning" && moduleId === "module.hall3d";
      button.classList.toggle("is-active", active);
      button.classList.toggle("is-parent-active", parentActive);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    rootEl.dataset.activeModule = moduleId || "";
  }

  return Object.freeze({ setActiveModule });
}
