/**
 * Baustellenplaner – Minimal Menü-Renderer (datengetrieben)
 * Datei: ui/menu/menu.js
 * Version: ui-mig-02-im02-legacy-bridge-v2 (2026-08-30)
 *
 * ZIEL:
 * - Menü aus ui.config + aktiven Modul-Manifests bauen.
 * - Keine Modul-Logik hier.
 * - Emit Events bei Klick (UI -> Bus).
 * - UI-MIG-02: versteckter Compatibility-Bridge-Button für Asset-Entwicklung,
 *   damit die neue Shell denselben bestehenden Bus-/Routerpfad nutzen kann.
 */

export function renderMenu({ rootEl, menuModel, bus }) {
  if (!rootEl) throw new Error("renderMenu: rootEl fehlt");

  rootEl.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "bp-menu";

  const closeNavigationOverlays = () => {
    document.body.classList.remove("mobile-menu-open");
    document.body.classList.remove("bp-shell-legacy-open");
    document.getElementById("btnMobileMenu")?.setAttribute("aria-expanded", "false");
  };

  const groups = Array.isArray(menuModel) ? menuModel : [];

  groups.forEach((group) => {
    const gEl = document.createElement("div");
    gEl.className = "bp-menu__group";

    const title = document.createElement("div");
    title.className = "bp-menu__groupTitle";
    title.textContent = group.label || group.key || "Gruppe";
    gEl.appendChild(title);

    const list = document.createElement("div");
    list.className = "bp-menu__items";

    const items = Array.isArray(group.items) ? group.items : [];

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "bp-menu__item";
      btn.type = "button";
      btn.dataset.moduleKey = item.moduleKey || "";

      if (item.icon) {
        btn.innerHTML = `<span class="bp-menu__icon ${item.icon}"></span><span class="bp-menu__label"></span>`;
        const label = btn.querySelector(".bp-menu__label");
        if (label) label.textContent = item.label || item.moduleKey || "Modul";
      } else {
        const label = document.createElement("span");
        label.className = "bp-menu__label";
        label.textContent = item.label || item.moduleKey || "Modul";
        btn.appendChild(label);
      }

      btn.addEventListener("click", () => {
        if (bus) bus.emit("ui:menu:select", { moduleKey: item.moduleKey });
        closeNavigationOverlays();
      });

      list.appendChild(btn);
    });

    gEl.appendChild(list);
    wrap.appendChild(gEl);
  });

  // UI-MIG-02-IM02: AssetLab war historisch kein Menüeintrag, sondern wurde nur
  // aus Projekt-Assets geöffnet. Für die neue Modulnavigation benötigen wir
  // während des Parallelbetriebs exakt denselben Bus-Pfad, ohne loader.js zu ändern.
  // Der Button ist nicht sichtbar und wird nach der Migration wieder entfernt.
  if (!rootEl.querySelector('button[data-module-key="projectPanel:assetlab3d"]')) {
    const bridge = document.createElement("button");
    bridge.type = "button";
    bridge.hidden = true;
    bridge.tabIndex = -1;
    bridge.dataset.moduleKey = "projectPanel:assetlab3d";
    bridge.setAttribute("aria-hidden", "true");
    bridge.addEventListener("click", () => {
      if (bus) bus.emit("ui:menu:select", { moduleKey: "projectPanel:assetlab3d" });
      closeNavigationOverlays();
    });
    wrap.appendChild(bridge);
  }

  rootEl.appendChild(wrap);
}
