import { createGlobalCommandBar } from "./GlobalCommandBar.js";
import { createModuleNavigation, resolveModuleFromPanel, clickLegacyTarget } from "./ModuleNavigation.js";
import { createProjectWorkspaceNavigation } from "./ProjectWorkspaceNavigation.js";
import { createPlanningWorkspaceAdapter } from "./PlanningWorkspaceAdapter.js";
import { DEFAULT_MODULE_REGISTRY } from "../../core/navigation/module-registry.js";

function byId(id) {
  return document.getElementById(id);
}

function labelForModule(moduleId) {
  return DEFAULT_MODULE_REGISTRY.get(moduleId)?.label || "";
}

function activePanelId(activeSource) {
  return String(activeSource?.textContent || "").trim();
}

function setLegacyWorkareaHeaderVisible(viewRoot, visible) {
  const header = viewRoot?.querySelector?.(".wa-panel-header");
  if (!header) return;

  if (!header.dataset.bpLegacyDisplay) {
    header.dataset.bpLegacyDisplay = header.style.display || "flex";
  }

  if (visible) {
    header.hidden = false;
    header.style.setProperty("display", header.dataset.bpLegacyDisplay || "flex");
  } else {
    header.hidden = true;
    header.style.setProperty("display", "none", "important");
  }
}

export function installAppShell() {
  const commandRoot = byId("globalCommandBar");
  const moduleRoot = byId("moduleNav");
  const projectWorkspaceRoot = byId("projectWorkspaceNav");
  const legacyRoot = byId("legacyMenuWrap");
  const devRoot = byId("devLayer");
  const activeSource = byId("active");
  const viewRoot = byId("view");

  if (!commandRoot || !moduleRoot || !projectWorkspaceRoot || !legacyRoot || !activeSource || !viewRoot) {
    throw new Error("installAppShell: Shell-Container fehlen");
  }

  // UI-MIG-05H.2: Das alte Menü bleibt nur noch als unsichtbare Kompatibilitäts-
  // Quelle für programmgesteuerte Legacy-Ziele im DOM. Es ist kein sichtbarer
  // Teil der neuen Produktshell mehr.
  legacyRoot.hidden = true;
  document.body.classList.remove("bp-shell-legacy-open");

  let returnSession = null;
  let pendingRestore = null;

  const closeMobileModules = () => {
    document.body.classList.remove("bp-shell-mobile-modules-open");
  };

  const closeDebug = () => {
    if (devRoot) devRoot.hidden = true;
  };

  function clearReturnSession() {
    returnSession = null;
    commandBar?.setContextBack({ available: false });
  }

  function beginContextualTransition(detail = {}) {
    const sourcePanel = activePanelId(activeSource);
    const sourceModule = resolveModuleFromPanel(sourcePanel);
    if (!sourcePanel || !sourceModule) return;

    returnSession = Object.freeze({
      sourcePanel,
      sourceModule,
      targetPanel: String(detail.target || detail.panel || "").trim(),
      context: detail.context || null,
      viewScrollTop: Number(viewRoot.scrollTop || 0)
    });

    commandBar?.setContextBack({
      available: true,
      label: `← ${labelForModule(sourceModule) || "Zurück"}`
    });
  }

  function returnToContextSource() {
    if (!returnSession) return false;
    const session = returnSession;
    pendingRestore = session;
    returnSession = null;
    commandBar.setContextBack({ available: false });

    if (!clickLegacyTarget(session.sourcePanel)) {
      pendingRestore = null;
      console.warn("[UI-MIG-IM03] Return target not ready:", session.sourcePanel);
      return false;
    }
    return true;
  }

  const moduleNav = createModuleNavigation({
    rootEl: moduleRoot,
    onNavigate: () => {
      closeMobileModules();
      clearReturnSession();
    }
  });

  const projectWorkspaceNav = createProjectWorkspaceNavigation({
    rootEl: projectWorkspaceRoot,
    onNavigate: () => {
      clearReturnSession();
      document.body.classList.remove("bp-shell-legacy-open");
    }
  });

  const planningWorkspace = createPlanningWorkspaceAdapter({ viewRoot });

  const commandBar = createGlobalCommandBar({
    rootEl: commandRoot,
    onContextBack: returnToContextSource,
    onToggleDebug: () => {
      if (devRoot) devRoot.hidden = !devRoot.hidden;
      document.body.classList.remove("bp-shell-legacy-open");
    },
    onToggleMobileModules: () => {
      document.body.classList.toggle("bp-shell-mobile-modules-open");
    }
  });

  function syncActive() {
    const panelId = activePanelId(activeSource);
    const moduleId = resolveModuleFromPanel(panelId);
    const planningActive = moduleId === "module.planning";

    if (moduleId) {
      moduleNav.setActiveModule(moduleId);
      commandBar.setActiveLabel(labelForModule(moduleId));
    }
    projectWorkspaceNav.sync(panelId, moduleId);
    planningWorkspace.setActive(planningActive);
    setLegacyWorkareaHeaderVisible(viewRoot, !planningActive);

    if (pendingRestore && panelId === pendingRestore.sourcePanel) {
      const restore = pendingRestore;
      pendingRestore = null;
      requestAnimationFrame(() => {
        viewRoot.scrollTop = restore.viewScrollTop;
        document.dispatchEvent(new CustomEvent("bp:navigation:context-restored", {
          detail: {
            panel: restore.sourcePanel,
            moduleId: restore.sourceModule,
            context: restore.context
          }
        }));
      });
    }
  }

  syncActive();

  const observer = new MutationObserver(syncActive);
  observer.observe(activeSource, {
    childList: true,
    subtree: true,
    characterData: true
  });

  const viewObserver = new MutationObserver(() => {
    if (resolveModuleFromPanel(activePanelId(activeSource)) !== "module.planning") return;
    setLegacyWorkareaHeaderVisible(viewRoot, false);
    planningWorkspace.sync();
  });
  viewObserver.observe(viewRoot, { childList: true, subtree: true });

  const onContextualOpen = (ev) => beginContextualTransition(ev?.detail || {});
  document.addEventListener("bp:navigation:contextual-open", onContextualOpen);

  const onCompatibilityContextClick = (ev) => {
    const target = ev.target instanceof Element ? ev.target.closest("button") : null;
    if (!target) return;
    if (!/In AssetLab öffnen/i.test(String(target.textContent || ""))) return;
    if (activePanelId(activeSource) !== "projectPanel:assets") return;
    beginContextualTransition({ target: "projectPanel:assetlab3d" });
  };
  document.addEventListener("click", onCompatibilityContextClick, true);

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
    closeDebug();
  });

  return Object.freeze({
    syncActive,
    beginContextualTransition,
    returnToContextSource,
    getReturnSession: () => returnSession,
    destroy() {
      observer.disconnect();
      viewObserver.disconnect();
      planningWorkspace.destroy();
      setLegacyWorkareaHeaderVisible(viewRoot, true);
      document.removeEventListener("bp:navigation:contextual-open", onContextualOpen);
      document.removeEventListener("click", onCompatibilityContextClick, true);
    }
  });
}
