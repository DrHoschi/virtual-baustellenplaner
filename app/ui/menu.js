/**
 * Baustellenplaner – Minimal Menü-Renderer (datengetrieben)
 * Datei: app/ui/menu.js
 * Version: v1.0.0 (2026-02-03)
 *
 * Ziel:
 * - Menü aus ui.config + aktiven Modul-Manifests bauen
 * - Keine Modul-Logik hier!
 * - Emit Events bei Klick (UI -> Bus)
 *
 * Erwartet:
 * - bus.emit("ui:menu:select", { moduleKey })
 */

export function renderMenu({ rootEl, menuModel, bus }) {
  if (!rootEl) throw new Error("renderMenu: rootEl fehlt");
  rootEl.innerHTML = "";

  // --- Mobile Menü Toggle (iPhone)
// Speichert Zustand in localStorage, damit er beim Reload gleich bleibt.
// Wichtig: Wir toggeln eine Klasse auf <html>, damit CSS den Rest steuern kann.
const isMobile = window.matchMedia && window.matchMedia("(max-width: 520px)").matches;
if (isMobile) {
  const saved = localStorage.getItem("bp:menuCollapsed");
  if (saved === "1") document.documentElement.classList.add("bp-menu-collapsed");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "bp-menuToggle";
  toggle.textContent = "☰ Menü";

  toggle.addEventListener("click", () => {
    const root = document.documentElement;
    const next = !root.classList.contains("bp-menu-collapsed");
    root.classList.toggle("bp-menu-collapsed", next);
    localStorage.setItem("bp:menuCollapsed", next ? "1" : "0");
  });

  rootEl.appendChild(toggle);
}

const wrap = document.createElement("div");
  wrap.className = "bp-menu";

  menuModel.forEach((group) => {
    const gEl = document.createElement("div");
    gEl.className = "bp-menu__group";

    const title = document.createElement("div");
    title.className = "bp-menu__groupTitle";
    title.textContent = group.label || group.key;
    gEl.appendChild(title);

    const list = document.createElement("div");
    list.className = "bp-menu__items";

    group.items.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "bp-menu__item";
      btn.type = "button";
      btn.dataset.moduleKey = item.moduleKey;
      btn.innerHTML = item.icon
        ? `<span class="bp-menu__icon ${item.icon}"></span><span class="bp-menu__label">${item.label}</span>`
        : `<span class="bp-menu__label">${item.label}</span>`;

      btn.addEventListener("click", () => {
        if (bus) bus.emit("ui:menu:select", { moduleKey: item.moduleKey });
      });

      list.appendChild(btn);
    });

    gEl.appendChild(list);
    wrap.appendChild(gEl);
  });

  rootEl.appendChild(wrap);
}
