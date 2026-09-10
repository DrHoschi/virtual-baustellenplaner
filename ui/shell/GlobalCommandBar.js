import { clickLegacyTarget } from "./ModuleNavigation.js";

const BUILD_ID = "PROJECT-UI-04A · TESTBUILD 4";

const COMMAND_ICONS = Object.freeze({
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  new: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
  debug: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h6M8 9h8M7 13h10M9 19h6"/><path d="M8 8 6 6M16 8l2-2M7 13H4M17 13h3M9 18l-2 2M15 18l2 2"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>'
});

function makeButton(label, onClick, { title = "", className = "", icon = "" } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `bp-commandbar__button ${className}`.trim();
  btn.setAttribute("aria-label", label);
  if (title) btn.title = title;
  btn.innerHTML = `${icon ? `<span class="bp-commandbar__icon">${COMMAND_ICONS[icon] || ""}</span>` : ""}<span class="bp-commandbar__button-label">${label}</span>`;
  btn.addEventListener("click", onClick);
  return btn;
}

export function createGlobalCommandBar({
  rootEl,
  onToggleLegacy,
  onToggleDebug,
  onToggleMobileModules,
  onContextBack
} = {}) {
  if (!rootEl) throw new Error("createGlobalCommandBar: rootEl fehlt");

  rootEl.innerHTML = "";
  rootEl.classList.add("bp-commandbar");

  const mobileMenu = makeButton("Arbeitsbereiche", () => onToggleMobileModules?.(), {
    title: "Arbeitsbereiche öffnen",
    className: "bp-commandbar__mobile-menu",
    icon: "menu"
  });
  rootEl.appendChild(mobileMenu);

  const backButton = makeButton("Zurück", () => onContextBack?.(), {
    title: "Zur vorherigen Aufgabe zurückkehren",
    className: "bp-commandbar__back",
    icon: "back"
  });
  backButton.hidden = true;
  backButton.setAttribute("aria-disabled", "true");
  rootEl.appendChild(backButton);

  const brand = document.createElement("div");
  brand.className = "bp-commandbar__title";
  brand.innerHTML = `<strong id="shellActiveLabel">Projekt</strong><span>Baustellenplaner</span>`;

  const buildId = document.createElement("small");
  buildId.dataset.bpBuildId = "PROJECT-UI-04A-TESTBUILD-4";
  buildId.textContent = BUILD_ID;
  buildId.className = "bp-commandbar__build";
  brand.appendChild(buildId);
  rootEl.appendChild(brand);

  const spacer = document.createElement("div");
  spacer.className = "bp-commandbar__spacer";
  rootEl.appendChild(spacer);

  const commands = document.createElement("div");
  commands.className = "bp-commandbar__commands";
  commands.appendChild(makeButton("Neu", () => {
    clickLegacyTarget("projectPanel:wizard");
  }, { title: "Neues Projekt", icon: "new" }));
  commands.appendChild(makeButton("Datei", () => {
    clickLegacyTarget("projectPanel:projects");
  }, { title: "Projekte öffnen und verwalten", icon: "file" }));
  rootEl.appendChild(commands);

  rootEl.appendChild(makeButton("Debug", () => onToggleDebug?.(), {
    title: "Entwicklerdiagnostik ein-/ausblenden",
    className: "bp-commandbar__debug",
    icon: "debug"
  }));

  // Legacy-Menü bleibt ausschließlich interne Navigations-Bridge.
  void onToggleLegacy;

  function setActiveLabel(label) {
    const el = rootEl.querySelector("#shellActiveLabel");
    if (el) el.textContent = label || "";
  }

  function setContextBack({ available = false, label = "Zurück" } = {}) {
    backButton.hidden = !available;
    backButton.setAttribute("aria-disabled", available ? "false" : "true");
    backButton.setAttribute("aria-label", label || "Zurück");
    backButton.title = label || "Zurück";
    const text = backButton.querySelector(".bp-commandbar__button-label");
    if (text) text.textContent = label || "Zurück";
  }

  return Object.freeze({ setActiveLabel, setContextBack });
}
