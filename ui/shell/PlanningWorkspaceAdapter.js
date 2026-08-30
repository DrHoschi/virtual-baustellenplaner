const SELECTORS = Object.freeze({
  root: ".wa-panel-root",
  shell: ".wa-shell",
  left: ".wa-left-dock",
  leftTabs: ".wa-left-dock .wa-tabs-bar",
  center: ".wa-center",
  viewport: ".wa-viewport-host",
  right: ".wa-right-dock",
  topbar: ".wa-topbar",
  bottom: ".wa-bottom-bar"
});

const PLANNING_LEFT_STATES = Object.freeze({
  "tab.structure": Object.freeze({ label: "Objektbaum", state: "object-tree" }),
  "tab.insert": Object.freeze({ label: "+ Einfügen", state: "insert" })
});

function mark(el, region, label) {
  if (!el) return false;
  el.dataset.bpPlanningRegion = region;
  if (label) el.setAttribute("aria-label", label);
  return true;
}

function findWithinOrSelf(root, selector) {
  if (root.matches?.(selector)) return root;
  return root.querySelector(selector);
}

function mapPlanningLeftArea(left) {
  if (!left) return null;

  left.dataset.bpPlanningLeftArea = "object-tree-insert-v1";

  const buttons = Array.from(left.querySelectorAll(".wa-tabs-btn[data-tab-id]"));
  if (!buttons.length) return null;

  let activeState = "object-tree";

  for (const button of buttons) {
    const tabId = String(button.dataset.tabId || "");
    const target = PLANNING_LEFT_STATES[tabId];

    if (!button.dataset.bpLegacyLabel) {
      button.dataset.bpLegacyLabel = String(button.textContent || "").trim();
    }

    if (!target) {
      button.hidden = true;
      button.dataset.bpPlanningLegacyHidden = "true";
      button.setAttribute("aria-hidden", "true");
      continue;
    }

    button.hidden = false;
    delete button.dataset.bpPlanningLegacyHidden;
    button.removeAttribute("aria-hidden");
    button.dataset.bpPlanningLeftState = target.state;
    button.textContent = target.label;
    button.setAttribute("aria-label", target.label === "Objektbaum" ? "Objektbaum anzeigen" : "Objekt einfügen");

    const selected = button.getAttribute("aria-selected") === "true" ||
      button.getAttribute("aria-pressed") === "true" ||
      button.classList.contains("active") ||
      button.classList.contains("is-active") ||
      button.dataset.active === "true";

    if (selected) activeState = target.state;
  }

  const insertButton = buttons.find((button) => button.dataset.tabId === "tab.insert");
  if (insertButton) {
    const insertLooksActive = insertButton.getAttribute("aria-selected") === "true" ||
      insertButton.getAttribute("aria-pressed") === "true" ||
      insertButton.classList.contains("active") ||
      insertButton.classList.contains("is-active") ||
      insertButton.dataset.active === "true";
    activeState = insertLooksActive ? "insert" : "object-tree";
  }

  left.dataset.bpPlanningLeftState = activeState;
  left.setAttribute("aria-label", activeState === "insert" ? "Einfügen" : "Objektbaum");

  return activeState;
}

export function createPlanningWorkspaceAdapter({ viewRoot } = {}) {
  if (!viewRoot) throw new Error("createPlanningWorkspaceAdapter: viewRoot fehlt");

  let observer = null;
  let active = false;

  function mapExistingWorkarea() {
    if (!active) return false;

    const root = findWithinOrSelf(viewRoot, SELECTORS.root);
    const shell = viewRoot.querySelector(SELECTORS.shell);
    const left = viewRoot.querySelector(SELECTORS.left);
    const center = viewRoot.querySelector(SELECTORS.center);
    const viewport = viewRoot.querySelector(SELECTORS.viewport);
    const right = viewRoot.querySelector(SELECTORS.right);
    const topbar = viewRoot.querySelector(SELECTORS.topbar);
    const bottom = viewRoot.querySelector(SELECTORS.bottom);

    if (!root || !shell || !left || !center || !viewport || !right) return false;

    root.dataset.bpWorkspace = "planning";
    root.dataset.bpPlanningLayout = "mapped-v1";
    shell.dataset.bpPlanningLayout = "three-region-v1";

    mark(left, "structure-content", "Objektbaum und Einfügen");
    mark(center, "workspace", "Planungsarbeitsfläche");
    mark(viewport, "viewport", "Planungsansicht");
    mark(right, "context", "Kontext und Eigenschaften");
    mark(topbar, "work-tools", "Werkzeuge und Ansichtssteuerung");
    mark(bottom, "status", "Planungsstatus");

    mapPlanningLeftArea(left);

    document.body.classList.add("bp-planning-workspace-active");
    return true;
  }

  function clearActiveMarker() {
    document.body.classList.remove("bp-planning-workspace-active");
  }

  function setActive(isActive) {
    active = Boolean(isActive);
    if (!active) {
      clearActiveMarker();
      return;
    }
    if (mapExistingWorkarea()) return;

    if (!observer) {
      observer = new MutationObserver(() => {
        if (!active) return;
        mapExistingWorkarea();
      });
      observer.observe(viewRoot, { childList: true, subtree: true });
    }
  }

  return Object.freeze({
    setActive,
    sync: mapExistingWorkarea,
    destroy() {
      active = false;
      clearActiveMarker();
      observer?.disconnect();
      observer = null;
    }
  });
}
