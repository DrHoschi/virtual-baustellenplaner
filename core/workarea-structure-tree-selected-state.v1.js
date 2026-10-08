/**
 * core/workarea-structure-tree-selected-state.v1.js
 * Version: PATCH_workarea_structure_tree_selected_state_v1 (2026-05-20)
 *
 * Ziel:
 * - Mini-Hotfix ohne Umbau des WorkareaPanel.
 * - Wenn im Viewer ein Objekt ausgewählt wird, bekommt der Projektstrukturbaum
 *   sichtbar dieselbe Auswahl-Markierung.
 * - Wenn im Strukturbaum ein Objekt angeklickt wird, bleibt die Zeile ebenfalls
 *   sichtbar markiert.
 *
 * Wichtig:
 * - Keine schweren Property-/BOM-/Elektrik-Blöcke werden dadurch gerendert.
 * - Der Patch hängt sich nur an vorhandene Methoden an.
 * - Debug/Crash-Recorder bleibt unverändert.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_selected_state_v1";
const STYLE_ID = "bp-workarea-structure-tree-selected-state-v1";

function safeString(value) {
  return value === null || value === undefined ? "" : String(value);
}

function cssEscapeValue(value) {
  const s = safeString(value);
  if (globalThis.CSS && typeof globalThis.CSS.escape === "function") {
    return globalThis.CSS.escape(s);
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
/* ${PATCH_ID} ------------------------------------------------------------- */
.wa-structure-tree .wa-structure-row.is-selected,
.wa-structure-tree .wa-structure-row[aria-selected="true"] {
  background: rgba(110, 168, 255, 0.24) !important;
  border-color: rgba(140, 190, 255, 0.72) !important;
  box-shadow: 0 0 0 1px rgba(140, 190, 255, 0.34) inset,
              0 0 0 2px rgba(110, 168, 255, 0.08) !important;
}

.wa-structure-tree .wa-structure-row.is-selected strong,
.wa-structure-tree .wa-structure-row[aria-selected="true"] strong {
  color: #ffffff !important;
  font-weight: 800 !important;
}

.wa-structure-tree .wa-structure-row.is-selected span,
.wa-structure-tree .wa-structure-row[aria-selected="true"] span {
  color: rgba(235, 245, 255, 0.88) !important;
}

