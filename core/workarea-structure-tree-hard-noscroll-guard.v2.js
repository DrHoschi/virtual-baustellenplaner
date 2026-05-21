/**
 * core/workarea-structure-tree-hard-noscroll-guard.v2.js
 * Version: PATCH_workarea_structure_tree_hard_noscroll_guard_v2 (2026-05-21)
 *
 * Zweck:
 * - Harter Hotfix gegen das Springen des linken Strukturbaums.
 * - Vorherige Baum-Patches besitzen teilweise lokale setTimeout-Aufrufe mit
 *   row.scrollIntoView(...). Diese Aufrufe laufen später nach und wurden durch
 *   den ersten NoScroll-Hotfix nicht zuverlässig erwischt.
 *
 * Bedienregel:
 * - Klick im 2D/3D-Viewer: Objekt wird im Strukturbaum markiert, Eltern werden
 *   bei Bedarf geöffnet, aber der Baum scrollt NICHT automatisch dorthin.
 * - Klick im Strukturbaum: Auswahl und Properties funktionieren weiter.
 * - Das Modul blockiert nur scrollIntoView/focus-Scrolls innerhalb
 *   .wa-structure-tree. Andere App-Bereiche bleiben unverändert.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_hard_noscroll_guard_v2";

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function cssEscapeValue(value) {
  const text = safeString(value);
  if (globalThis.CSS && typeof globalThis.CSS.escape === "function") return globalThis.CSS.escape(text);
  return text.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function isStructureTreeElement(el) {
  try {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList?.contains("wa-structure-tree")) return true;
    return !!el.closest?.(".wa-structure-tree");
  } catch {
    return false;
  }
}

function isStructureTreeRow(el) {
  try {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList?.contains("wa-structure-row")) return true;
    return !!el.closest?.(".wa-structure-tree .wa-structure-row");
  } catch {
    return false;
  }
}

function getSelectionId(panel) {
  return safeString(
    panel?.state?.selection?.id ||
    panel?.state?.selection?.objectId ||
    panel?.state?.selection?.targetId ||
    ""
  );
}

function getStructureRoot(panel) {
  return (
    panel?._els?.leftPanelHost?.querySelector?.(".wa-structure-tree") ||
    panel?.rootEl?.querySelector?.(".wa-structure-tree") ||
    document.querySelector(".wa-structure-tree") ||
    null
  );
}

function addScrollTarget(list, seen, el) {
  if (!el || seen.has(el)) return;
  if (typeof el.scrollTop !== "number" || typeof el.scrollLeft !== "number") return;
  seen.add(el);
  list.push(el);
}

/**
 * Erfasst bewusst mehrere mögliche Scroll-Container.
 * iPad/Safari scrollt je nach Layout nicht immer den erwarteten Container,
 * sondern manchmal einen Elternknoten oder sogar das Dokument.
 */
function getScrollTargets(panel) {
  const targets = [];
  const seen = new Set();

  const root = getStructureRoot(panel);
  const leftHost = panel?._els?.leftPanelHost || root?.closest?.("[class]") || null;

  addScrollTarget(targets, seen, root);
  addScrollTarget(targets, seen, leftHost);
  addScrollTarget(targets, seen, panel?.rootEl || null);
  addScrollTarget(targets, seen, document.scrollingElement || null);
  addScrollTarget(targets, seen, document.documentElement || null);
  addScrollTarget(targets, seen, document.body || null);

  let node = root || leftHost;
  for (let i = 0; node && i < 14; i += 1) {
    addScrollTarget(targets, seen, node);
    node = node.parentElement;
  }

  for (const selector of [
    ".wa-left-dock",
    ".wa-workarea-left",
    ".wa-workarea-dock-left",
    ".wa-dock-left",
    ".wa-left-panel",
    ".wa-panel-left",
    ".wa-side-left",
    ".wa-shell",
    ".app-shell"
  ]) {
    document.querySelectorAll(selector).forEach((el) => addScrollTarget(targets, seen, el));
  }

  return targets;
}

function captureScroll(panel) {
  return getScrollTargets(panel).map((el) => ({
    el,
    top: el.scrollTop,
    left: el.scrollLeft
  }));
}

function restoreScroll(snapshot) {
  for (const item of snapshot || []) {
    if (!item?.el) continue;
    try {
      item.el.scrollTop = item.top;
      item.el.scrollLeft = item.left;
    } catch {}
  }
}

function restoreScrollStrong(snapshot) {
  restoreScroll(snapshot);
  window.setTimeout(() => restoreScroll(snapshot), 0);
  window.setTimeout(() => restoreScroll(snapshot), 16);
  window.setTimeout(() => restoreScroll(snapshot), 32);
  window.setTimeout(() => restoreScroll(snapshot), 80);
  window.setTimeout(() => restoreScroll(snapshot), 160);
  window.setTimeout(() => restoreScroll(snapshot), 320);
}

