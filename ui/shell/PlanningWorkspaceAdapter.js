const SELECTORS = Object.freeze({
  root: ".wa-panel-root",
  shell: ".wa-shell",
  left: ".wa-left-dock",
  center: ".wa-center",
  viewport: ".wa-viewport-host",
  right: ".wa-right-dock",
  topbar: ".wa-topbar",
  bottom: ".wa-bottom-bar"
});

function mark(el, region, label) {
  if (!el) return false;
  el.dataset.bpPlanningRegion = region;
  if (label) el.setAttribute("aria-label", label);
  return true;
}

export function createPlanningWorkspaceAdapter({ viewRoot } = {}) {
  if (!viewRoot) throw new Error("createPlanningWorkspaceAdapter: viewRoot fehlt");

  let observer = null;
  let active = false;

  function mapExistingWorkarea() {
    if (!active) return false;

    const root = viewRoot.querySelector(SELECTORS.root);
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

    mark(left, "structure-content", "Struktur und Einfügen");
    mark(center, "workspace", "Planungsarbeitsfläche");
    mark(viewport, "viewport", "Planungsansicht");
    mark(right, "context", "Kontext und Eigenschaften");
    mark(topbar, "work-tools", "Werkzeuge und Ansichtssteuerung");
    mark(bottom, "status", "Planungsstatus");

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
