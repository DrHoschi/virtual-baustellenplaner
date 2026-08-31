const BOTTOM_SELECTOR = ".wa-bottom-bar";

function directChildren(bottom) {
  return Array.from(bottom?.children || []);
}

function findDirectByText(bottom, matcher) {
  return directChildren(bottom).find((el) => matcher.test(String(el.textContent || "").trim())) || null;
}

function ensureDevHost(devLayer) {
  if (!devLayer) return null;
  let host = devLayer.querySelector('[data-bp-planning-status-devtools="05g"]');
  if (!host) {
    host = document.createElement("section");
    host.dataset.bpPlanningStatusDevtools = "05g";
    host.className = "bp-planning-status-devtools";
    host.setAttribute("aria-label", "Planning Statusdiagnose");

    const title = document.createElement("div");
    title.className = "bp-planning-status-devtools__title";
    title.textContent = "Planning Statusdiagnose";
    host.appendChild(title);
    devLayer.appendChild(host);
  }
  return host;
}

function moveDiagnostics(bottom, devLayer) {
  const host = ensureDevHost(devLayer);
  if (!host) return;

  const consoleButton = findDirectByText(bottom, /^Console$/i);
  const layoutPill = findDirectByText(bottom, /^Layout\s*:/i);

  host.querySelectorAll('[data-bp-planning-status-debug-control]').forEach((node) => node.remove());

  if (consoleButton) {
    consoleButton.dataset.bpPlanningStatusDebugControl = "console";
    host.appendChild(consoleButton);
  }
  if (layoutPill) {
    layoutPill.dataset.bpPlanningStatusDebugControl = "layout";
    host.appendChild(layoutPill);
  }
}

function mapBottomBar(bottom, devLayer) {
  if (!bottom) return false;

  moveDiagnostics(bottom, devLayer);

  const mode = findDirectByText(bottom, /^Mode\s*:/i);
  const status = directChildren(bottom).find((el) => {
    if (el === mode) return false;
    if (el.matches?.("button")) return false;
    const text = String(el.textContent || "").trim();
    if (/^Layout\s*:/i.test(text) || /^Mode\s*:/i.test(text)) return false;
    const flex = String(el.style?.flex || "");
    if (flex.includes("1")) return false;
    return true;
  }) || bottom.firstElementChild;

  bottom.dataset.bpPlanningStatusBar = "05g";
  bottom.setAttribute("aria-label", "Planning Status");

  if (status) {
    status.dataset.bpPlanningStatusMessage = "true";
    status.setAttribute("aria-live", "polite");
  }
  if (mode) {
    mode.dataset.bpPlanningStatusMode = "true";
    mode.setAttribute("aria-label", "Aktiver Arbeitsmodus");
  }

  return true;
}

export function installPlanningStatusBarAdapter({ viewRoot, devLayer } = {}) {
  if (!viewRoot) throw new Error("installPlanningStatusBarAdapter: viewRoot fehlt");

  if (viewRoot.__bpPlanningStatusBarAdapter05G) {
    viewRoot.__bpPlanningStatusBarAdapter05G.sync();
    return viewRoot.__bpPlanningStatusBarAdapter05G;
  }

  let scheduled = false;

  const sync = () => {
    scheduled = false;
    const bottom = viewRoot.querySelector(BOTTOM_SELECTOR);
    if (!bottom) {
      devLayer?.querySelector?.('[data-bp-planning-status-devtools="05g"]')?.remove();
      return false;
    }
    return mapBottomBar(bottom, devLayer);
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
      return target.matches?.(BOTTOM_SELECTOR) ||
        target.closest?.(BOTTOM_SELECTOR) ||
        Array.from(mutation.addedNodes || []).some((node) =>
          node?.matches?.(BOTTOM_SELECTOR) || node?.querySelector?.(BOTTOM_SELECTOR)
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
      devLayer?.querySelector?.('[data-bp-planning-status-devtools="05g"]')?.remove();
      const bottom = viewRoot.querySelector(BOTTOM_SELECTOR);
      if (bottom) {
        delete bottom.dataset.bpPlanningStatusBar;
        bottom.removeAttribute("aria-label");
      }
      delete viewRoot.__bpPlanningStatusBarAdapter05G;
    }
  });

  viewRoot.__bpPlanningStatusBarAdapter05G = api;
  return api;
}
