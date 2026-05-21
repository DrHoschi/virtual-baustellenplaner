/**
 * core/workarea-structure-tree-selection-sync-noscroll.v1.js
 * Version: PATCH_workarea_structure_tree_selection_sync_noscroll_v1 (2026-05-21)
 *
 * Zweck:
 * - Hotfix für den Strukturbaum nach Component-Nodes v1.
 * - Wenn ein Objekt im Workarea-Viewer angeklickt wird, soll der Strukturbaum
 *   synchronisiert werden: richtige Gruppe öffnen, Objekt markieren.
 * - Der linke Strukturbaum darf dabei NICHT automatisch zum Objekt springen.
 *
 * Warum als eigener Hotfix?
 * - Die vorhandenen Patches bleiben unverändert.
 * - Dieses Modul wird NACH live-grouping und component-nodes geladen und
 *   entschärft nur das Auto-Scroll-Verhalten der Auswahl-Synchronisation.
 *
 * Bedienregel:
 * - Klick im Strukturbaum: Markierung + Properties wie bisher.
 * - Klick im Viewer: Markierung im Baum, aber Scrollposition bleibt stabil.
 * - Explizites Scrollen ist nur noch möglich, wenn ein zukünftiger Aufruf
 *   bewusst { forceScroll: true } übergibt.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_selection_sync_noscroll_v1";

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function getSelectionId(panel) {
  return safeString(
    panel?.state?.selection?.id ||
    panel?.state?.selection?.objectId ||
    panel?.state?.selection?.targetId ||
    ""
  );
}

function cssEscapeValue(value) {
  const text = safeString(value);
  if (globalThis.CSS && typeof globalThis.CSS.escape === "function") return globalThis.CSS.escape(text);
  return text.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

/**
 * Sucht robuste Scroll-Container im linken Workarea-Bereich.
 * Wichtig: Auf iPad/Safari kann nicht immer genau das Element scrollen,
 * das wir erwarten. Darum speichern wir mehrere Kandidaten und stellen alle
 * wieder her, die tatsächlich eine Scrollposition haben.
 */
function getLeftScrollTargets(panel) {
  const targets = [];
  const seen = new Set();

  const add = (el) => {
    if (!el || seen.has(el)) return;
    if (typeof el.scrollTop !== "number" || typeof el.scrollLeft !== "number") return;
    seen.add(el);
    targets.push(el);
  };

  const leftHost = panel?._els?.leftPanelHost || null;
  add(leftHost);

  const tree = leftHost?.querySelector?.(".wa-structure-tree") || document.querySelector(".wa-structure-tree");
  add(tree);

  let node = tree || leftHost;
  for (let i = 0; node && i < 8; i += 1) {
    add(node);
    node = node.parentElement;
  }

  // Fallbacks für leicht abweichende Dock-Strukturen.
  add(document.querySelector(".wa-left-dock"));
  add(document.querySelector(".wa-workarea-left"));
  add(document.querySelector(".wa-workarea-dock-left"));
  add(document.querySelector(".wa-dock-left"));

  return targets;
}

function captureLeftScroll(panel) {
  return getLeftScrollTargets(panel).map((el) => ({
    el,
    top: el.scrollTop,
    left: el.scrollLeft
  }));
}

function restoreLeftScroll(snapshot) {
  for (const item of snapshot || []) {
    if (!item?.el) continue;
    try {
      item.el.scrollTop = item.top;
      item.el.scrollLeft = item.left;
    } catch {}
  }
}

/**
 * Mehrfaches Restore ist Absicht:
 * - live-grouping v1 nutzt intern setTimeout(..., 0)
 * - component-nodes v1 synchronisiert danach Detailzustände
 * - Safari/iOS kann Layout/Scroll später im Frame nachziehen
 */
function restoreLeftScrollAfterSelection(snapshot) {
  restoreLeftScroll(snapshot);
  window.setTimeout(() => restoreLeftScroll(snapshot), 0);
  window.setTimeout(() => restoreLeftScroll(snapshot), 16);
  window.setTimeout(() => restoreLeftScroll(snapshot), 80);
}

function openParentsAndMarkOnly(panel, selectedId = getSelectionId(panel)) {
  const root =
    panel?._els?.leftPanelHost?.querySelector?.(".wa-structure-tree") ||
    panel?.rootEl?.querySelector?.(".wa-structure-tree") ||
    document.querySelector(".wa-structure-tree") ||
    null;

  if (!root) return;

  const id = safeString(selectedId);
  const rows = Array.from(root.querySelectorAll(".wa-structure-row"));

  for (const row of rows) {
    row.classList.remove("is-selected");
    row.setAttribute("aria-selected", "false");
  }

  if (!id) return;

  const row = root.querySelector(`.wa-structure-row[data-object-id="${cssEscapeValue(id)}"]`);
  if (!row) return;

  row.classList.add("is-selected");
  row.setAttribute("aria-selected", "true");

  let parent = row.parentElement;
  while (parent && parent !== root) {
    if (parent.tagName === "DETAILS") parent.open = true;
    parent = parent.parentElement;
  }
}

function isStructureInitiatedReason(reason) {
  const text = String(reason || "");
  return text === "structure" || text.startsWith("structure:");
}

function installPatch() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__workareaStructureSelectionNoScrollV1Installed) return;
  proto.__workareaStructureSelectionNoScrollV1Installed = true;

  const originalSync = proto._syncStructureTreeSelectedStateV1;
  proto._syncStructureTreeSelectedStateV1 = function patchedSyncStructureTreeSelectedStateV1(selectedId, options = {}) {
    const snapshot = captureLeftScroll(this);
    const nextOptions = { ...(options || {}) };

    // Alte Patches nutzen { scroll: true }. Ab jetzt wird daraus standardmäßig
    // KEIN Auto-Scroll mehr. Nur bewusstes { forceScroll: true } darf springen.
    if (!nextOptions.forceScroll) nextOptions.scroll = false;

    let result;
    if (typeof originalSync === "function") {
      result = originalSync.call(this, selectedId || getSelectionId(this), nextOptions);
    } else {
      openParentsAndMarkOnly(this, selectedId || getSelectionId(this));
    }

    restoreLeftScrollAfterSelection(snapshot);
    return result;
  };
  proto._syncStructureTreeSelectedStateV1.__workareaStructureSelectionNoScrollV1 = true;

  const originalSetSelectionToObject = proto._setSelectionToObject;
  if (typeof originalSetSelectionToObject === "function") {
    proto._setSelectionToObject = function patchedSetSelectionToObjectNoScroll(obj, reason, ...rest) {
      const preserveTreeScroll = !isStructureInitiatedReason(reason);
      const snapshot = preserveTreeScroll ? captureLeftScroll(this) : null;

      const result = originalSetSelectionToObject.call(this, obj, reason, ...rest);

      // Der vorhandene Live-Grouping-Patch markiert schon korrekt, kann aber
      // noch einen alten scrollIntoView-Timeout geplant haben. Wir öffnen und
      // markieren danach nochmals bewusst ohne Scroll und stellen die Position her.
      if (preserveTreeScroll) {
        const selectedId = safeString(obj?.id || getSelectionId(this));
        window.setTimeout(() => openParentsAndMarkOnly(this, selectedId), 0);
        window.setTimeout(() => openParentsAndMarkOnly(this, selectedId), 16);
        restoreLeftScrollAfterSelection(snapshot);
      }

      return result;
    };
    proto._setSelectionToObject.__workareaStructureSelectionNoScrollV1 = true;
  }

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();