function markSelectedRowWithoutScroll(panel, selectedId = getSelectionId(panel)) {
  const root = getStructureRoot(panel);
  if (!root) return;

  const id = safeString(selectedId);
  const rows = Array.from(root.querySelectorAll(".wa-structure-row"));
  for (const row of rows) {
    row.classList.remove("is-selected");
    row.setAttribute("aria-selected", "false");
  }

  if (!id) return;

  const selector = [
    `.wa-structure-row[data-object-id="${cssEscapeValue(id)}"]`,
    `.wa-structure-row[data-workarea-object-id="${cssEscapeValue(id)}"]`
  ].join(", ");

  const row = root.querySelector(selector);
  if (!row) return;

  row.classList.add("is-selected");
  row.setAttribute("aria-selected", "true");

  // Nur Eltern öffnen. Kein row.focus(), kein scrollIntoView().
  let parent = row.parentElement;
  while (parent && parent !== root) {
    if (parent.tagName === "DETAILS") parent.open = true;
    parent = parent.parentElement;
  }
}

function installGlobalStructureScrollGuard() {
  const proto = globalThis.Element?.prototype;
  if (!proto || proto.__bpStructureHardNoScrollGuardV2) return;
  proto.__bpStructureHardNoScrollGuardV2 = true;

  const originalScrollIntoView = proto.scrollIntoView;
  if (typeof originalScrollIntoView === "function") {
    proto.scrollIntoView = function patchedScrollIntoView(...args) {
      // Zentraler Fix: alte lokale Baum-Patches dürfen Strukturzeilen nicht mehr
      // per scrollIntoView in den sichtbaren Bereich ziehen.
      if (isStructureTreeRow(this) || isStructureTreeElement(this)) {
        return undefined;
      }
      return originalScrollIntoView.apply(this, args);
    };
    proto.scrollIntoView.__bpStructureHardNoScrollGuardV2 = true;
  }

  const htmlProto = globalThis.HTMLElement?.prototype;
  if (!htmlProto || htmlProto.__bpStructureHardNoFocusScrollGuardV2) return;
  htmlProto.__bpStructureHardNoFocusScrollGuardV2 = true;

  const originalFocus = htmlProto.focus;
  if (typeof originalFocus === "function") {
    htmlProto.focus = function patchedFocus(options) {
      if (isStructureTreeRow(this) || isStructureTreeElement(this)) {
        // Fokus darf gesetzt werden, aber Safari soll dabei nicht scrollen.
        try { return originalFocus.call(this, { ...(options || {}), preventScroll: true }); }
        catch { return undefined; }
      }
      return originalFocus.call(this, options);
    };
    htmlProto.focus.__bpStructureHardNoFocusScrollGuardV2 = true;
  }
}

function installPanelGuards() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__bpStructureHardNoScrollGuardPanelV2) return;
  proto.__bpStructureHardNoScrollGuardPanelV2 = true;

  const originalSync = proto._syncStructureTreeSelectedStateV1;
  proto._syncStructureTreeSelectedStateV1 = function patchedSyncStructureTreeSelectedStateHardNoScroll(selectedId, options = {}) {
    const snapshot = captureScroll(this);
    const nextOptions = { ...(options || {}), scroll: false, forceScroll: false };

    let result;
    if (typeof originalSync === "function") {
      result = originalSync.call(this, selectedId || getSelectionId(this), nextOptions);
    }

    markSelectedRowWithoutScroll(this, selectedId || getSelectionId(this));
    restoreScrollStrong(snapshot);
    return result;
  };
  proto._syncStructureTreeSelectedStateV1.__bpStructureHardNoScrollGuardV2 = true;

  const originalSetSelectionToObject = proto._setSelectionToObject;
  if (typeof originalSetSelectionToObject === "function") {
    proto._setSelectionToObject = function patchedSetSelectionToObjectHardNoScroll(obj, reason, ...rest) {
      const snapshot = captureScroll(this);
      const result = originalSetSelectionToObject.call(this, obj, reason, ...rest);
      const selectedId = safeString(obj?.id || getSelectionId(this));

      markSelectedRowWithoutScroll(this, selectedId);
      window.setTimeout(() => markSelectedRowWithoutScroll(this, selectedId), 0);
      window.setTimeout(() => markSelectedRowWithoutScroll(this, selectedId), 16);
      window.setTimeout(() => markSelectedRowWithoutScroll(this, selectedId), 80);
      restoreScrollStrong(snapshot);

      return result;
    };
    proto._setSelectionToObject.__bpStructureHardNoScrollGuardV2 = true;
  }

  const originalRenderLeftPanel = proto._renderLeftPanel;
  if (typeof originalRenderLeftPanel === "function") {
    proto._renderLeftPanel = function patchedRenderLeftPanelHardNoScroll(...args) {
      const snapshot = captureScroll(this);
      const result = originalRenderLeftPanel.apply(this, args);
      markSelectedRowWithoutScroll(this, getSelectionId(this));
      restoreScrollStrong(snapshot);
      return result;
    };
    proto._renderLeftPanel.__bpStructureHardNoScrollGuardV2 = true;
  }
}

function installPatch() {
  installGlobalStructureScrollGuard();
  installPanelGuards();
  console.info(`[${PATCH_ID}] installed`);
}

installPatch();
