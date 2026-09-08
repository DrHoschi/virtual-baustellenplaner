/* UI-CUT-02 – approved Workarea usability presentation
 * Presentation/adaptation only. Reuses existing Workarea controls and dock DOM.
 * No canvas/runtime/interaction/persistence ownership.
 */

const ROOT_SELECTOR = "body.bp-planning-workspace-active #view";

function q(root, sel) {
  try { return root?.querySelector?.(sel) || null; } catch { return null; }
}

function markPlanningShellCommands() {
  const active = document.body?.classList?.contains("bp-planning-workspace-active");
  const buttons = Array.from(document.querySelectorAll("button"));
  for (const btn of buttons) {
    if (btn.closest?.("#view")) continue;
    const text = String(btn.textContent || "").trim();
    if (text !== "Neu" && text !== "Datei") continue;
    btn.classList.toggle("wa-planning-shell-project-command", !!active);
  }
}

function enhanceModeControls(root) {
  const group = q(root, ".wa-mode-group");
  const select = q(group, ".wa-mode-select");
  if (!group || !select || q(group, ".wa-mode-buttons")) return;

  const wrap = document.createElement("div");
  wrap.className = "wa-mode-buttons";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Arbeitswerkzeuge");

  const defs = [
    ["select", "↖", "Auswahl"],
    ["place", "+", "Platzieren"],
    ["edit", "✎", "Bearbeiten"],
    ["pan", "✋", "Pan"]
  ];

  const sync = () => {
    const current = String(select.value || "select");
    for (const btn of wrap.querySelectorAll("button[data-mode-id]")) {
      const on = btn.dataset.modeId === current;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  };

  for (const [id, icon, label] of defs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wa-mode-tool";
    btn.dataset.modeId = id;
    btn.title = label;
    btn.innerHTML = `<span class="wa-mode-tool-icon" aria-hidden="true">${icon}</span><span class="wa-mode-tool-label">${label}</span>`;
    btn.addEventListener("click", () => {
      select.value = id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
    });
    wrap.appendChild(btn);
  }

  select.classList.add("wa-mode-select-native");
  group.insertBefore(wrap, select);
  select.addEventListener("change", sync);
  sync();
}

function enhancePortraitSidePanel(root) {
  const shell = q(root, ".wa-shell");
  const left = q(shell, ".wa-left-dock");
  const right = q(shell, ".wa-right-dock");
  if (!shell || !left || !right) return;

  if (!shell.dataset.waPortraitPanel) shell.dataset.waPortraitPanel = "structure";
  if (q(shell, ".wa-portrait-side-switcher")) return;

  const switcher = document.createElement("div");
  switcher.className = "wa-portrait-side-switcher";
  switcher.setAttribute("role", "tablist");
  switcher.setAttribute("aria-label", "Seitenleiste");

  const make = (id, icon, text) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wa-portrait-side-tab";
    btn.dataset.panel = id;
    btn.setAttribute("role", "tab");
    btn.innerHTML = `<span aria-hidden="true">${icon}</span><span>${text}</span>`;
    btn.addEventListener("click", () => {
      shell.dataset.waPortraitPanel = id;
      sync();
    });
    return btn;
  };

  switcher.appendChild(make("structure", "⌘", "Struktur"));
  switcher.appendChild(make("properties", "▤", "Eigenschaften"));

  const sync = () => {
    const current = shell.dataset.waPortraitPanel || "structure";
    for (const btn of switcher.querySelectorAll("button[data-panel]")) {
      const on = btn.dataset.panel === current;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    }
  };

  shell.appendChild(switcher);
  sync();
}

function enhance() {
  const root = document.querySelector(ROOT_SELECTOR);
  markPlanningShellCommands();
  if (!root) return;
  enhanceModeControls(root);
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
