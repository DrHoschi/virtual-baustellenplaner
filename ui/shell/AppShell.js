import { createGlobalCommandBar } from "./GlobalCommandBar.js";
import { createModuleNavigation, resolveModuleFromPanel } from "./ModuleNavigation.js";
import { DEFAULT_MODULE_REGISTRY } from "../../core/navigation/module-registry.js";

function byId(id) {
  return document.getElementById(id);
}

function labelForModule(moduleId) {
  return DEFAULT_MODULE_REGISTRY.get(moduleId)?.label || "";
}

export function installAppShell({ bus } = {}) {
  const commandRoot = byId("globalCommandBar");
  const moduleRoot = byId("moduleNav");
  const legacyRoot = byId("legacyMenuWrap");
  const activeSource = byId("active");

  if (!commandRoot || !moduleRoot || !legacyRoot || !activeSource) {
    throw new Error("installAppShell: Shell-Container fehlen");
  }

  const closeMobileModules = () => {
    document.body.classList.remove("bp-shell-mobile-modules-open");
  };

  const moduleNav = createModuleNavigation({
    rootEl: moduleRoot,
    bus,
    onNavigate: () => closeMobileModules()
  });

  const commandBar = createGlobalCommandBar({
    rootEl: commandRoot,
    bus,
    onToggleLegacy: () => {
      document.body.classList.toggle("bp-shell-legacy-open");
    },
    onToggleMobileModules: () => {
      document.body.classList.toggle("bp-shell-mobile-modules-open");
    }
  });

  function syncActive() {
    const panelId = String(activeSource.textContent || "").trim();
    const moduleId = resolveModuleFromPanel(panelId);
    if (!moduleId) return;
    moduleNav.setActiveModule(moduleId);
    commandBar.setActiveLabel(labelForModule(moduleId));
  }

  syncActive();

  const observer = new MutationObserver(syncActive);
  observer.observe(activeSource, {
    childList: true,
    subtree: true,
    characterData: true
  });

  document.addEventListener("click", (ev) => {
    if (!document.body.classList.contains("bp-shell-mobile-modules-open")) return;
    const target = ev.target;
    if (!(target instanceof Node)) return;
    if (moduleRoot.contains(target)) return;
    if (commandRoot.contains(target)) return;
    closeMobileModules();
  }, true);

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    closeMobileModules();
    document.body.classList.remove("bp-shell-legacy-open");
  });

  return Object.freeze({
    syncActive,
    destroy() {
      observer.disconnect();
    }
  });
}
