/**
 * Baustellenplaner – Minimal Menü-Renderer (datengetrieben)
 * Datei: app/ui/menu.js
 * Version: v1.1.0-mobile-header-clean (2026-05-16)
 *
 * ZIEL:
 * - Menü aus ui.config + aktiven Modul-Manifests bauen.
 * - Keine Modul-Logik hier.
 * - Emit Events bei Klick (UI -> Bus).
 *
 * CLEANUP:
 * - Der alte zusätzliche Mobile-Menü-Toggle im Menü wurde entfernt.
 * - Es gibt nur noch EINEN Mobile-Menü-Button: #btnMobileMenu in index.html.
 */

/**
 * Rendert das Menü in rootEl.
 *
 * @param {object} args
 * @param {HTMLElement} args.rootEl Ziel-Element, normalerweise #menu.
 * @param {Array<object>} args.menuModel Gruppen-/Item-Modell aus Registry/UI-Konfig.
 * @param {object} args.bus Event-Bus mit emit().
 */
export function renderMenu({ rootEl, menuModel, bus }) {
  if (!rootEl) throw new Error("renderMenu: rootEl fehlt");

  rootEl.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "bp-menu";

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

        // Mobile: Nach Auswahl das Overlay schließen.
        document.body.classList.remove("mobile-menu-open");
        document.getElementById("btnMobileMenu")?.setAttribute("aria-expanded", "false");
      });

      list.appendChild(btn);
    });

    gEl.appendChild(list);
    wrap.appendChild(gEl);
  });

  rootEl.appendChild(wrap);
}
