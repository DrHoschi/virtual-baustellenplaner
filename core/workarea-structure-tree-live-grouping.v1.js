/**
 * core/workarea-structure-tree-live-grouping.v1.js
 * Version: PATCH_workarea_structure_tree_live_grouping_v1 (2026-05-20)
 *
 * Ziel:
 * - Projektstruktur gruppiert live nach den aktuellen Objektfeldern.
 * - Wenn Ortbereich/Fördergruppe/BMK in Properties geändert wird, wird die
 *   Struktur beim nächsten Rendern bzw. direkt im geöffneten Struktur-Tab neu
 *   aufgebaut.
 * - Neue Orte wie +C oder +D entstehen automatisch.
 * - Leere alte Gruppen verschwinden automatisch, weil der Baum jedes Mal aus
 *   den aktuellen Scene-Objekten neu berechnet wird.
 * - Auswahl bleibt sichtbar markiert und die passende Gruppe wird geöffnet.
 *
 * Performance-Regel:
 * - Der Strukturbaum bleibt leicht: keine Kabeltabellen, keine BOM-Tabellen,
 *   keine Komponenten-Massenliste.
 * - Schwere Details bleiben in den vorhandenen Dialogen/Properties-Buttons.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_live_grouping_v1";
const STYLE_ID = "bp-workarea-structure-tree-live-grouping-v1";

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

function cssEscapeValue(value) {
  const s = safeString(value);
  if (globalThis.CSS && typeof globalThis.CSS.escape === "function") return globalThis.CSS.escape(s);
  return s.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
/* ${PATCH_ID} ------------------------------------------------------------- */
.wa-structure-tree {
  contain: layout style;
}

.wa-structure-tree details.wa-structure-location,
.wa-structure-tree details.wa-structure-fg {
  border: 0;
}

.wa-structure-tree summary.wa-structure-summary {
  list-style: none;
  cursor: pointer;
  user-select: none;
}

.wa-structure-tree summary.wa-structure-summary::-webkit-details-marker {
  display: none;
}

.wa-structure-tree .wa-structure-row {
  width: 100%;
}

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

function patchMethod(proto, name, wrapper) {
  const original = proto?.[name];
  if (typeof original !== "function") return false;
  if (original.__workareaStructureTreeLiveGroupingV1) return true;

  const patched = wrapper(original);
  patched.__workareaStructureTreeLiveGroupingV1 = true;
  proto[name] = patched;
  return true;
}

function getSelectionId(panel) {
  return safeString(
    panel?.state?.selection?.id ||
    panel?.state?.selection?.objectId ||
    panel?.state?.selection?.targetId ||
    ""
  );
}

function ensureTechObjects(obj) {
  if (!obj || typeof obj !== "object") return obj;
  obj.config = obj.config && typeof obj.config === "object" ? obj.config : {};
  obj.eplan = obj.eplan && typeof obj.eplan === "object" ? obj.eplan : {};
  return obj;
}

function resolveLocation(obj) {
  return safeString(
    obj?.config?.location ||
    obj?.config?.area ||
    obj?.eplan?.location ||
    obj?.location ||
    obj?.ort ||
    obj?.area ||
    "+? / nicht zugeordnet"
  );
}

function resolveConveyorGroup(obj) {
  return safeString(
    obj?.config?.conveyorGroup ||
    obj?.config?.foerdergruppe ||
    obj?.conveyorGroup ||
    obj?.foerdergruppe ||
    obj?.["fördergruppe"] ||
    obj?.eplan?.function ||
    obj?.eplan?.functionText ||
    obj?.assembly?.group ||
    "ohne Fördergruppe"
  );
}

function resolveEquipmentTag(obj) {
  return safeString(
    obj?.config?.equipmentTag ||
    obj?.equipmentTag ||
    obj?.eplan?.equipmentTag ||
    obj?.bmk ||
    obj?.tag ||
    ""
  );
}

function resolveObjectName(obj) {
  return safeString(
    obj?.name ||
    obj?.config?.name ||
    obj?.visual?.label ||
    obj?.importName ||
    obj?.type ||
    "Objekt"
  );
}

