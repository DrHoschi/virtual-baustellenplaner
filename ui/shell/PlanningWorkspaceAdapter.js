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

const LEGACY_INSERT_SOURCE_TABS = Object.freeze({
  "tab.assets": "assets",
  "tab.assemblylab": "assemblies"
});

const INSERT_SOURCES = Object.freeze([
  Object.freeze({ id: "recent-favorites", label: "Zuletzt / Favoriten", kind: "landing" }),
  Object.freeze({ id: "assets", label: "Assets", kind: "legacy-action", match: "assets" }),
  Object.freeze({ id: "assemblies", label: "Baugruppen", kind: "legacy-action", match: "baugruppen" }),
  Object.freeze({ id: "libraries", label: "Bibliotheken", kind: "project-source" })
]);

const INSERT_FLOW_PHASES = Object.freeze(["source", "selected", "placing", "placed"]);

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

function findPanelHost(left) {
  if (!left) return null;
  const explicit = left.querySelector?.(".wa-panel-host");
  if (explicit) return explicit;

  return Array.from(left.children || []).find((child) => {
    if (child.matches?.("[data-bp-insert-sources]")) return false;
    return !child.querySelector?.('.wa-tabs-btn[data-tab-id]');
  }) || null;
}

function isLegacyInlineActive(button) {
  const background = String(button?.style?.background || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  return background === "rgba(255,255,255,0.12)" || background === "rgba(255,255,255,.12)";
}

function isActiveTab(button) {
  return button?.getAttribute?.("aria-selected") === "true" ||
    button?.getAttribute?.("aria-pressed") === "true" ||
    button?.classList?.contains("active") ||
    button?.classList?.contains("is-active") ||
    button?.dataset?.active === "true" ||
    isLegacyInlineActive(button);
}

function setPlanningLeftState(left, state) {
  const normalized = state === "insert" ? "insert" : "object-tree";
  left.dataset.bpPlanningLeftState = normalized;
  left.setAttribute("aria-label", normalized === "insert" ? "Einfügen" : "Objektbaum");
}

function setInsertSource(left, sourceId) {
  const normalized = INSERT_SOURCES.some((source) => source.id === sourceId) ? sourceId : "recent-favorites";
  left.dataset.bpInsertSource = normalized;
  return normalized;
}

function sourceLabel(sourceId) {
  return INSERT_SOURCES.find((source) => source.id === sourceId)?.label || "Quelle";
}

function setInsertFlowState(left, { phase = "source", label = "", sourceId = null } = {}) {
  const normalizedPhase = INSERT_FLOW_PHASES.includes(phase) ? phase : "source";
  if (sourceId) setInsertSource(left, sourceId);
  left.dataset.bpInsertFlowPhase = normalizedPhase;
  if (label) left.dataset.bpInsertFlowLabel = String(label).trim();
  else if (normalizedPhase === "source") delete left.dataset.bpInsertFlowLabel;
  return normalizedPhase;
}

function findButtonByText(root, needle) {
  const wanted = String(needle || "").trim().toLowerCase();
  if (!wanted) return null;
  return Array.from(root?.querySelectorAll?.("button") || []).find((button) => {
    if (button.closest?.("[data-bp-insert-sources], [data-bp-insert-flow]")) return false;
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

function applySourceActiveState(sourceNav, sourceId) {
  const normalized = INSERT_SOURCES.some((source) => source.id === sourceId) ? sourceId : "recent-favorites";
  sourceNav.dataset.bpInsertSource = normalized;
  for (const button of sourceNav.querySelectorAll("button[data-bp-insert-source]")) {
    const active = button.dataset.bpInsertSource === normalized;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.style.background = active ? "rgba(255,255,255,.13)" : "rgba(255,255,255,.055)";
  }
}

function flowStep(label, state) {
  const el = document.createElement("div");
  el.dataset.bpInsertFlowStep = state;
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.gap = "5px";
  el.style.fontSize = "11px";
  el.style.fontWeight = "700";
  el.style.opacity = ".72";
  el.textContent = label;
  return el;
}

function syncLegacyPlacementControls(left) {
  const panelHost = findPanelHost(left);
  if (!panelHost) return;
  const sourceId = left.dataset.bpInsertSource || "recent-favorites";

  const assetPlace = findButtonByText(panelHost, "Place-Mode wechseln");
  if (assetPlace) {
    assetPlace.dataset.bpLegacyPlacementControl = "asset";
    assetPlace.hidden = sourceId === "assets";
  }

  const assemblyPlace = panelHost.querySelector?.(".wa-assemblylab-insert-btn");
  if (assemblyPlace) {
    assemblyPlace.dataset.bpLegacyPlacementControl = "assembly";
    assemblyPlace.hidden = sourceId === "assemblies";
  }
}

function invokeExistingPlacement(left) {
  const panelHost = findPanelHost(left);
  if (!panelHost) return false;
  const sourceId = left.dataset.bpInsertSource || "recent-favorites";

  if (sourceId === "assets") {
    const legacy = panelHost.querySelector('[data-bp-legacy-placement-control="asset"]') ||
      findButtonByText(panelHost, "Place-Mode wechseln");
    if (!legacy) return false;
    legacy.click();
    setInsertFlowState(left, { phase: "placing", sourceId, label: left.dataset.bpInsertFlowLabel || "Asset" });
    queueMicrotask(() => {
      setPlanningLeftState(left, "insert");
      setInsertSource(left, sourceId);
      ensureInsertSources(left, sourceId);
    });
    return true;
  }

  if (sourceId === "assemblies") {
    const legacy = panelHost.querySelector('[data-bp-legacy-placement-control="assembly"], .wa-assemblylab-insert-btn');
    if (!legacy) return false;
    legacy.click();
    setInsertFlowState(left, {
      phase: "placed",
      sourceId,
      label: left.dataset.bpInsertFlowLabel || "Aktive Baugruppenvariante"
    });
    queueMicrotask(() => ensureInsertSources(left, sourceId));
    return true;
  }

  return false;
}

function ensureInsertFlow(left) {
  const panelHost = findPanelHost(left);
  const sourceNav = panelHost?.querySelector?.(":scope > [data-bp-insert-sources]");
  if (!panelHost || !sourceNav) return null;

  const sourceId = left.dataset.bpInsertSource || "recent-favorites";
  let phase = left.dataset.bpInsertFlowPhase || "source";

  if (sourceId === "assemblies" && phase === "source" && panelHost.querySelector(".wa-assemblylab-insert-btn")) {
    phase = setInsertFlowState(left, {
      phase: "selected",
      sourceId,
      label: left.dataset.bpInsertFlowLabel || "Aktive Baugruppenvariante"
    });
  }

  let flow = panelHost.querySelector(":scope > [data-bp-insert-flow]");
  if (!flow) {
    flow = document.createElement("section");
    flow.dataset.bpInsertFlow = "v1";
    flow.setAttribute("aria-label", "Einfügen-Ablauf");
    flow.style.margin = "6px 10px 8px";
    flow.style.padding = "9px";
    flow.style.border = "1px solid rgba(255,255,255,.10)";
    flow.style.borderRadius = "10px";
    flow.style.background = "rgba(255,255,255,.035)";
    sourceNav.insertAdjacentElement("afterend", flow);
  }

  flow.innerHTML = "";
  flow.dataset.bpInsertFlowPhase = phase;
  flow.dataset.bpInsertFlowSource = sourceId;

  const steps = document.createElement("div");
  steps.style.display = "grid";
  steps.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  steps.style.gap = "6px";
  steps.appendChild(flowStep("1 Quelle", "source"));
  steps.appendChild(flowStep("2 Auswahl", "selected"));
  steps.appendChild(flowStep("3 Platzieren", "placing"));
  flow.appendChild(steps);

  const rank = phase === "source" ? 0 : phase === "selected" ? 1 : 2;
  Array.from(steps.children).forEach((step, index) => {
    const reached = index <= rank;
    step.dataset.bpInsertFlowReached = reached ? "true" : "false";
    step.style.opacity = reached ? "1" : ".45";
  });

  const summary = document.createElement("div");
  summary.dataset.bpInsertFlowSummary = "true";
  summary.style.marginTop = "8px";
  summary.style.fontSize = "12px";
  summary.style.lineHeight = "1.35";
  const selectedLabel = left.dataset.bpInsertFlowLabel || "";
  summary.textContent = phase === "source"
    ? `${sourceLabel(sourceId)} gewählt – jetzt Element auswählen.`
    : phase === "selected"
      ? `${selectedLabel || "Element"} ausgewählt – bereit zum Platzieren.`
      : phase === "placing"
        ? `${selectedLabel || "Element"} ist als aktiver Platzierkontext gesetzt.`
        : `${selectedLabel || "Element"} wurde über die bestehende Platzierfunktion eingefügt.`;
  flow.appendChild(summary);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "6px";
  actions.style.flexWrap = "wrap";
  actions.style.marginTop = "8px";

  if ((sourceId === "assets" || sourceId === "assemblies") && (phase === "selected" || phase === "placing")) {
    const place = document.createElement("button");
    place.type = "button";
    place.dataset.bpInsertFlowAction = "place";
    place.textContent = phase === "placing" ? "Platzieren aktiv" : "Platzieren";
    place.disabled = phase === "placing";
    place.style.minHeight = "32px";
    place.style.borderRadius = "9px";
    place.style.border = "1px solid rgba(255,255,255,.14)";
    place.style.fontWeight = "700";
    place.addEventListener("click", () => invokeExistingPlacement(left));
    actions.appendChild(place);
  }

  const back = document.createElement("button");
  back.type = "button";
  back.dataset.bpInsertFlowAction = "back-to-sources";
  back.textContent = "← Zu den Quellen";
  back.style.minHeight = "32px";
  back.style.borderRadius = "9px";
  back.style.border = "1px solid rgba(255,255,255,.10)";
  back.addEventListener("click", () => {
    setInsertFlowState(left, { phase: "source", sourceId: "recent-favorites" });
    const insertTab = left.querySelector('.wa-tabs-btn[data-tab-id="tab.insert"]');
    if (insertTab) insertTab.click();
    queueMicrotask(() => ensureInsertSources(left, "recent-favorites"));
  });
  actions.appendChild(back);
  flow.appendChild(actions);

  syncLegacyPlacementControls(left);
  return flow;
}

function ensureInsertSources(left, activeSourceId = null) {
  const panelHost = findPanelHost(left);
  if (!panelHost) return null;

  const sourceId = setInsertSource(left, activeSourceId || left.dataset.bpInsertSource || "recent-favorites");
  let sourceNav = panelHost.querySelector(":scope > [data-bp-insert-sources]");
  if (sourceNav) {
    applySourceActiveState(sourceNav, sourceId);
    ensureInsertFlow(left);
    return sourceNav;
  }

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
      const selectedSource = setInsertSource(left, source.id);
      setInsertFlowState(left, { phase: "source", sourceId: selectedSource });
      setPlanningLeftState(left, "insert");
      applySourceActiveState(sourceNav, selectedSource);

      if (source.kind === "landing") {
        const insertTab = left.querySelector('.wa-tabs-btn[data-tab-id="tab.insert"]');
        if (insertTab) {
          insertTab.click();
          queueMicrotask(() => ensureInsertSources(left, "recent-favorites"));
          return;
        }
        setHint("Startquelle für zuletzt verwendete und favorisierte Einfügeelemente. Der aktuelle Stand führt noch keine eigene Favoriten-Datenbank in der Workarea.");
        ensureInsertFlow(left);
        return;
      }

      if (source.kind === "project-source") {
        setHint("Bibliotheken sind bereits eine Projektquelle. 05C kopiert ihre Verwaltung bewusst nicht in die Workarea; die spätere Einfüge-Anbindung erfolgt über die gemeinsame Bibliotheksquelle.");
        ensureInsertFlow(left);
        return;
      }

      const legacyTabId = source.id === "assets" ? "tab.assets" : source.id === "assemblies" ? "tab.assemblylab" : null;
      const legacyTab = legacyTabId ? left.querySelector(`.wa-tabs-btn[data-tab-id="${legacyTabId}"]`) : null;
      if (legacyTab) {
        legacyTab.click();
        queueMicrotask(() => {
          setPlanningLeftState(left, "insert");
          setInsertSource(left, selectedSource);
          ensureInsertSources(left, selectedSource);
        });
        return;
      }

      const legacyAction = findButtonByText(panelHost, source.match);
      if (legacyAction) {
        legacyAction.click();
        queueMicrotask(() => ensureInsertSources(left, selectedSource));
        return;
      }

      setHint(`${source.label} ist als Einfügequelle vorgesehen; der vorhandene Workarea-Zugang konnte in diesem Zustand nicht aufgelöst werden.`);
      ensureInsertFlow(left);
    });

    sourceNav.appendChild(button);
  }

  panelHost.prepend(sourceNav);
  applySourceActiveState(sourceNav, sourceId);
  setHint("Wähle eine Quelle. Vorhandene Asset- und Baugruppenfunktionen werden weiterverwendet; 05C erzeugt keine zweite Fachlogik.");
  ensureInsertFlow(left);
  return sourceNav;
}

function clearInsertSources(left) {
  left?.querySelectorAll?.("[data-bp-insert-sources], [data-bp-insert-flow]").forEach((node) => node.remove());
}

function wireInsertSelectionBridge(left) {
  if (!left || left.dataset.bpInsertSelectionBridge === "true") return;
  left.dataset.bpInsertSelectionBridge = "true";

  left.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    if (target.closest("[data-bp-insert-sources], [data-bp-insert-flow]")) return;

    const sourceId = left.dataset.bpInsertSource || "recent-favorites";
    if (sourceId !== "assets") return;

    const button = target.closest("button");
    if (!button) return;
    const text = String(button.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || /Refresh|Place-Mode wechseln/i.test(text)) return;

    const label = /^Select$/i.test(text)
      ? String(button.parentElement?.parentElement?.textContent || "Asset").replace(/\s+/g, " ").trim().slice(0, 120)
      : text.slice(0, 120);

    queueMicrotask(() => {
      if ((left.dataset.bpInsertSource || "") !== "assets") return;
      setPlanningLeftState(left, "insert");
      setInsertFlowState(left, { phase: "selected", sourceId: "assets", label: label || "Asset" });
      ensureInsertSources(left, "assets");
    });
  });
}