.wa-structure-tree .wa-structure-row:focus-visible {
  outline: 2px solid rgba(140, 190, 255, 0.85) !important;
  outline-offset: 2px;
}
/* ------------------------------------------------------------------------- */
`;
  document.head.appendChild(style);
}

function getSelectionId(panel) {
  return safeString(
    panel?.state?.selection?.id ||
    panel?.state?.selection?.objectId ||
    panel?.state?.selection?.targetId ||
    ""
  );
}

function buildStructureOrder(panel) {
  let objects = [];
  try {
    objects = Array.isArray(panel?._getSceneObjectsLightV1?.())
      ? panel._getSceneObjectsLightV1()
      : [];
  } catch {
    objects = [];
  }

  const groups = new Map();
  for (const obj of objects) {
    const loc = safeString(obj?.eplan?.location || obj?.location || obj?.ort || "+A / nicht zugeordnet");
    const fg = safeString(obj?.foerdergruppe || obj?.fördergruppe || obj?.eplan?.function || obj?.assembly?.group || "ohne Fördergruppe");
    const key = `${loc}||${fg}`;
    if (!groups.has(key)) groups.set(key, { loc, fg, items: [] });
    groups.get(key).items.push(obj);
  }

  return Array.from(groups.values()).flatMap((group) => group.items || []);
}

function getStructureRoot(panel, preferredRoot) {
  if (preferredRoot?.querySelector?.(".wa-structure-tree")) {
    return preferredRoot.querySelector(".wa-structure-tree");
  }

  if (preferredRoot?.classList?.contains("wa-structure-tree")) {
    return preferredRoot;
  }

  return (
    panel?._els?.leftPanelHost?.querySelector?.(".wa-structure-tree") ||
    panel?.rootEl?.querySelector?.(".wa-structure-tree") ||
    document.querySelector(".wa-structure-tree") ||
    null
  );
}

function decorateStructureRows(panel, preferredRoot) {
  const root = getStructureRoot(panel, preferredRoot);
  if (!root) return;

  const rows = Array.from(root.querySelectorAll(".wa-structure-row"));
  if (!rows.length) return;

  const orderedObjects = buildStructureOrder(panel);

  rows.forEach((row, index) => {
    const obj = orderedObjects[index] || null;
    const id = safeString(obj?.id || row.dataset.objectId || "");
    if (!id) return;

    row.dataset.objectId = id;
    row.dataset.workareaObjectId = id;
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-selected", "false");

    if (!row.dataset.structureSelectedPatchBound) {
      row.dataset.structureSelectedPatchBound = "1";
      row.addEventListener("click", () => {
        // Original-Handler setzt die echte Selection. Danach nur optisch syncen.
        window.setTimeout(() => syncStructureSelectedState(panel, id, { scroll: false }), 0);
      });
    }
  });

  syncStructureSelectedState(panel, getSelectionId(panel), { scroll: false, preferredRoot: root });
}

function syncStructureSelectedState(panel, selectedId = getSelectionId(panel), options = {}) {
  const root = getStructureRoot(panel, options.preferredRoot || null);
  if (!root) return;

  const id = safeString(selectedId);
  const rows = Array.from(root.querySelectorAll(".wa-structure-row"));

  for (const row of rows) {
    row.classList.remove("is-selected");
    row.setAttribute("aria-selected", "false");
  }

  if (!id) return;

  const selector = `.wa-structure-row[data-object-id="${cssEscapeValue(id)}"], .wa-structure-row[data-workarea-object-id="${cssEscapeValue(id)}"]`;
  const row = root.querySelector(selector);
  if (!row) return;

  row.classList.add("is-selected");
  row.setAttribute("aria-selected", "true");

  const details = row.closest("details");
  if (details) details.open = true;

  if (options.scroll) {
    try {
      row.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    } catch {
      try { row.scrollIntoView(false); } catch {}
    }
  }
}

function patchMethod(proto, name, wrapper) {
  const original = proto?.[name];
  if (typeof original !== "function") return false;
  if (original.__structureTreeSelectedStateV1) return true;

  const patched = wrapper(original);
  patched.__structureTreeSelectedStateV1 = true;
  proto[name] = patched;
  return true;
}

function installPatch() {
  installStyle();

  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__structureTreeSelectedStateV1Installed) return;
  proto.__structureTreeSelectedStateV1Installed = true;

  proto._syncStructureTreeSelectedStateV1 = function _syncStructureTreeSelectedStateV1(selectedId, options = {}) {
    decorateStructureRows(this, options.preferredRoot || null);
    syncStructureSelectedState(this, selectedId || getSelectionId(this), options);
  };

  patchMethod(proto, "_renderProjectStructurePanelV1", (original) => function patchedRenderProjectStructurePanelV1(...args) {
    const box = original.apply(this, args);
    decorateStructureRows(this, box);
    return box;
  });

  patchMethod(proto, "_setSelectionToObject", (original) => function patchedSetSelectionToObject(obj, reason, ...rest) {
    const result = original.call(this, obj, reason, ...rest);
    const id = safeString(obj?.id || getSelectionId(this));
    window.setTimeout(() => this._syncStructureTreeSelectedStateV1?.(id, { scroll: reason !== "structure" }), 0);
    return result;
  });

  patchMethod(proto, "_renderLeftPanel", (original) => function patchedRenderLeftPanel(...args) {
    const result = original.apply(this, args);
    window.setTimeout(() => this._syncStructureTreeSelectedStateV1?.(getSelectionId(this), { scroll: false }), 0);
    return result;
  });

  patchMethod(proto, "_renderRightPanel", (original) => function patchedRenderRightPanel(...args) {
    const result = original.apply(this, args);
    window.setTimeout(() => this._syncStructureTreeSelectedStateV1?.(getSelectionId(this), { scroll: false }), 0);
    return result;
  });

  // Optional: Wenn es eine Punkt-Auswahl gibt, Markierung im Baum löschen.
  patchMethod(proto, "_setSelectionToPoint", (original) => function patchedSetSelectionToPoint(...args) {
    const result = original.apply(this, args);
    window.setTimeout(() => this._syncStructureTreeSelectedStateV1?.("", { scroll: false }), 0);
    return result;
  });

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();
