import { clickLegacyTarget } from "./ModuleNavigation.js";

function makeButton(label, onClick, { title = "", className = "" } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `bp-commandbar__button ${className}`.trim();
  btn.textContent = label;
  if (title) btn.title = title;
  btn.addEventListener("click", onClick);
  return btn;
}

export function createGlobalCommandBar({
  rootEl,
  onToggleDebug,
  onToggleMobileModules,
  onContextBack
} = {}) {
  if (!rootEl) throw new Error("createGlobalCommandBar: rootEl fehlt");

  rootEl.innerHTML = "";
  rootEl.classList.add("bp-commandbar");

  const mobileMenu = makeButton("☰", () => onToggleMobileModules?.(), {
    title: "Arbeitsbereiche öffnen",
    className: "bp-commandbar__mobile-menu"
  });
  mobileMenu.setAttribute("aria-label", "Arbeitsbereiche öffnen");
  rootEl.appendChild(mobileMenu);

  const backButton = makeButton("← Zurück", () => onContextBack?.(), {
    title: "Zur vorherigen Aufgabe zurückkehren",
    className: "bp-commandbar__back"
  });
  backButton.hidden = true;
  backButton.setAttribute("aria-label", "Zur vorherigen Aufgabe zurück");
  rootEl.appendChild(backButton);

  const brand = document.createElement("div");
  brand.className = "bp-commandbar__title";
  brand.innerHTML = `<strong>Baustellenplaner</strong><span id="shellActiveLabel">Projekt</span>`;
  rootEl.appendChild(brand);

  const commands = document.createElement("div");
  commands.className = "bp-commandbar__commands";
  commands.appendChild(makeButton("Neu", () => {
    clickLegacyTarget("projectPanel:wizard");
  }));
  commands.appendChild(makeButton("Datei", () => {
    clickLegacyTarget("projectPanel:projects");
  }, { title: "Projekte öffnen und verwalten" }));
  rootEl.appendChild(commands);

  const spacer = document.createElement("div");
  spacer.className = "bp-commandbar__spacer";
  rootEl.appendChild(spacer);

  rootEl.appendChild(makeButton("Debug", () => onToggleDebug?.(), {
    title: "Entwicklerdiagnostik ein-/ausblenden",
    className: "bp-commandbar__debug"
  }));

  function setActiveLabel(label) {
    const el = rootEl.querySelector("#shellActiveLabel");
    if (el) el.textContent = label || "";
  }

  function setContextBack({ available = false, label = "← Zurück" } = {}) {
    backButton.hidden = !available;
    backButton.textContent = label || "← Zurück";
    backButton.setAttribute("aria-disabled", available ? "false" : "true");
  }

  return Object.freeze({ setActiveLabel, setContextBack });
}
