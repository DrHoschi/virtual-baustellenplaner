import { installAppShell } from "./AppShell.js";

function prepareShellDom() {
  const app = document.querySelector(".app");
  const main = document.querySelector(".main");
  const legacyMenu = document.getElementById("menu");
  if (!app || !main || !legacyMenu) return false;

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

  if (!document.getElementById("legacyMenuWrap")) {
    const wrap = document.createElement("aside");
    wrap.id = "legacyMenuWrap";
    wrap.className = "bp-shell-im02__legacy";
    wrap.setAttribute("aria-label", "Legacy-Menü");
    legacyMenu.parentNode.insertBefore(wrap, legacyMenu);
    wrap.appendChild(legacyMenu);
  }

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
