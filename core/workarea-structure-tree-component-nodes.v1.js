/**
 * core/workarea-structure-tree-component-nodes.v1.js
 * Version: PATCH_workarea_structure_tree_component_nodes_v1 (2026-05-21)
 *
 * Zweck:
 * - Erweitert den bestehenden Workarea-Strukturbaum um eine leichte
 *   Baugruppen-Innenstruktur unter jedem platzierten Objekt.
 * - Sichtbare Ebenen:
 *   Projekt -> Ortbereich -> Fördergruppe -> Objekt -> Baugruppenrollen
 *   -> Bauteil / Port / BOM-Gruppe.
 * - Klick auf Motor, MOVIFIT, Sensor, Wartungsschalter oder Port öffnet rechts
 *   eine gezielte Kurzkarte im Properties-Dock.
 *
 * Wichtige Design-Regel:
 * - Keine schweren Tabellen im linken Baum rendern.
 * - Der Baum zeigt Navigation und Zählwerte; Detailbearbeitung bleibt rechts
 *   oder in bestehenden Dialogen.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_component_nodes_v1";
const STYLE_ID = "bp-workarea-structure-tree-component-nodes-v1";

const ROLE_GROUPS = [
  {
    id: "mechanics",
    label: "Mechanik",
    icon: "▧",
    roles: ["mechanic", "mechanics", "frame", "roller", "rollers", "base", "support", "guard", "component"]
  },
  {
    id: "drive",
    label: "Antrieb / Motor",
    icon: "M",
    roles: ["drive", "motor", "gear", "gearbox", "belt", "chain"]
  },
  {
    id: "control",
    label: "Steuerung / MOVIFIT",
    icon: "A",
    roles: ["control", "controller", "movifit", "movipro", "io", "plc", "drivecontrol"]
  },
  {
    id: "sensorics",
    label: "Sensorik",
    icon: "S",
    roles: ["sensor", "sensors", "switch", "prox", "photoeye", "lightbarrier"]
  },
  {
    id: "maintenance",
    label: "Wartung / Sicherheit",
    icon: "W",
    roles: ["maintenance", "safety", "disconnect", "service", "lockout", "estop"]
  },
  {
    id: "junction",
    label: "Klemmkasten / Verteiler",
    icon: "X",
    roles: ["junction", "terminal", "box", "cabinet", "terminalbox"]
  }
];

const ROLE_TO_GROUP = new Map();
for (const group of ROLE_GROUPS) {
  for (const role of group.roles) ROLE_TO_GROUP.set(String(role).toLowerCase(), group.id);
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value) {
  return safeString(value).replace(/[&<>'"]/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  }[ch]));
}

function cssEscapeValue(value) {
  const text = safeString(value);
  if (globalThis.CSS && typeof globalThis.CSS.escape === "function") return globalThis.CSS.escape(text);
  return text.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function naturalSort(a, b) {
  return safeString(a).localeCompare(safeString(b), "de", { numeric: true, sensitivity: "base" });
}

function makeEl(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== "") el.textContent = text;
  return el;
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
/* ${PATCH_ID} ------------------------------------------------------------- */
.wa-structure-tree .wa-structure-object-wrap,
.wa-structure-tree .wa-structure-role-wrap {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.wa-structure-tree .wa-structure-object-details,
.wa-structure-tree .wa-structure-role-details {
  border: 0;
}

.wa-structure-tree .wa-structure-object-summary,
.wa-structure-tree .wa-structure-role-summary {
  list-style: none;
  cursor: pointer;
  user-select: none;
}

.wa-structure-tree .wa-structure-object-summary::-webkit-details-marker,
.wa-structure-tree .wa-structure-role-summary::-webkit-details-marker {
  display: none;
}

.wa-structure-tree .wa-structure-row.is-detail-selected,
.wa-structure-tree .wa-structure-row[data-detail-selected="true"] {
  background: rgba(52, 211, 153, 0.18) !important;
  border-color: rgba(52, 211, 153, 0.55) !important;
  box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.20) inset !important;
}

.wa-structure-tree .wa-structure-row[data-kind="component"] strong,
.wa-structure-tree .wa-structure-row[data-kind="port"] strong,
.wa-structure-tree .wa-structure-row[data-kind="bom"] strong {
  font-size: 12px;
}

