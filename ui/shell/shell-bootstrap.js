import { installAppShell } from "./AppShell.js";
import { installPlanningTopbarAdapter } from "./PlanningTopbarAdapter.js";
import { installPlanningContextAdapter } from "./PlanningContextAdapter.js";
import { installPlanningStatusBarAdapter } from "./PlanningStatusBarAdapter.js";
import { installWorkareaFreezeDiagnostic01B1 } from "./WorkareaFreezeDiagnostic01B1.js";
import { installWorkareaFreezeDiagnostic01B2 } from "./WorkareaFreezeDiagnostic01B2.js";
import { installWorkareaFreezeDiagnostic01B3 } from "./WorkareaFreezeDiagnostic01B3.js";

installWorkareaFreezeDiagnostic01B1();
installWorkareaFreezeDiagnostic01B2();
installWorkareaFreezeDiagnostic01B3();

function ensureStylesheet(href, id) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function prepareDevLayer(app) {
  const debugTools = document.getElementById("debugTools");
  const snapshotWrap = document.getElementById("snapshotWrap");
  if (!debugTools && !snapshotWrap) return;

  let dev = document.getElementById("devLayer");
  if (!dev) {
    dev = document.createElement("aside");
    dev.id = "devLayer";
    dev.className = "bp-shell-im02__devlayer";
    dev.setAttribute("aria-label", "Entwicklerdiagnostik");
    dev.hidden = true;
    Object.assign(dev.style, {
      position: "fixed",
      top: "56px",
      right: "10px",
      bottom: "10px",
      width: "min(620px, calc(100vw - 20px))",
      overflow: "auto",
      padding: "10px",
      zIndex: "3200",
      background: "#ffffff",
      border: "1px solid #d1d5db",
      borderRadius: "14px",
      boxShadow: "0 18px 60px rgba(15,23,42,.22)"
    });
    app.appendChild(dev);
  }

  if (debugTools && debugTools.parentNode !== dev) dev.appendChild(debugTools);
  if (snapshotWrap && snapshotWrap.parentNode !== dev) dev.appendChild(snapshotWrap);
}

function prepareShellDom() {
  const app = document.querySelector(".app");
  const main = document.querySelector(".main");
  const legacyMenu = document.getElementById("menu");
  const view = document.getElementById("view");
  if (!app || !main || !legacyMenu || !view) return false;

  ensureStylesheet("./ui/css/ui-project-workspace-nav.css?v=1", "bpProjectWorkspaceNavStyles");
  ensureStylesheet("./ui/css/ui-planning-topbar.css?v=1", "bpPlanningTopbarStyles");
  ensureStylesheet("./ui/css/ui-planning-context.css?v=1", "bpPlanningContextStyles");
  ensureStylesheet("./ui/css/ui-planning-status.css?v=1", "bpPlanningStatusStyles");

  document.body.classList.add("bp-shell-im02");
  app.classList.add("bp-shell-im02__app");

  if (!document.getElementById("globalCommandBar")) {
    const commandBar = document.createElement("header");
    commandBar.id = "globalCommandBar";
    commandBar.className = "bp-shell-im02__commandbar";
    commandBar.setAttribute("aria-label", "Globale Befehle");
    app.insertBefore(commandBar, app.firstChild);
  }

  if (!document.getElementById("moduleNav")) {
    const moduleNav = document.createElement("aside");
    moduleNav.id = "moduleNav";
    moduleNav.className = "bp-shell-im02__modules";
    moduleNav.setAttribute("aria-label", "Arbeitsbereiche");
    app.insertBefore(moduleNav, main);
  }

  if (!document.getElementById("projectWorkspaceNav")) {
    const projectWorkspaceNav = document.createElement("nav");
    projectWorkspaceNav.id = "projectWorkspaceNav";
    projectWorkspaceNav.className = "bp-shell-im02__project-workspace-nav";
    projectWorkspaceNav.setAttribute("aria-label", "Projektbereiche");
    main.insertBefore(projectWorkspaceNav, view);
  }

  if (!document.getElementById("legacyMenuWrap")) {
    const wrap = document.createElement("aside");
    wrap.id = "legacyMenuWrap";
    wrap.className = "bp-shell-im02__legacy";
    wrap.setAttribute("aria-label", "Legacy-Menü");
    legacyMenu.parentNode.insertBefore(wrap, legacyMenu);
    wrap.appendChild(legacyMenu);
  }

  prepareDevLayer(app);
  const devLayer = document.getElementById("devLayer");
  installPlanningTopbarAdapter({ viewRoot: view, devLayer });
  installPlanningContextAdapter({ viewRoot: view });
  installPlanningStatusBarAdapter({ viewRoot: view, devLayer });

  const activeCard = document.getElementById("activeCard");
  if (activeCard) activeCard.classList.add("bp-shell-im02__compat-active");

  return true;
}

function waitForLegacyMenuAndInstall() {
  if (!prepareShellDom()) return;

  const menu = document.getElementById("menu");
  const install = () => {
    if (!menu?.querySelector("button[data-module-key]")) return false;
    try {
      installAppShell();
      document.body.classList.add("bp-shell-im02-ready");
      return true;
    } catch (error) {
      console.error("[UI-MIG-IM02] Shell install failed:", error);
      return false;
    }
  };

  if (install()) return;

  const observer = new MutationObserver(() => {
    if (!install()) return;
    observer.disconnect();
  });
  observer.observe(menu, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", waitForLegacyMenuAndInstall, { once: true });
} else {
  waitForLegacyMenuAndInstall();
}
