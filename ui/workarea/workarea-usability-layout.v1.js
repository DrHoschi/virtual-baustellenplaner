/* UI-CUT-02 – approved Workarea usability presentation
 * Presentation/adaptation only. Reuses existing Workarea controls and dock DOM.
 * No canvas/runtime/interaction/persistence ownership.
 *
 * PlanningTopbarAdapter is the single visible toolbar authority.
 */

const ROOT_SELECTOR = "body.bp-planning-workspace-active #view";
const PHONE_QUERY = "(max-width: 699px), (orientation: landscape) and (max-height: 520px)";

function q(root, sel) {
  try { return root?.querySelector?.(sel) || null; } catch { return null; }
}

function isPhoneLayout() {
  try { return !!window.matchMedia?.(PHONE_QUERY)?.matches; } catch { return false; }
}

function markPlanningShellCommands() {
  const active = document.body?.classList?.contains("bp-planning-workspace-active");
  const buttons = Array.from(document.querySelectorAll("button"));
  for (const btn of buttons) {
    const text = String(btn.textContent || "").trim();
    const outsideView = !btn.closest?.("#view");

    if (outsideView && (text === "Neu" || text === "Datei")) {
      btn.classList.toggle("wa-planning-shell-project-command", !!active);
    }

    if (outsideView && text === "Debug") {
      btn.classList.toggle("wa-planning-shell-debug-command", !!active);
    }

    if (/^(Projekt\s+)?Transfer$/i.test(text)) {
      btn.classList.toggle("wa-planning-shell-transfer-command", !!active);
    }
  }
}

function removeObsoleteModeMirror(root) {
  /*
   * UI-CUT-02 correction:
   * An earlier presentation helper mirrored the native mode select with a
   * second button group. PlanningTopbarAdapter already provides the approved
   * visible toolbar, so that mirror must not coexist with it.
   */
  for (const mirror of root.querySelectorAll(".wa-mode-buttons")) mirror.remove();
  const select = q(root, ".wa-mode-select-native");
  if (select) select.classList.remove("wa-mode-select-native");
}

function enhancePortraitSidePanel(root) {
  const shell = q(root, ".wa-shell");
  const left = q(shell, ".wa-left-dock");
  const right = q(shell, ".wa-right-dock");
  if (!shell || !left || !right) return;

  const phone = isPhoneLayout();
  if (phone && shell.dataset.waPhoneDrawerInit !== "1") {
    shell.dataset.waPhoneDrawerInit = "1";
    shell.dataset.waPortraitPanel = "none";
  } else if (!phone && !shell.dataset.waPortraitPanel) {
    shell.dataset.waPortraitPanel = "structure";
  }

  let switcher = q(shell, ".wa-portrait-side-switcher");
  if (!switcher) {
    switcher = document.createElement("div");
    switcher.className = "wa-portrait-side-switcher";
    switcher.setAttribute("role", "tablist");
    switcher.setAttribute("aria-label", "Seitenleiste");

    const make = (id, icon, text, extraClass = "") => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `wa-portrait-side-tab ${extraClass}`.trim();
      btn.dataset.panel = id;
      btn.setAttribute("role", "tab");
      btn.title = text || "Seitenleiste schließen";
      btn.innerHTML = `<span aria-hidden="true">${icon}</span>${text ? `<span>${text}</span>` : ""}`;
      btn.addEventListener("click", () => {
        shell.dataset.waPortraitPanel = id;
        sync();
      });
      return btn;
    };

    switcher.appendChild(make("structure", "⌘", "Struktur"));
    switcher.appendChild(make("properties", "▤", "Eigenschaften"));
    switcher.appendChild(make("none", "×", "", "wa-portrait-side-tab--close"));
    shell.appendChild(switcher);
  }

  const sync = () => {
    const current = shell.dataset.waPortraitPanel || (isPhoneLayout() ? "none" : "structure");
    for (const btn of switcher.querySelectorAll("button[data-panel]")) {
      const on = btn.dataset.panel === current;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    }
  };

  sync();
}

function enhance() {
  const root = document.querySelector(ROOT_SELECTOR);
  markPlanningShellCommands();
  if (!root) return;
  removeObsoleteModeMirror(root);
  enhancePortraitSidePanel(root);
}

let scheduled = 0;
function scheduleEnhance() {
  if (scheduled) return;
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    enhance();
  });
}

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"]
});

window.addEventListener("resize", scheduleEnhance, { passive: true });
window.addEventListener("orientationchange", scheduleEnhance, { passive: true });
scheduleEnhance();