.wa-structure-detail-card {
  border: 1px solid rgba(52, 211, 153, 0.26);
  border-radius: 12px;
  padding: 10px;
  background: rgba(16, 185, 129, 0.07);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wa-structure-detail-card__title {
  font-weight: 800;
}

.wa-structure-detail-card__sub {
  font-size: 12px;
  opacity: 0.72;
  line-height: 1.35;
}

.wa-structure-detail-grid {
  display: grid;
  grid-template-columns: minmax(90px, 0.72fr) minmax(0, 1.4fr);
  gap: 5px 10px;
  font-size: 12px;
}

.wa-structure-detail-grid > span:nth-child(odd) {
  opacity: 0.66;
}

.wa-structure-detail-edit-grid {
  display: grid;
  grid-template-columns: minmax(90px, 0.72fr) minmax(0, 1.4fr);
  gap: 7px 10px;
  align-items: center;
  font-size: 12px;
}

.wa-structure-detail-edit-grid label {
  opacity: 0.75;
}

.wa-structure-detail-edit-grid input,
.wa-structure-detail-edit-grid select {
  min-width: 0;
  width: 100%;
  height: 30px;
  border-radius: 8px;
  padding: 0 8px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  color: inherit;
  font: inherit;
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

function getDetailState(panel) {
  const detail = panel?.state?.structureTreeDetailV1;
  return detail && typeof detail === "object" ? detail : null;
}

function setDetailState(panel, detail) {
  if (!panel || !panel.state) return;
  panel.state.structureTreeDetailV1 = detail ? {
    schema: "baustellenplaner.workarea.structureTree.detail.v1",
    updatedAt: new Date().toISOString(),
    ...detail
  } : null;
}

function makeDetailKey(detail) {
  if (!detail) return "";
  return [detail.objectId, detail.kind, detail.groupId, detail.componentId, detail.portId, detail.bomKey]
    .map((part) => safeString(part, "-"))
    .join("|");
}

function getSceneObjects(panel) {
  try {
    const objects = panel?._getSceneObjectsLightV1?.();
    return Array.isArray(objects) ? objects.filter(Boolean) : [];
  } catch {
    return [];
  }
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

function roleLabel(panel, role, fallback = "Bauteil") {
  const r = safeString(role, "component");
  try {
    return safeString(panel?._getAssemblyRoleLabelV1?.(r, "short"), fallback || r);
  } catch {
    return fallback || r;
  }
}

function normalizeComponent(component, index, panel) {
  const c = component && typeof component === "object" ? component : {};
  const id = safeString(c.id || c.componentId || `cmp-${index + 1}`);
  const role = safeString(c.role || "component").toLowerCase();
  const groupId = ROLE_TO_GROUP.get(role) || "mechanics";
  const label = safeString(c.name || c.label || c.importName || c.projectAssetName || roleLabel(panel, role), roleLabel(panel, role));
  return { ...c, id, role, groupId, label, __index: index };
}

function getComponents(sceneObj, panel) {
  const raw = Array.isArray(sceneObj?.components) ? sceneObj.components : [];
  if (raw.length) return raw.map((component, index) => normalizeComponent(component, index, panel));

  // Fallback für ältere Instanzen: componentRefs oder BOM-Zeilen als leichte Knoten zeigen.
  const refs = Array.isArray(sceneObj?.componentRefs) ? sceneObj.componentRefs : [];
  if (refs.length) return refs.map((component, index) => normalizeComponent(component, index, panel));

  const bom = Array.isArray(sceneObj?.bom) ? sceneObj.bom : [];
  return bom.map((line, index) => normalizeComponent({
    id: safeString(line?.id || line?.code || `bom-cmp-${index + 1}`),
    name: safeString(line?.label || line?.title || line?.code || "BOM-Position"),
    role: safeString(line?.role || line?.category || "component"),
    bomLine: line
  }, index, panel));
}

function getPorts(sceneObj, panel) {
  if (Array.isArray(sceneObj?.ports) && sceneObj.ports.length) return sceneObj.ports.filter(Boolean);
  try {
    const ports = panel?._flattenAssemblyPortsV1?.(sceneObj?.components || []);
    return Array.isArray(ports) ? ports.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function groupComponents(sceneObj, panel) {
  const components = getComponents(sceneObj, panel);
  const byGroup = new Map(ROLE_GROUPS.map((g) => [g.id, { ...g, items: [] }]));

  for (const cmp of components) {
    const groupId = cmp.groupId || ROLE_TO_GROUP.get(safeString(cmp.role).toLowerCase()) || "mechanics";
    if (!byGroup.has(groupId)) byGroup.set(groupId, { id: groupId, label: "Weitere Bauteile", icon: "•", roles: [], items: [] });
    byGroup.get(groupId).items.push(cmp);
  }

  const ports = getPorts(sceneObj, panel);
  const bom = Array.isArray(sceneObj?.bom) ? sceneObj.bom.filter(Boolean) : [];

  const groups = Array.from(byGroup.values())
    .filter((g) => g.items.length)
    .map((g) => ({ ...g, items: g.items.slice().sort((a, b) => naturalSort(a.label, b.label)) }));

  if (ports.length) {
    groups.push({ id: "ports", label: "Anschlüsse / Ports", icon: "P", roles: [], items: ports, isPorts: true });
  }

  if (bom.length) {
    groups.push({ id: "bom", label: "Stückliste / Material", icon: "B", roles: [], items: bom, isBom: true });
  }

  return groups;
}

function buildGroupedTree(panel) {
  const objects = getSceneObjects(panel);
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
    .sort(([a], [b]) => naturalSort(a, b))
    .map(([loc, fgMap]) => ({
      loc,
      groups: Array.from(fgMap.entries())
        .sort(([a], [b]) => naturalSort(a, b))
        .map(([fg, items]) => ({
          fg,
          items: items.slice().sort((a, b) => naturalSort(resolveObjectName(a), resolveObjectName(b)))
        }))
    }));

  return { objects, locations };
}

function makeSummary(text, subText, className = "wa-structure-summary") {
  const summary = makeEl("summary", className);
  summary.style.cursor = "pointer";
  summary.style.fontWeight = "750";
  summary.style.padding = "7px 8px";
  summary.style.border = "1px solid rgba(255,255,255,.08)";
  summary.style.borderRadius = "10px";
  summary.style.background = "rgba(255,255,255,.035)";

  const line = makeEl("div");
  line.style.display = "flex";
  line.style.alignItems = "center";
  line.style.justifyContent = "space-between";
  line.style.gap = "8px";

  const main = makeEl("span", "", text);
  main.style.overflow = "hidden";
  main.style.textOverflow = "ellipsis";
  main.style.whiteSpace = "nowrap";
  line.appendChild(main);

  if (subText) {
    const sub = makeEl("span", "", subText);
    sub.style.opacity = ".68";
    sub.style.fontSize = "11px";
    sub.style.whiteSpace = "nowrap";
    line.appendChild(sub);
  }

  summary.appendChild(line);
  return summary;
}

function makeTreeRow({ kind, objectId, detailKey, selected, strong, sub, level = 0, onClick }) {
  const row = makeEl("button", "wa-structure-row");
  row.type = "button";
  row.dataset.kind = kind;
  if (objectId) row.dataset.objectId = objectId;
  if (detailKey) row.dataset.detailKey = detailKey;
  if (selected) {
    row.classList.add("is-detail-selected");
    row.dataset.detailSelected = "true";
    row.setAttribute("aria-selected", "true");
  } else {
    row.setAttribute("aria-selected", "false");
  }
  row.style.textAlign = "left";
  row.style.border = "1px solid rgba(255,255,255,.08)";
  row.style.borderRadius = "10px";
  row.style.padding = "8px";
  row.style.paddingLeft = `${8 + level * 10}px`;
  row.style.background = selected ? "rgba(52,211,153,.18)" : "rgba(0,0,0,.18)";
  row.style.color = "inherit";
  row.style.font = "inherit";
  row.style.cursor = "pointer";
  row.innerHTML = `<strong>${escapeHtml(strong)}</strong><br><span style="opacity:.72;font-size:12px;">${escapeHtml(sub)}</span>`;
  if (typeof onClick === "function") row.addEventListener("click", onClick);
  return row;
}

function findSceneObjById(panel, objectId) {
  const id = safeString(objectId);
  if (!id) return null;
  return getSceneObjects(panel).find((obj) => safeString(obj?.id) === id) || null;
}

function findComponent(sceneObj, componentId, panel) {
  const id = safeString(componentId);
  if (!id) return null;
  return getComponents(sceneObj, panel).find((cmp) => safeString(cmp?.id) === id) || null;
}

function findPort(sceneObj, portId, panel) {
  const id = safeString(portId);
  if (!id) return null;
  return getPorts(sceneObj, panel).find((port, index) => safeString(port?.id || port?.key || `port-${index + 1}`) === id) || null;
}

function selectObject(panel, obj, reason = "structure:object") {
  setDetailState(panel, null);
  panel?._setSelectionToObject?.(obj, reason);
  if (panel?.state) panel.state.rightTabId = "tab.properties";
  panel?._renderRightTabs?.();
  panel?._renderRightPanel?.();
}

function selectDetail(panel, obj, detail) {
  panel?._setSelectionToObject?.(obj, `structure:${detail.kind || "detail"}`);
  setDetailState(panel, detail);
  if (panel?.state) panel.state.rightTabId = "tab.properties";
  panel?._renderRightTabs?.();
  panel?._renderRightPanel?.();
  panel?._syncStructureComponentDetailStateV1?.();
}

function syncDetailState(panel) {
  const root = panel?._els?.leftPanelHost?.querySelector?.(".wa-structure-tree") || document.querySelector(".wa-structure-tree");
  if (!root) return;

  const detailKey = makeDetailKey(getDetailState(panel));
  const rows = Array.from(root.querySelectorAll(".wa-structure-row[data-detail-key]"));
  for (const row of rows) {
    const isSelected = detailKey && row.dataset.detailKey === detailKey;
    row.classList.toggle("is-detail-selected", !!isSelected);
    row.dataset.detailSelected = isSelected ? "true" : "false";
    if (isSelected) {
      row.setAttribute("aria-selected", "true");
      let parent = row.parentElement;
      while (parent && parent !== root) {
        if (parent.tagName === "DETAILS") parent.open = true;
        parent = parent.parentElement;
      }
    }
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
  const selectedObjectId = getSelectionId(panel);
  const selectedDetailKey = makeDetailKey(getDetailState(panel));

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
    "Projekt → Ortbereich → Fördergruppe → Objekt → Baugruppen/Ports. Klick auf Motor, MOVIFIT, Sensorik usw. öffnet rechts die Detailkarte."
  ) || document.createElement("div"));

  const root = makeEl("div", "wa-structure-tree");
  root.setAttribute("role", "tree");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "6px";

  const projectNode = panel._makePanelCardV1?.(`▾ ${projectName}`, `${objects.length} Objekte · ${locations.length} Ortbereiche`) || document.createElement("div");
  root.appendChild(projectNode);

  if (!objects.length) {
    const empty = makeEl("div", "", "Noch keine Objekte platziert.");
    empty.style.opacity = ".75";
    empty.style.fontSize = "12px";
    root.appendChild(empty);
  }

  for (const locNode of locations) {
    const locCount = locNode.groups.reduce((sum, group) => sum + group.items.length, 0);
    const locDetails = makeEl("details", "wa-structure-location");
    locDetails.open = true;
    locDetails.dataset.location = locNode.loc;
    locDetails.appendChild(makeSummary(`▾ Ort / Lastspannung: ${locNode.loc}`, `${locCount} Objekt${locCount === 1 ? "" : "e"}`));

    const fgWrap = makeEl("div");
    fgWrap.style.display = "flex";
    fgWrap.style.flexDirection = "column";
    fgWrap.style.gap = "6px";
    fgWrap.style.margin = "6px 0 0 10px";

    for (const group of locNode.groups) {
      const fgDetails = makeEl("details", "wa-structure-fg");
      fgDetails.open = true;
      fgDetails.dataset.location = locNode.loc;
      fgDetails.dataset.conveyorGroup = group.fg;
      fgDetails.appendChild(makeSummary(`▾ Fördergruppe: ${group.fg}`, `${group.items.length}`));

      const objectWrap = makeEl("div", "wa-structure-object-wrap");
      objectWrap.style.margin = "6px 0 0 10px";

      for (const obj of group.items) {
        const objectId = safeString(obj?.id);
        const componentGroups = groupComponents(obj, panel);
        const componentCount = componentGroups.reduce((sum, roleGroup) => sum + (roleGroup.isPorts || roleGroup.isBom ? 0 : roleGroup.items.length), 0);
        const portCount = getPorts(obj, panel).length;

        const objDetails = makeEl("details", "wa-structure-object-details");
        objDetails.open = objectId === selectedObjectId || componentGroups.length <= 5;
        objDetails.dataset.objectId = objectId;
        objDetails.appendChild(makeSummary(
          `▾ ${resolveObjectName(obj)}`,
          [safeString(obj?.type, "object"), resolveEquipmentTag(obj) ? `BMK ${resolveEquipmentTag(obj)}` : "", `${componentCount} Teile`, portCount ? `${portCount} Ports` : ""].filter(Boolean).join(" · "),
          "wa-structure-object-summary"
        ));

        const objList = makeEl("div", "wa-structure-role-wrap");
        objList.style.margin = "6px 0 0 10px";

        objList.appendChild(makeTreeRow({
          kind: "object",
          objectId,
          strong: "Objekt-Basisdaten",
          sub: `${safeString(obj?.type, "object")} · ${objectId || "-"}`,
          selected: objectId === selectedObjectId && !selectedDetailKey,
          onClick: () => selectObject(panel, obj, "structure:object")
        }));

        for (const roleGroup of componentGroups) {
          const details = makeEl("details", "wa-structure-role-details");
          details.open = roleGroup.id === "drive" || roleGroup.id === "control" || roleGroup.items.length <= 3;
          details.dataset.groupId = roleGroup.id;
          details.appendChild(makeSummary(`▾ ${roleGroup.icon || "•"} ${roleGroup.label}`, `${roleGroup.items.length}`, "wa-structure-role-summary"));

          const list = makeEl("div");
          list.style.display = "flex";
          list.style.flexDirection = "column";
          list.style.gap = "5px";
          list.style.margin = "6px 0 0 10px";

          const maxRows = roleGroup.isPorts ? 18 : roleGroup.isBom ? 12 : 24;
          roleGroup.items.slice(0, maxRows).forEach((item, index) => {
            if (roleGroup.isPorts) {
              const portId = safeString(item?.id || item?.key || `port-${index + 1}`);
              const detail = { objectId, kind: "port", groupId: "ports", portId };
              list.appendChild(makeTreeRow({
                kind: "port",
                objectId,
                detailKey: makeDetailKey(detail),
                selected: selectedDetailKey === makeDetailKey(detail),
                strong: safeString(item?.label || item?.key || portId, "Port"),
                sub: [item?.componentName, item?.voltage, item?.signal || item?.kind, item?.cableHint || item?.cableTypeHint].map((v) => safeString(v)).filter(Boolean).join(" · ") || "Anschluss",
                level: 1,
                onClick: () => selectDetail(panel, obj, detail)
              }));
              return;
            }

            if (roleGroup.isBom) {
              const bomKey = safeString(item?.id || item?.code || item?.label || item?.title || `bom-${index + 1}`);
              const detail = { objectId, kind: "bom", groupId: "bom", bomKey };
              list.appendChild(makeTreeRow({
                kind: "bom",
                objectId,
                detailKey: makeDetailKey(detail),
                selected: selectedDetailKey === makeDetailKey(detail),
                strong: safeString(item?.label || item?.title || item?.code || bomKey, "Material"),
                sub: [`Menge ${safeNumber(item?.qty, 1)}`, item?.uom || item?.unit || "Stk", item?.category || item?.roleLabel || item?.role].map((v) => safeString(v)).filter(Boolean).join(" · "),
                level: 1,
                onClick: () => selectDetail(panel, obj, detail)
              }));
              return;
            }

            const componentId = safeString(item?.id || `cmp-${index + 1}`);
            const detail = { objectId, kind: "component", groupId: roleGroup.id, componentId };
            const componentPorts = getPorts(obj, panel).filter((port) => safeString(port?.componentId || port?.assemblyComponentId) === componentId);
            list.appendChild(makeTreeRow({
              kind: "component",
              objectId,
              detailKey: makeDetailKey(detail),
              selected: selectedDetailKey === makeDetailKey(detail),
              strong: safeString(item?.label || item?.name || componentId, "Bauteil"),
              sub: [roleLabel(panel, item?.role), item?.eplan?.equipmentTag ? `BMK ${item.eplan.equipmentTag}` : "", componentPorts.length ? `${componentPorts.length} Ports` : ""].filter(Boolean).join(" · "),
              level: 1,
              onClick: () => selectDetail(panel, obj, detail)
            }));
          });

          if (roleGroup.items.length > maxRows) {
            const more = makeEl("div", "", `+ ${roleGroup.items.length - maxRows} weitere Einträge – im Voll-Editor anzeigen`);
            more.style.fontSize = "11px";
            more.style.opacity = ".65";
            more.style.padding = "4px 8px";
            list.appendChild(more);
          }

          details.appendChild(list);
          objList.appendChild(details);
        }

        objDetails.appendChild(objList);
        objectWrap.appendChild(objDetails);
      }

      fgDetails.appendChild(objectWrap);
      fgWrap.appendChild(fgDetails);
    }

    locDetails.appendChild(fgWrap);
    root.appendChild(locDetails);
  }

  box.appendChild(root);
  window.setTimeout(() => {
    panel?._syncStructureTreeSelectedStateV1?.(selectedObjectId, { scroll: false, root });
    syncDetailState(panel);
  }, 0);
  return box;
}

function makeInput(value, placeholder = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value == null ? "" : String(value);
  input.placeholder = placeholder;
  return input;
}

function appendGridRow(grid, label, value) {
  grid.appendChild(makeEl("span", "", label));
  grid.appendChild(makeEl("span", "", safeString(value, "-")));
}

function renderComponentDetailCard(panel, sceneObj, detail) {
  const cmp = findComponent(sceneObj, detail.componentId, panel);
  const card = makeEl("div", "wa-structure-detail-card");

  if (!cmp) {
    card.appendChild(makeEl("div", "wa-structure-detail-card__title", "Bauteil nicht gefunden"));
    card.appendChild(makeEl("div", "wa-structure-detail-card__sub", "Das Objekt wurde wahrscheinlich neu aufgebaut oder die Variante wurde gewechselt."));
    return card;
  }

  const title = makeEl("div", "wa-structure-detail-card__title", `${roleLabel(panel, cmp.role)} – ${safeString(cmp.name || cmp.label || cmp.id, "Bauteil")}`);
  card.appendChild(title);
  card.appendChild(makeEl("div", "wa-structure-detail-card__sub", `Objekt: ${resolveObjectName(sceneObj)} · ID: ${cmp.id}`));

  const grid = makeEl("div", "wa-structure-detail-grid");
  appendGridRow(grid, "Rolle", roleLabel(panel, cmp.role));
  appendGridRow(grid, "BMK", cmp?.eplan?.equipmentTag || cmp?.equipmentTag || "-");
  appendGridRow(grid, "Funktion", cmp?.eplan?.functionText || cmp?.functionText || "-");
  appendGridRow(grid, "Ort", cmp?.eplan?.location || resolveLocation(sceneObj));
  appendGridRow(grid, "Asset", cmp?.projectAssetId || "-");
  appendGridRow(grid, "Slot", cmp?.slotId || "-");
  appendGridRow(grid, "Position", `X ${safeNumber(cmp?.x)} · Y ${safeNumber(cmp?.y)} · R ${safeNumber(cmp?.rotDeg)}°`);
  const componentPorts = getPorts(sceneObj, panel).filter((port) => safeString(port?.componentId || port?.assemblyComponentId) === safeString(cmp.id));
  appendGridRow(grid, "Ports", componentPorts.length ? componentPorts.map((p) => safeString(p.label || p.key)).filter(Boolean).join(", ") : "-");
  card.appendChild(grid);

  const editTitle = makeEl("div", "", "Schnellfelder");
  editTitle.style.fontWeight = "700";
  editTitle.style.marginTop = "2px";
  card.appendChild(editTitle);

  const edit = makeEl("div", "wa-structure-detail-edit-grid");

  const nameInput = makeInput(cmp.name || cmp.label || "", "z. B. Motor -M1");
  nameInput.addEventListener("change", () => {
    cmp.name = safeString(nameInput.value, cmp.name || cmp.label || "Bauteil");
    panel?._assemblyPropsPersistScene?.(sceneObj, "structure:component:name");
    panel?._setStatus?.(`Bauteil gespeichert: ${cmp.name}`);
    panel?._renderLeftPanel?.();
    panel?._renderRightPanel?.();
  });
  edit.appendChild(makeEl("label", "", "Name"));
  edit.appendChild(nameInput);

  const bmkInput = makeInput(cmp?.eplan?.equipmentTag || cmp?.equipmentTag || "", "z. B. -M1 / -A1");
  bmkInput.addEventListener("change", () => {
    if (typeof panel?._setAssemblyComponentEplanFieldV1 === "function") {
      panel._setAssemblyComponentEplanFieldV1(sceneObj, cmp.id, "equipmentTag", bmkInput.value);
    } else {
      cmp.eplan = cmp.eplan && typeof cmp.eplan === "object" ? cmp.eplan : {};
      cmp.eplan.equipmentTag = safeString(bmkInput.value);
      panel?._assemblyPropsPersistScene?.(sceneObj, "structure:component:bmk");
    }
    panel?._setStatus?.(`BMK gespeichert: ${safeString(bmkInput.value, "-")}`);
    panel?._renderLeftPanel?.();
    panel?._renderRightPanel?.();
  });
  edit.appendChild(makeEl("label", "", "BMK"));
  edit.appendChild(bmkInput);

  const functionInput = makeInput(cmp?.eplan?.functionText || cmp?.functionText || "", "z. B. Antrieb Rollenbahn");
  functionInput.addEventListener("change", () => {
    if (typeof panel?._setAssemblyComponentEplanFieldV1 === "function") {
      panel._setAssemblyComponentEplanFieldV1(sceneObj, cmp.id, "functionText", functionInput.value);
    } else {
      cmp.eplan = cmp.eplan && typeof cmp.eplan === "object" ? cmp.eplan : {};
      cmp.eplan.functionText = safeString(functionInput.value);
      panel?._assemblyPropsPersistScene?.(sceneObj, "structure:component:functionText");
    }
    panel?._setStatus?.("Bauteil-Funktion gespeichert");
    panel?._renderRightPanel?.();
  });
  edit.appendChild(makeEl("label", "", "Funktion"));
  edit.appendChild(functionInput);

  card.appendChild(edit);
  return card;
}

function renderPortDetailCard(panel, sceneObj, detail) {
  const port = findPort(sceneObj, detail.portId, panel);
  const card = makeEl("div", "wa-structure-detail-card");

  if (!port) {
    card.appendChild(makeEl("div", "wa-structure-detail-card__title", "Port nicht gefunden"));
    card.appendChild(makeEl("div", "wa-structure-detail-card__sub", "Der Anschluss wurde wahrscheinlich neu erzeugt."));
    return card;
  }

  card.appendChild(makeEl("div", "wa-structure-detail-card__title", `Port – ${safeString(port.label || port.key || detail.portId, "Anschluss")}`));
  card.appendChild(makeEl("div", "wa-structure-detail-card__sub", `Objekt: ${resolveObjectName(sceneObj)} · Komponente: ${safeString(port.componentName, "-")}`));

  const grid = makeEl("div", "wa-structure-detail-grid");
  appendGridRow(grid, "Port-Key", port.key || port.id || detail.portId);
  appendGridRow(grid, "Bauteil", port.componentName || port.componentId || "-");
  appendGridRow(grid, "Rolle", roleLabel(panel, port.role || port.componentRole));
  appendGridRow(grid, "Spannung", port.voltage || "-");
  appendGridRow(grid, "Signal", port.signal || port.kind || "-");
  appendGridRow(grid, "Kabelhinweis", port.cableHint || port.cableTypeHint || "-");
  appendGridRow(grid, "Stecker/Klemme", port.connector || port.terminal || "-");
  card.appendChild(grid);
  return card;
}

function renderBomDetailCard(panel, sceneObj, detail) {
  const rows = Array.isArray(sceneObj?.bom) ? sceneObj.bom.filter(Boolean) : [];
  const row = rows.find((item, index) => safeString(item?.id || item?.code || item?.label || item?.title || `bom-${index + 1}`) === safeString(detail.bomKey)) || null;
  const card = makeEl("div", "wa-structure-detail-card");

  if (!row) {
    card.appendChild(makeEl("div", "wa-structure-detail-card__title", "Materialposition nicht gefunden"));
    return card;
  }

  card.appendChild(makeEl("div", "wa-structure-detail-card__title", `Material – ${safeString(row.label || row.title || row.code, "Position")}`));
  card.appendChild(makeEl("div", "wa-structure-detail-card__sub", `Objekt: ${resolveObjectName(sceneObj)}`));

  const grid = makeEl("div", "wa-structure-detail-grid");
  appendGridRow(grid, "Code", row.code || row.id || "-");
  appendGridRow(grid, "Menge", `${safeNumber(row.qty, 1)} ${safeString(row.uom || row.unit, "Stk")}`);
  appendGridRow(grid, "Kategorie", row.category || row.roleLabel || row.role || "-");
  appendGridRow(grid, "Asset", row.projectAssetId || "-");
  appendGridRow(grid, "Slot", row.slotId || "-");
  card.appendChild(grid);
  return card;
}

function renderDetailPropertiesPanel(panel, originalRenderPropertiesPanel) {
  const detail = getDetailState(panel);
  const sceneObj = detail?.objectId ? findSceneObjById(panel, detail.objectId) : null;

  if (!detail || !sceneObj) return originalRenderPropertiesPanel.call(panel);

  const box = document.createElement("div");
  box.className = "wa-properties-light";
  box.style.padding = "10px";
  box.style.display = "flex";
  box.style.flexDirection = "column";
  box.style.gap = "10px";

  box.appendChild(panel._makePanelCardV1?.(
    `Properties · Strukturdetail`,
    `Ausgewählt: ${resolveObjectName(sceneObj)} · ${detail.kind}`
  ) || document.createElement("div"));

  if (detail.kind === "component") box.appendChild(renderComponentDetailCard(panel, sceneObj, detail));
  else if (detail.kind === "port") box.appendChild(renderPortDetailCard(panel, sceneObj, detail));
  else if (detail.kind === "bom") box.appendChild(renderBomDetailCard(panel, sceneObj, detail));
  else box.appendChild(panel._makePanelCardV1?.("Strukturdetail", "Unbekannter Detailtyp") || document.createElement("div"));

  const actions = makeEl("div", "wa-light-actions");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.flexWrap = "wrap";

  actions.appendChild(panel._btn?.("Objekt-Basis", () => {
    selectObject(panel, sceneObj, "structure:detail-back-to-object");
  }) || document.createElement("button"));

  actions.appendChild(panel._btn?.("Voll-Editor", () => {
    panel?._openWorkareaModalV1?.("Voll-Editor", () => panel._renderPropertiesPanelFull(), { wide: true });
  }) || document.createElement("button"));

  actions.appendChild(panel._btn?.("Elektrik", () => {
    panel?._openWorkareaModalV1?.("Elektrik / Kabel / EPLAN", () => panel._renderElectricalDialogLightV1(sceneObj), { wide: true });
  }) || document.createElement("button"));

  actions.appendChild(panel._btn?.("Struktur", () => {
    panel.state.leftTabId = "tab.structure";
    panel._renderLeftTabs?.();
    panel._renderLeftPanel?.();
    window.setTimeout(() => panel?._syncStructureComponentDetailStateV1?.(), 0);
  }) || document.createElement("button"));

  box.appendChild(actions);

  const note = makeEl("div", "", "Diese Karte ist bewusst leicht. Kabeltabellen, BOM und Parameter bleiben im Voll-Editor/Dialog, damit die mobile Workarea stabil bleibt.");
  note.style.fontSize = "12px";
  note.style.opacity = ".68";
  note.style.lineHeight = "1.35";
  box.appendChild(note);

  return box;
}

function installPatch() {
  installStyle();

  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__workareaStructureTreeComponentNodesV1Installed) return;
  proto.__workareaStructureTreeComponentNodesV1Installed = true;

  const originalRenderPropertiesPanel = proto._renderPropertiesPanel;

  proto._syncStructureComponentDetailStateV1 = function _syncStructureComponentDetailStateV1() {
    syncDetailState(this);
  };

  proto._clearStructureComponentDetailV1 = function _clearStructureComponentDetailV1() {
    setDetailState(this, null);
  };

  proto._renderProjectStructurePanelV1 = function patchedRenderProjectStructurePanelV1() {
    return renderProjectStructurePanel(this);
  };
  proto._renderProjectStructurePanelV1.__workareaStructureTreeComponentNodesV1 = true;

  proto._renderPropertiesPanel = function patchedRenderPropertiesPanel() {
    return renderDetailPropertiesPanel(this, originalRenderPropertiesPanel);
  };
  proto._renderPropertiesPanel.__workareaStructureTreeComponentNodesV1 = true;

  const originalSetSelectionToObject = proto._setSelectionToObject;
  if (typeof originalSetSelectionToObject === "function" && !originalSetSelectionToObject.__workareaStructureTreeComponentNodesV1) {
    proto._setSelectionToObject = function patchedSetSelectionToObject(obj, reason, ...rest) {
      if (!String(reason || "").startsWith("structure:component") &&
          !String(reason || "").startsWith("structure:port") &&
          !String(reason || "").startsWith("structure:bom")) {
        setDetailState(this, null);
      }
      const result = originalSetSelectionToObject.call(this, obj, reason, ...rest);
      window.setTimeout(() => syncDetailState(this), 0);
      return result;
    };
    proto._setSelectionToObject.__workareaStructureTreeComponentNodesV1 = true;
  }

  const originalRenderLeftPanel = proto._renderLeftPanel;
  if (typeof originalRenderLeftPanel === "function" && !originalRenderLeftPanel.__workareaStructureTreeComponentNodesV1) {
    proto._renderLeftPanel = function patchedRenderLeftPanel(...args) {
      const result = originalRenderLeftPanel.apply(this, args);
      window.setTimeout(() => syncDetailState(this), 0);
      return result;
    };
    proto._renderLeftPanel.__workareaStructureTreeComponentNodesV1 = true;
  }

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();
