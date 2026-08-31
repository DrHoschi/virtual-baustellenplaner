const RIGHT_DOCK_SELECTOR = ".wa-right-dock";
const TAB_BUTTON_SELECTOR = '.wa-tabs-btn[data-tab-id]';
const PROPERTIES_TAB_ID = "tab.properties";

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

function findTabsBar(rightDock) {
  return Array.from(rightDock?.children || []).find((child) =>
    child.querySelector?.(TAB_BUTTON_SELECTOR)
  ) || null;
}

function findPanelHost(rightDock, tabsBar) {
  return Array.from(rightDock?.children || []).find((child) =>
    child !== tabsBar && !child.matches?.('[data-bp-planning-context-header]')
  ) || null;
}

function ensureContextHeader(rightDock, tabsBar) {
  let header = rightDock.querySelector(":scope > [data-bp-planning-context-header='05f']");
  if (header) return header;

  header = document.createElement("section");
  header.dataset.bpPlanningContextHeader = "05f";
  header.className = "bp-planning-context__header";
  header.setAttribute("aria-label", "Planning Kontext");

  const title = document.createElement("div");
  title.className = "bp-planning-context__title";
  title.textContent = "Kontext";
  header.appendChild(title);

  const hint = document.createElement("div");
  hint.className = "bp-planning-context__hint";
  hint.textContent = "Aktives Werkzeug → Auswahl → Arbeitsbereich";
  header.appendChild(hint);

  rightDock.insertBefore(header, tabsBar || rightDock.firstChild);
  return header;
}

function markLegacyTabs(tabsBar) {
  if (!tabsBar) return;
  tabsBar.dataset.bpPlanningLegacyContextTabs = "true";
  tabsBar.setAttribute("aria-hidden", "true");
  tabsBar.hidden = true;

  for (const button of tabsBar.querySelectorAll(TAB_BUTTON_SELECTOR)) {
    button.dataset.bpPlanningLegacyContextTab = button.dataset.tabId || "true";
  }
}

function activateExistingPropertiesTab(tabsBar) {
  if (!tabsBar) return false;
  const propertyButton = tabsBar.querySelector(`${TAB_BUTTON_SELECTOR}[data-tab-id="${PROPERTIES_TAB_ID}"]`);
  if (!propertyButton) return false;
  if (isActiveTab(propertyButton)) return false;
  propertyButton.click();
  return true;
}

function annotateExistingPropertyActions(panelHost) {
  if (!panelHost) return;
  panelHost.dataset.bpPlanningContextHost = "05f";

  const mappings = [
    [/^Transform$/i, "transform"],
    [/^Voll-Editor$/i, "details"],
    [/^Elektrik$/i, "electrical"],
    [/^BOM$/i, "bom"],
    [/^Params$/i, "parameters"],
    [/^Place$/i, "place"],
    [/^Asset-Details$/i, "asset-details"],
    [/^Struktur$/i, "structure"]
  ];

  for (const button of panelHost.querySelectorAll("button")) {
    const text = String(button.textContent || "").trim();
    const match = mappings.find(([pattern]) => pattern.test(text));
    if (!match) continue;
    button.dataset.bpPlanningContextAction = match[1];
    button.dataset.bpPlanningContextOwner = "legacy-workarea";
  }
}

function mapContext(rightDock) {
  if (!rightDock) return false;
  const tabsBar = findTabsBar(rightDock);
  if (!tabsBar) return false;

  rightDock.dataset.bpPlanningContext = "05f";
  rightDock.setAttribute("aria-label", "Kontext");
  ensureContextHeader(rightDock, tabsBar);
  markLegacyTabs(tabsBar);

  const changedTab = activateExistingPropertiesTab(tabsBar);
  const panelHost = findPanelHost(rightDock, tabsBar);
  annotateExistingPropertyActions(panelHost);

  if (changedTab) {
    queueMicrotask(() => {
      const currentHost = findPanelHost(rightDock, tabsBar);
      annotateExistingPropertyActions(currentHost);
    });
  }
  return true;
}

export function installPlanningContextAdapter({ viewRoot } = {}) {
  if (!viewRoot) throw new Error("installPlanningContextAdapter: viewRoot fehlt");

  if (viewRoot.__bpPlanningContextAdapter05F) {
    viewRoot.__bpPlanningContextAdapter05F.sync();
    return viewRoot.__bpPlanningContextAdapter05F;
  }

  let scheduled = false;
  const sync = () => {
    scheduled = false;
    const rightDock = viewRoot.querySelector(RIGHT_DOCK_SELECTOR);
    if (!rightDock) return false;
    return mapContext(rightDock);
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
      return target.matches?.(RIGHT_DOCK_SELECTOR) ||
        target.closest?.(RIGHT_DOCK_SELECTOR) ||
        Array.from(mutation.addedNodes || []).some((node) =>
          node?.matches?.(RIGHT_DOCK_SELECTOR) || node?.querySelector?.(RIGHT_DOCK_SELECTOR)
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
      const rightDock = viewRoot.querySelector(RIGHT_DOCK_SELECTOR);
      const tabsBar = rightDock ? findTabsBar(rightDock) : null;
      rightDock?.querySelector?.(":scope > [data-bp-planning-context-header='05f']")?.remove();
      if (rightDock) {
        delete rightDock.dataset.bpPlanningContext;
        rightDock.setAttribute("aria-label", "Context");
      }
      if (tabsBar) {
        tabsBar.hidden = false;
        tabsBar.removeAttribute("aria-hidden");
        delete tabsBar.dataset.bpPlanningLegacyContextTabs;
      }
      delete viewRoot.__bpPlanningContextAdapter05F;
    }
  });

  viewRoot.__bpPlanningContextAdapter05F = api;
  return api;
}