function getSceneObjects(panel) {
  try {
    const objects = panel?._getSceneObjectsLightV1?.();
    return Array.isArray(objects) ? objects.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function sortNatural(a, b) {
  return String(a || "").localeCompare(String(b || ""), "de", { numeric: true, sensitivity: "base" });
}

function syncTechnicalFields(sceneObj) {
  if (!sceneObj || typeof sceneObj !== "object") return sceneObj;
  ensureTechObjects(sceneObj);

  const loc = resolveLocation(sceneObj);
  if (loc && loc !== "+? / nicht zugeordnet") {
    sceneObj.config.location = loc;
    sceneObj.config.area = loc;
    sceneObj.eplan.location = loc;
    sceneObj.location = loc;
  }

  const fg = resolveConveyorGroup(sceneObj);
  if (fg && fg !== "ohne Fördergruppe") {
    sceneObj.config.conveyorGroup = fg;
    sceneObj.conveyorGroup = fg;
  }

  const tag = resolveEquipmentTag(sceneObj);
  if (tag) {
    sceneObj.config.equipmentTag = tag;
    sceneObj.equipmentTag = tag;
    sceneObj.eplan.equipmentTag = tag;
  }

  return sceneObj;
}

function buildGroupedTree(panel) {
  const objects = getSceneObjects(panel).map(syncTechnicalFields);
  const locationMap = new Map();

  for (const obj of objects) {
    const loc = resolveLocation(obj);
    const fg = resolveConveyorGroup(obj);
    if (!locationMap.has(loc)) locationMap.set(loc, new Map());
    const fgMap = locationMap.get(loc);
    if (!fgMap.has(fg)) fgMap.set(fg, []);
    fgMap.get(fg).push(obj);
  }

  const locations = Array.from(locationMap.entries())
    .sort(([a], [b]) => sortNatural(a, b))
    .map(([loc, fgMap]) => ({
      loc,
      groups: Array.from(fgMap.entries())
        .sort(([a], [b]) => sortNatural(a, b))
        .map(([fg, items]) => ({
          fg,
          items: items.slice().sort((a, b) => sortNatural(resolveObjectName(a), resolveObjectName(b)))
        }))
    }));

  return { objects, locations };
}

function makeText(parent, tag, text, style = {}) {
  const el = document.createElement(tag);
  el.textContent = text;
  Object.assign(el.style, style);
  parent.appendChild(el);
  return el;
}

function makeSummary(text, subText) {
  const summary = document.createElement("summary");
  summary.className = "wa-structure-summary";
  summary.style.cursor = "pointer";
  summary.style.fontWeight = "750";
  summary.style.padding = "7px 8px";
  summary.style.border = "1px solid rgba(255,255,255,.08)";
  summary.style.borderRadius = "10px";
  summary.style.background = "rgba(255,255,255,.035)";

  const line = document.createElement("div");
  line.style.display = "flex";
  line.style.alignItems = "center";
  line.style.justifyContent = "space-between";
  line.style.gap = "8px";

  makeText(line, "span", text, { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
  if (subText) makeText(line, "span", subText, { opacity: ".68", fontSize: "11px", whiteSpace: "nowrap" });

  summary.appendChild(line);
  return summary;
}

function syncStructureSelectedState(panel, selectedId = getSelectionId(panel), options = {}) {
  const root =
    options.root ||
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

  let p = row.parentElement;
  while (p && p !== root) {
    if (p.tagName === "DETAILS") p.open = true;
    p = p.parentElement;
  }

  if (options.scroll) {
    try { row.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); }
    catch { try { row.scrollIntoView(false); } catch {} }
  }
}

function renderProjectStructurePanel(panel) {
  const box = document.createElement("div");
  box.className = "wa-assemblylab-panel wa-structure-panel";
  box.style.padding = "10px";
  box.style.display = "flex";
  box.style.flexDirection = "column";
  box.style.gap = "10px";
  box.style.paddingBottom = "calc(96px + env(safe-area-inset-bottom, 0px))";

  const { objects, locations } = buildGroupedTree(panel);
  const selectedId = getSelectionId(panel);

  const projectName = (() => {
    try {
      return panel.store?.get?.("app")?.project?.name ||
             panel.store?.get?.("app")?.project?.project?.name ||
             "Projekt";
    } catch {
      return "Projekt";
    }
  })();

  box.appendChild(panel._makePanelCardV1?.(
    "Projektstruktur",
    "Leichter Strukturbaum: Projekt → Ortbereich → Fördergruppe → Objekt. Details bleiben in Dialogen."
  ) || document.createElement("div"));

  const root = document.createElement("div");
  root.className = "wa-structure-tree";
  root.setAttribute("role", "tree");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "6px";

  const projectNode = panel._makePanelCardV1?.(`▾ ${projectName}`, `${objects.length} Objekte · ${locations.length} Ortbereiche`) || document.createElement("div");
  root.appendChild(projectNode);

  if (!objects.length) {
    const empty = document.createElement("div");
    empty.style.opacity = ".75";
    empty.style.fontSize = "12px";
    empty.textContent = "Noch keine Objekte platziert.";
    root.appendChild(empty);
  }

  for (const locNode of locations) {
    const locCount = locNode.groups.reduce((sum, g) => sum + g.items.length, 0);
    const locDetails = document.createElement("details");
    locDetails.open = true;
    locDetails.className = "wa-structure-location";
    locDetails.dataset.location = locNode.loc;
    locDetails.appendChild(makeSummary(`▾ Ort / Lastspannung: ${locNode.loc}`, `${locCount} Objekt${locCount === 1 ? "" : "e"}`));

    const fgWrap = document.createElement("div");
    fgWrap.style.display = "flex";
    fgWrap.style.flexDirection = "column";
    fgWrap.style.gap = "6px";
    fgWrap.style.margin = "6px 0 0 10px";

    for (const group of locNode.groups) {
      const fgDetails = document.createElement("details");
      fgDetails.open = true;
      fgDetails.className = "wa-structure-fg";
      fgDetails.dataset.location = locNode.loc;
      fgDetails.dataset.conveyorGroup = group.fg;
      fgDetails.appendChild(makeSummary(`▾ Fördergruppe: ${group.fg}`, `${group.items.length}`));

      const list = document.createElement("div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "5px";
      list.style.margin = "6px 0 0 10px";

      for (const obj of group.items) {
        const id = safeString(obj?.id);
        const row = document.createElement("button");
        row.type = "button";
        row.className = "wa-structure-row";
        row.dataset.objectId = id;
        row.dataset.location = locNode.loc;
        row.dataset.conveyorGroup = group.fg;
        row.setAttribute("role", "treeitem");
        row.setAttribute("aria-selected", id && id === selectedId ? "true" : "false");
        if (id && id === selectedId) row.classList.add("is-selected");

        row.style.textAlign = "left";
        row.style.border = "1px solid rgba(255,255,255,.08)";
        row.style.borderRadius = "10px";
        row.style.padding = "8px";
        row.style.background = id && id === selectedId ? "rgba(110,168,255,.18)" : "rgba(0,0,0,.18)";
        row.style.color = "inherit";
        row.style.font = "inherit";
        row.style.cursor = "pointer";

        const name = panel._escapeHtml?.(resolveObjectName(obj)) || resolveObjectName(obj);
        const type = panel._escapeHtml?.(safeString(obj?.type, "object")) || safeString(obj?.type, "object");
        const tag = panel._escapeHtml?.(resolveEquipmentTag(obj) || "-") || (resolveEquipmentTag(obj) || "-");
        const objId = panel._escapeHtml?.(id || "-") || (id || "-");

        row.innerHTML = `<strong>${name}</strong><br><span style="opacity:.72;font-size:12px;">${type} · BMK ${tag} · ${objId}</span>`;
        row.addEventListener("click", () => {
          panel._setSelectionToObject?.(obj, "structure");
          panel.state.rightTabId = "tab.properties";
          panel._renderRightTabs?.();
          panel._renderRightPanel?.();
          window.setTimeout(() => syncStructureSelectedState(panel, id, { scroll: false, root }), 0);
        });

        list.appendChild(row);
      }

      fgDetails.appendChild(list);
      fgWrap.appendChild(fgDetails);
    }

    locDetails.appendChild(fgWrap);
    root.appendChild(locDetails);
  }

  box.appendChild(root);
  window.setTimeout(() => syncStructureSelectedState(panel, selectedId, { scroll: false, root }), 0);
  return box;
}

function refreshStructureIfVisible(panel, reason = "structure:refresh") {
  try {
    if (!panel || panel.state?.leftTabId !== "tab.structure") return;
    panel._crashLog?.("workarea:structure-tree:live-refresh", { patch: PATCH_ID, reason });
    panel._renderLeftPanel?.();
  } catch {}
}

function installPatch() {
  installStyle();

  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__workareaStructureTreeLiveGroupingV1Installed) return;
  proto.__workareaStructureTreeLiveGroupingV1Installed = true;

  proto._syncStructureTreeSelectedStateV1 = function _syncStructureTreeSelectedStateV1(selectedId, options = {}) {
    syncStructureSelectedState(this, selectedId || getSelectionId(this), options);
  };

  proto._refreshStructureTreeLiveGroupingV1 = function _refreshStructureTreeLiveGroupingV1(reason = "manual") {
    refreshStructureIfVisible(this, reason);
  };

  // Der zentrale Fix: der Baum wird nicht mehr über alte Felder gruppiert,
  // sondern jedes Mal aus config/eplan/legacy-Feldern live berechnet.
  proto._renderProjectStructurePanelV1 = function patchedRenderProjectStructurePanelV1() {
    return renderProjectStructurePanel(this);
  };
  proto._renderProjectStructurePanelV1.__workareaStructureTreeLiveGroupingV1 = true;

  patchMethod(proto, "_assemblyPropsPersistScene", (original) => function patchedAssemblyPropsPersistScene(sceneObj, reason = "assemblyprops", ...rest) {
    syncTechnicalFields(sceneObj);
    const result = original.call(this, sceneObj, reason, ...rest);
    if (String(reason || "").includes("location") || String(reason || "").includes("conveyorGroup") || String(reason || "").includes("equipmentTag") || String(reason || "").includes("name")) {
      window.setTimeout(() => refreshStructureIfVisible(this, reason), 0);
    }
    return result;
  });

  patchMethod(proto, "_setAssemblyEplanFieldV1", (original) => function patchedSetAssemblyEplanFieldV1(sceneObj, field, value, ...rest) {
    const result = original.call(this, sceneObj, field, value, ...rest);
    if (sceneObj && typeof sceneObj === "object") {
      ensureTechObjects(sceneObj);
      const f = safeString(field);
      const v = safeString(value);
      if (f === "location") {
        sceneObj.config.location = v;
        sceneObj.config.area = v;
        sceneObj.location = v;
      } else if (f === "equipmentTag") {
        sceneObj.config.equipmentTag = v;
        sceneObj.equipmentTag = v;
      } else if (f === "function" || f === "functionText") {
        sceneObj.eplan.functionText = v;
      }
      syncTechnicalFields(sceneObj);
      window.setTimeout(() => refreshStructureIfVisible(this, `eplan:${f}`), 0);
    }
    return result;
  });

  patchMethod(proto, "_setSelectionToObject", (original) => function patchedSetSelectionToObject(obj, reason, ...rest) {
    const result = original.call(this, obj, reason, ...rest);
    const id = safeString(obj?.id || getSelectionId(this));
    window.setTimeout(() => syncStructureSelectedState(this, id, { scroll: reason !== "structure" }), 0);
    return result;
  });

  patchMethod(proto, "_setSelectionToPoint", (original) => function patchedSetSelectionToPoint(...args) {
    const result = original.apply(this, args);
    window.setTimeout(() => syncStructureSelectedState(this, "", { scroll: false }), 0);
    return result;
  });

  patchMethod(proto, "_renderLeftPanel", (original) => function patchedRenderLeftPanel(...args) {
    const result = original.apply(this, args);
    window.setTimeout(() => syncStructureSelectedState(this, getSelectionId(this), { scroll: false }), 0);
    return result;
  });

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();
