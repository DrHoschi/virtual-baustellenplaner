const TOPBAR_SELECTOR = ".wa-topbar";
const MODE_SELECT_SELECTOR = ".wa-mode-select";

const TOOL_BUTTONS = Object.freeze([
  Object.freeze({ id: "select", label: "Auswahl", kind: "work-tool" }),
  Object.freeze({ id: "place", label: "Platzieren", kind: "work-tool" }),
  Object.freeze({ id: "edit", label: "Edit", kind: "legacy" })
]);

function makeSection(id, label) {
  const section = document.createElement("section");
  section.dataset.bpPlanningTopbarSection = id;
  section.className = `bp-planning-topbar__section bp-planning-topbar__section--${id}`;
  section.setAttribute("aria-label", label);

  const title = document.createElement("span");
  title.className = "bp-planning-topbar__section-title";
  title.textContent = label;
  section.appendChild(title);
  return section;
}

function makeModeButton(modeSelect, { id, label, kind }) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.bpPlanningMode = id;
  button.dataset.bpPlanningToolKind = kind;
  button.className = "bp-planning-topbar__mode-btn";
  button.textContent = label;

  const optionExists = Array.from(modeSelect?.options || []).some((option) => String(option.value) === id);
  button.disabled = !optionExists;

  if (kind === "legacy") {
    button.dataset.bpPlanningLegacy = "true";
    button.title = "Bestehender Workarea-Modus – bleibt während der Migration als Legacy-Kompatibilität erhalten.";
  }

  button.addEventListener("click", () => {
    if (!modeSelect || button.disabled) return;
    modeSelect.value = id;
    modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  return button;
}

function syncModeButtons(topbar, modeSelect) {
  const activeMode = String(modeSelect?.value || "select");
  for (const button of topbar.querySelectorAll("button[data-bp-planning-mode]")) {
    const active = button.dataset.bpPlanningMode === activeMode;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.dataset.bpPlanningActive = active ? "true" : "false";
  }
}

function moveCurrentDebugGroup(topbar, devLayer) {
  const debugGroup = topbar.querySelector(":scope > .wa-debug-group");
  if (!debugGroup || !devLayer) return;

  let host = devLayer.querySelector('[data-bp-planning-devtools="05e-b"]');
  if (!host) {
    host = document.createElement("section");
    host.dataset.bpPlanningDevtools = "05e-b";
    host.className = "bp-planning-devtools";
    host.setAttribute("aria-label", "Planning Entwicklerwerkzeuge");

    const title = document.createElement("div");
    title.className = "bp-planning-devtools__title";
    title.textContent = "Planning Diagnose";
    host.appendChild(title);
    devLayer.appendChild(host);
  }

  host.querySelectorAll(":scope > .wa-debug-group").forEach((old) => old.remove());
  debugGroup.dataset.bpPlanningDevGroup = "true";
  host.appendChild(debugGroup);
}

function restoreLegacyGroups(topbar) {
  const semanticRoot = topbar.querySelector(":scope > [data-bp-planning-topbar='05e-b']");
  if (!semanticRoot) return;
  const groups = Array.from(semanticRoot.querySelectorAll(":scope > section > .wa-topbar-group"));
  for (const group of groups) topbar.appendChild(group);
  semanticRoot.remove();
}

function mapTopbar(topbar, devLayer) {
  if (!topbar) return false;

  const alreadyMapped = topbar.querySelector(":scope > [data-bp-planning-topbar='05e-b']");
  if (alreadyMapped) {
    const modeSelect = topbar.querySelector(MODE_SELECT_SELECTOR);
    if (modeSelect) syncModeButtons(topbar, modeSelect);
    return true;
  }

  const statusGroup = topbar.querySelector(":scope > .wa-status-group");
  const modeGroup = topbar.querySelector(":scope > .wa-mode-group");
  const zoomGroup = topbar.querySelector(":scope > .wa-zoom-group");
  const infoGroup = topbar.querySelector(":scope > .wa-info-group");
  const dockGroup = topbar.querySelector(":scope > .wa-dock-group");
  const modeSelect = modeGroup?.querySelector(MODE_SELECT_SELECTOR) || topbar.querySelector(MODE_SELECT_SELECTOR);

  if (!modeGroup || !modeSelect || !zoomGroup || !infoGroup || !dockGroup) return false;

  moveCurrentDebugGroup(topbar, devLayer);

  const semanticRoot = document.createElement("div");
  semanticRoot.dataset.bpPlanningTopbar = "05e-b";
  semanticRoot.className = "bp-planning-topbar";
  semanticRoot.setAttribute("aria-label", "Planning Werkzeugleiste");

  const workTools = makeSection("work-tools", "Arbeitswerkzeuge");
  for (const definition of TOOL_BUTTONS) {
    workTools.appendChild(makeModeButton(modeSelect, definition));
  }

  // Bestehenden Mode-Selector als Kompatibilitätsanker behalten. Er bleibt im DOM,
  // damit alle bestehenden Workarea-Handler unverändert Eigentümer der Moduslogik sind.
  modeGroup.dataset.bpPlanningLegacyModeControl = "true";
  modeGroup.hidden = true;
  workTools.appendChild(modeGroup);

  const navigation = makeSection("navigation", "Navigation");
  navigation.appendChild(makeModeButton(modeSelect, { id: "pan", label: "Pan", kind: "navigation" }));
  zoomGroup.dataset.bpPlanningNavigationControl = "zoom";
  navigation.appendChild(zoomGroup);

  const viewOptions = makeSection("view-options", "Ansichtsoptionen");
  infoGroup.dataset.bpPlanningViewOptions = "grid-snap";
  infoGroup.setAttribute("aria-label", "Raster und Snap");
  viewOptions.appendChild(infoGroup);

  const workspace = makeSection("workspace-layout", "Arbeitsbereich / Layout");
  if (statusGroup) {
    statusGroup.dataset.bpPlanningWorkspaceStatus = "true";
    workspace.appendChild(statusGroup);
  }
  dockGroup.dataset.bpPlanningWorkspaceLayoutControls = "true";
  workspace.appendChild(dockGroup);

  semanticRoot.appendChild(workTools);
  semanticRoot.appendChild(navigation);
  semanticRoot.appendChild(viewOptions);
  semanticRoot.appendChild(workspace);
  topbar.appendChild(semanticRoot);
  topbar.dataset.bpPlanningTopbarMapped = "05e-b";

  syncModeButtons(topbar, modeSelect);
  modeSelect.addEventListener("change", () => queueMicrotask(() => syncModeButtons(topbar, modeSelect)));
  return true;
}

export function installPlanningTopbarAdapter({ viewRoot, devLayer } = {}) {
  if (!viewRoot) throw new Error("installPlanningTopbarAdapter: viewRoot fehlt");

  if (viewRoot.__bpPlanningTopbarAdapter05EB) {
    viewRoot.__bpPlanningTopbarAdapter05EB.sync();
    return viewRoot.__bpPlanningTopbarAdapter05EB;
  }

  let scheduled = false;

  const sync = () => {
    scheduled = false;
    const topbar = viewRoot.querySelector(TOPBAR_SELECTOR);
    if (!topbar) {
      devLayer?.querySelector?.('[data-bp-planning-devtools="05e-b"]')?.remove();
      return false;
    }
    return mapTopbar(topbar, devLayer);
  };

  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(sync);
  };

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
      if (!target) return false;
      return target.matches?.(TOPBAR_SELECTOR) ||
        target.closest?.(TOPBAR_SELECTOR) ||
        Array.from(mutation.addedNodes || []).some((node) =>
          node?.matches?.(TOPBAR_SELECTOR) || node?.querySelector?.(TOPBAR_SELECTOR)
        );
    });
    if (relevant) scheduleSync();
  });

  observer.observe(viewRoot, { childList: true, subtree: true });
  sync();

  const api = Object.freeze({
    sync,
    destroy() {
      observer.disconnect();
      const topbar = viewRoot.querySelector(TOPBAR_SELECTOR);
      if (topbar) restoreLegacyGroups(topbar);
      devLayer?.querySelector?.('[data-bp-planning-devtools="05e-b"]')?.remove();
      delete viewRoot.__bpPlanningTopbarAdapter05EB;
    }
  });

  viewRoot.__bpPlanningTopbarAdapter05EB = api;
  return api;
}
