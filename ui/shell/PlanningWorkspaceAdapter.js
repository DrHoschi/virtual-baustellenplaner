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

const PLANNING_LEFT_STATES = Object.freeze({
  "tab.structure": Object.freeze({ label: "Objektbaum", state: "object-tree" }),
  "tab.insert": Object.freeze({ label: "+ Einfügen", state: "insert" })
});

const INSERT_SOURCES = Object.freeze([
  Object.freeze({ id: "recent-favorites", label: "Zuletzt / Favoriten", kind: "landing" }),
  Object.freeze({ id: "assets", label: "Assets", kind: "legacy-action", match: "assets" }),
  Object.freeze({ id: "assemblies", label: "Baugruppen", kind: "legacy-action", match: "baugruppen" }),
  Object.freeze({ id: "libraries", label: "Bibliotheken", kind: "project-source" })
]);

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

function setPlanningLeftState(left, state) {
  const normalized = state === "insert" ? "insert" : "object-tree";
  left.dataset.bpPlanningLeftState = normalized;
  left.setAttribute("aria-label", normalized === "insert" ? "Einfügen" : "Objektbaum");
}

function findButtonByText(root, needle) {
  const wanted = String(needle || "").trim().toLowerCase();
  if (!wanted) return null;
  return Array.from(root?.querySelectorAll?.("button") || []).find((button) => {
    if (button.closest?.("[data-bp-insert-sources]")) return false;
    return String(button.textContent || "").trim().toLowerCase().includes(wanted);
  }) || null;
}

function makeSourceHint(text) {
  const hint = document.createElement("div");
  hint.dataset.bpInsertSourceHint = "true";
  hint.style.fontSize = "12px";
  hint.style.lineHeight = "1.35";
  hint.style.opacity = ".72";
  hint.style.padding = "0 2px 8px";
  hint.textContent = text;
  return hint;
}

function ensureInsertSources(left) {
  const panelHost = left?.querySelector?.(".wa-panel-host");
  if (!panelHost) return null;

  let sourceNav = panelHost.querySelector(":scope > [data-bp-insert-sources]");
  if (sourceNav) return sourceNav;

  sourceNav = document.createElement("div");
  sourceNav.dataset.bpInsertSources = "v1";
  sourceNav.setAttribute("aria-label", "Einfügen-Quellen");
  sourceNav.style.display = "grid";
  sourceNav.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  sourceNav.style.gap = "6px";
  sourceNav.style.padding = "10px 10px 4px";

  const hintHost = document.createElement("div");
  hintHost.dataset.bpInsertSourceHintHost = "true";
  hintHost.style.gridColumn = "1 / -1";
  sourceNav.appendChild(hintHost);

  const setActiveSource = (sourceId) => {
    sourceNav.dataset.bpInsertSource = sourceId;
    for (const button of sourceNav.querySelectorAll("button[data-bp-insert-source]")) {
      const active = button.dataset.bpInsertSource === sourceId;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.style.background = active ? "rgba(255,255,255,.13)" : "rgba(255,255,255,.055)";
    }
  };

  const setHint = (text) => {
    hintHost.replaceChildren(makeSourceHint(text));
  };

  for (const source of INSERT_SOURCES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.bpInsertSource = source.id;
    button.textContent = source.label;
    button.style.minHeight = "34px";
    button.style.borderRadius = "10px";
    button.style.border = "1px solid rgba(255,255,255,.10)";
    button.style.background = "rgba(255,255,255,.055)";
    button.style.color = "inherit";
    button.style.fontWeight = "700";
    button.style.cursor = "pointer";

    button.addEventListener("click", () => {
      setActiveSource(source.id);

      if (source.kind === "landing") {
        setHint("Startquelle für zuletzt verwendete und favorisierte Einfügeelemente. Der aktuelle Stand führt noch keine eigene Favoriten-Datenbank in der Workarea.");
        return;
      }

      if (source.kind === "project-source") {
        setHint("Bibliotheken sind bereits eine Projektquelle. 05C kopiert ihre Verwaltung bewusst nicht in die Workarea; die spätere Einfüge-Anbindung erfolgt über die gemeinsame Bibliotheksquelle.");
        return;
      }

      const legacyAction = findButtonByText(panelHost, source.match);
      if (legacyAction) {
        legacyAction.click();
        return;
      }

      setHint(`${source.label} ist als Einfügequelle vorgesehen; der vorhandene Workarea-Zugang konnte in diesem Zustand nicht aufgelöst werden.`);
    });

    sourceNav.appendChild(button);
  }

  panelHost.prepend(sourceNav);
  setActiveSource("recent-favorites");
  setHint("Wähle eine Quelle. Vorhandene Asset- und Baugruppenfunktionen werden weiterverwendet; 05C erzeugt keine zweite Fachlogik.");
  return sourceNav;
}

function clearInsertSources(left) {
  left?.querySelectorAll?.("[data-bp-insert-sources]").forEach((node) => node.remove());
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

    if (!button.dataset.bpPlanningLeftWired) {
      button.dataset.bpPlanningLeftWired = "true";
      button.addEventListener("click", () => setPlanningLeftState(left, target.state));
    }

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
    activeState = insertLooksActive ? "insert" : activeState;
  }

  setPlanningLeftState(left, activeState);
  if (activeState === "insert") ensureInsertSources(left);
  else clearInsertSources(left);
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