function mapPlanningLeftArea(left) {
  if (!left) return null;

  left.dataset.bpPlanningLeftArea = "object-tree-insert-v1";
  wireInsertSelectionBridge(left);

  const buttons = Array.from(left.querySelectorAll(".wa-tabs-btn[data-tab-id]"));
  if (!buttons.length) return null;

  const activeTab = buttons.find(isActiveTab) || null;
  const activeTabId = String(activeTab?.dataset?.tabId || "");
  const activeLegacySource = LEGACY_INSERT_SOURCE_TABS[activeTabId] || null;
  let activeState = activeLegacySource ? "insert" : activeTabId === "tab.insert" ? "insert" : "object-tree";

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
      button.addEventListener("click", () => {
        setPlanningLeftState(left, target.state);
        if (target.state === "insert") {
          setInsertSource(left, "recent-favorites");
          setInsertFlowState(left, { phase: "source", sourceId: "recent-favorites" });
          queueMicrotask(() => ensureInsertSources(left, "recent-favorites"));
        } else {
          delete left.dataset.bpInsertSource;
          delete left.dataset.bpInsertFlowPhase;
          delete left.dataset.bpInsertFlowLabel;
          queueMicrotask(() => clearInsertSources(left));
        }
      });
    }
  }

  setPlanningLeftState(left, activeState);
  if (activeState === "insert") {
    const sourceId = activeLegacySource || left.dataset.bpInsertSource || "recent-favorites";
    if (!left.dataset.bpInsertFlowPhase) setInsertFlowState(left, { phase: "source", sourceId });
    ensureInsertSources(left, sourceId);
  } else {
    delete left.dataset.bpInsertSource;
    delete left.dataset.bpInsertFlowPhase;
    delete left.dataset.bpInsertFlowLabel;
    clearInsertSources(left);
  }
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

  function ensureObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (!active) return;
      const left = viewRoot.querySelector(SELECTORS.left);
      if (!left) {
        mapExistingWorkarea();
        return;
      }

      const tabBar = left.firstElementChild;
      const structuralChange = mutations.some((mutation) =>
        mutation.target === tabBar ||
        Array.from(mutation.addedNodes || []).some((node) => node?.matches?.(".wa-left-dock, .wa-shell"))
      );
      if (structuralChange) mapExistingWorkarea();
    });
    observer.observe(viewRoot, { childList: true, subtree: true });
  }

  function setActive(isActive) {
    active = Boolean(isActive);
    if (!active) {
      clearActiveMarker();
      return;
    }

    ensureObserver();
    mapExistingWorkarea();
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
