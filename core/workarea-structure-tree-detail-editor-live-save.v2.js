/**
 * core/workarea-structure-tree-detail-editor-live-save.v2.js
 * Version: PATCH_workarea_structure_tree_detail_editor_live_save_v2 (2026-05-21)
 *
 * Zweck:
 * - Hotfix für den Detail-Editor aus dem Strukturbaum.
 * - Problem vorher: Felder wurden erst bei "change"/Blur gespeichert. Wenn
 *   während der Eingabe ein automatischer Re-Render vom Properties-Dock kam,
 *   wurde der noch nicht gespeicherte Text wieder durch den alten Wert ersetzt.
 * - Lösung: Eingaben werden live auf dem tatsächlichen sceneObj/component/port/BOM
 *   geschrieben und debounced persistiert. Zusätzlich werden die alten Change-
 *   Handler im Detail-Editor abgefangen, damit sie das Dock nicht unnötig neu
 *   rendern und den Fokus verlieren.
 *
 * Wichtig:
 * - Dieser Patch ist bewusst als Zusatzpatch gebaut und wird NACH
 *   workarea-structure-tree-detail-editor.v1.js geladen.
 * - Bestehende Felder/Editoren bleiben erhalten.
 * - Die Live-Speicherung greift nur innerhalb .wa-structure-detail-editor-host.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_detail_editor_live_save_v2";

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeNumber(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function getDetailState(panel) {
  const detail = panel?.state?.structureTreeDetailV1;
  return detail && typeof detail === "object" ? detail : null;
}

function getSceneObjects(panel) {
  try {
    const objects = panel?._getSceneObjectsLightV1?.();
    return Array.isArray(objects) ? objects.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function findSceneObjById(panel, objectId) {
  const id = safeString(objectId);
  if (!id) return null;
  return getSceneObjects(panel).find((obj) => safeString(obj?.id) === id) || null;
}

function getComponents(sceneObj) {
  if (Array.isArray(sceneObj?.components)) return sceneObj.components.filter(Boolean);
  if (Array.isArray(sceneObj?.componentRefs)) return sceneObj.componentRefs.filter(Boolean);
  return [];
}

function findComponent(sceneObj, componentId) {
  const id = safeString(componentId);
  if (!id) return null;
  return getComponents(sceneObj).find((cmp, index) => safeString(cmp?.id || `cmp-${index + 1}`) === id) || null;
}

function ensureObj(target, key) {
  if (!target || typeof target !== "object") return {};
  if (!target[key] || typeof target[key] !== "object") target[key] = {};
  return target[key];
}

function roleLabel(panel, role) {
  try {
    return safeString(panel?._getAssemblyRoleLabelV1?.(safeString(role, "component")), safeString(role, "component"));
  } catch {
    return safeString(role, "component");
  }
}

function ensureComponentEplan(panel, sceneObj, cmp) {
  if (!cmp || typeof cmp !== "object") return {};
  if (typeof panel?._ensureAssemblyComponentEplanV1 === "function") {
    try { return panel._ensureAssemblyComponentEplanV1(cmp, sceneObj); } catch {}
  }
  return ensureObj(cmp, "eplan");
}

function getPorts(panel, sceneObj) {
  if (Array.isArray(sceneObj?.ports) && sceneObj.ports.length) return sceneObj.ports.filter(Boolean);
  try {
    const ports = panel?._flattenAssemblyPortsV1?.(sceneObj?.components || []);
    return Array.isArray(ports) ? ports.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function findPort(panel, sceneObj, portId) {
  const id = safeString(portId);
  if (!id) return null;
  return getPorts(panel, sceneObj).find((port, index) => safeString(port?.id || port?.key || `port-${index + 1}`) === id) || null;
}

function findBomLine(sceneObj, bomKey) {
  const key = safeString(bomKey);
  const rows = Array.isArray(sceneObj?.bom) ? sceneObj.bom.filter(Boolean) : [];
  return rows.find((item, index) => safeString(item?.id || item?.code || item?.label || item?.title || `bom-${index + 1}`) === key) || null;
}

function schedulePersist(panel, sceneObj, reason = "structure-detail-editor-live-save") {
  if (!panel || !sceneObj) return;
  if (!panel.__structureDetailLiveSaveV2Timers) panel.__structureDetailLiveSaveV2Timers = new Map();
  const key = safeString(sceneObj.id, "scene");
  const oldTimer = panel.__structureDetailLiveSaveV2Timers.get(key);
  if (oldTimer) window.clearTimeout(oldTimer);
  const timer = window.setTimeout(() => {
    panel.__structureDetailLiveSaveV2Timers?.delete?.(key);
    try {
      sceneObj.updatedAt = new Date().toISOString();
      panel?._assemblyPropsPersistScene?.(sceneObj, reason);
      panel?._setStatus?.("Änderung gespeichert");
    } catch (err) {
      console.warn(`[${PATCH_ID}] persist failed`, err);
    }
  }, 280);
  panel.__structureDetailLiveSaveV2Timers.set(key, timer);
}

function setComponentConfig(panel, sceneObj, cmp, key, value, numeric = false) {
  if (!cmp) return;
  cmp.config = cmp.config && typeof cmp.config === "object" ? cmp.config : {};
  cmp.config[key] = numeric ? safeNumber(value, "") : safeString(value);
  cmp.updatedAt = new Date().toISOString();
  schedulePersist(panel, sceneObj, `structure-detail-live:component-config:${key}`);
}

function setComponentEplan(panel, sceneObj, cmp, key, value) {
  if (!cmp) return;
  const eplan = ensureComponentEplan(panel, sceneObj, cmp);
  const text = safeString(value);
  eplan[key] = text;

  // Kompatibilität: ältere Karten/Tree-Ausgaben lesen teils equipmentTag,
  // der neue Editor nutzt deviceTag. Beide Werte müssen synchron bleiben.
  if (key === "deviceTag" || key === "equipmentTag") {
    eplan.deviceTag = text;
    eplan.equipmentTag = text;
    cmp.equipmentTag = text;
  }

  if (key === "functionText") cmp.functionText = text;
  eplan.updatedAt = new Date().toISOString();
  cmp.updatedAt = eplan.updatedAt;
  schedulePersist(panel, sceneObj, `structure-detail-live:component-eplan:${key}`);
}

function setPortField(panel, sceneObj, port, key, value) {
  if (!port) return;
  const componentId = safeString(port.componentId || port.assemblyComponentId);
  const component = componentId ? findComponent(sceneObj, componentId) : null;
  let target = port;

  if (component) {
    component.ports = Array.isArray(component.ports) && component.ports.length
      ? component.ports
      : (panel?._makeAssemblyComponentPortsV1?.(component.role, component.id, component.name || component.label || "Bauteil") || []);
    const local = component.ports.find((p) => safeString(p.id || p.key) === safeString(port.id || port.key));
    if (local) target = local;
  }

  target[key] = key === "enabled" || key === "required" ? Boolean(value) : safeString(value);
  target.updatedAt = new Date().toISOString();

  if (Array.isArray(sceneObj.ports) && sceneObj.ports.length) {
    const scenePort = sceneObj.ports.find((p) => safeString(p.id || p.key) === safeString(port.id || port.key));
    if (scenePort) {
      scenePort[key] = target[key];
      scenePort.updatedAt = target.updatedAt;
    }
  }

  schedulePersist(panel, sceneObj, `structure-detail-live:port:${key}`);
}

function setBomField(panel, sceneObj, row, key, value, numeric = false) {
  if (!row) return;
  row[key] = numeric ? safeNumber(value, row[key] || "") : safeString(value);
  row.updatedAt = new Date().toISOString();
  schedulePersist(panel, sceneObj, `structure-detail-live:bom:${key}`);
}

function labelForControl(control) {
  let node = control?.previousElementSibling || null;
  while (node) {
    if (String(node.tagName || "").toLowerCase() === "label") return safeString(node.textContent);
    node = node.previousElementSibling;
  }
  return "";
}

function valueForControl(control) {
  if (!control) return "";
  if (control.type === "checkbox") return Boolean(control.checked);
  return control.value;
}

function commitComponentField(panel, sceneObj, cmp, label, rawValue, control) {
  const value = valueForControl(control) ?? rawValue;

  switch (label) {
    case "Name": {
      const name = safeString(value, cmp.name || cmp.label || "Bauteil");
      cmp.name = name;
      cmp.label = name;
      cmp.updatedAt = new Date().toISOString();
      schedulePersist(panel, sceneObj, "structure-detail-live:component:name");
      return true;
    }
    case "Rolle": {
      cmp.role = safeString(value, "component");
      cmp.roleLabel = roleLabel(panel, cmp.role);
      if (!Array.isArray(cmp.ports) || !cmp.ports.length) {
        try { cmp.ports = panel?._makeAssemblyComponentPortsV1?.(cmp.role, cmp.id, cmp.name || cmp.label || "Bauteil") || []; } catch {}
      }
      cmp.updatedAt = new Date().toISOString();
      schedulePersist(panel, sceneObj, "structure-detail-live:component:role");
      return true;
    }
    case "BMK / Gerät":
      setComponentEplan(panel, sceneObj, cmp, "deviceTag", value);
      return true;
    case "Funktion":
      setComponentEplan(panel, sceneObj, cmp, "functionText", value);
      return true;
    case "Anschluss":
      setComponentEplan(panel, sceneObj, cmp, "connectionRef", value);
      return true;
    case "Klemme":
      setComponentEplan(panel, sceneObj, cmp, "terminalRef", value);
      return true;
    case "Seite/Pfad":
      setComponentEplan(panel, sceneObj, cmp, "pagePath", value);
      return true;
    case "Hersteller":
      setComponentConfig(panel, sceneObj, cmp, "manufacturer", value);
      return true;
    case "Typ / Name":
      setComponentConfig(panel, sceneObj, cmp, "typeName", value);
      cmp.typeName = safeString(value);
      return true;
    case "Artikelnummer":
      setComponentConfig(panel, sceneObj, cmp, "articleNo", value);
      cmp.articleNo = safeString(value);
      return true;
    case "Kommentar":
      setComponentConfig(panel, sceneObj, cmp, "comment", value);
      cmp.comment = safeString(value);
      return true;
    case "Leistung kW":
      setComponentConfig(panel, sceneObj, cmp, "powerKw", value, true);
      return true;
    case "Spannung":
      setComponentConfig(panel, sceneObj, cmp, "voltage", value);
      return true;
    case "Strom A":
      setComponentConfig(panel, sceneObj, cmp, "currentA", value, true);
      return true;
    case "Drehzahl":
      setComponentConfig(panel, sceneObj, cmp, "speedRpm", value);
      return true;
    case "Baugröße":
      setComponentConfig(panel, sceneObj, cmp, "frameSize", value);
      return true;
    case "Versorgt von":
    case "Zuleitung von":
      setComponentConfig(panel, sceneObj, cmp, "fedFrom", value);
      return true;
    case "Antriebsseite":
      setComponentConfig(panel, sceneObj, cmp, "driveSide", value);
      return true;
    case "400V Einspeisung":
      setComponentConfig(panel, sceneObj, cmp, "supply400", value);
      return true;
    case "24V Versorgung":
      setComponentConfig(panel, sceneObj, cmp, "supply24", value);
      return true;
    case "Safety / STO":
      setComponentConfig(panel, sceneObj, cmp, "safety", value);
      return true;
    case "Netzwerk":
      setComponentConfig(panel, sceneObj, cmp, "network", value);
      return true;
    case "Quelle/Schrank":
      setComponentConfig(panel, sceneObj, cmp, "sourceCabinet", value);
      return true;
    case "IP / Adresse":
      setComponentConfig(panel, sceneObj, cmp, "networkAddress", value);
      return true;
    case "Sensorfunktion":
      setComponentConfig(panel, sceneObj, cmp, "sensorFunction", value);
      return true;
    case "Signal":
      setComponentConfig(panel, sceneObj, cmp, "signal", value);
      return true;
    case "Stecker":
      setComponentConfig(panel, sceneObj, cmp, "connector", value);
      return true;
    case "Ziel Eingang":
      setComponentConfig(panel, sceneObj, cmp, "targetInput", value);
      return true;
    case "Position":
      setComponentConfig(panel, sceneObj, cmp, "mountPosition", value);
      return true;
    case "Typ":
      setComponentConfig(panel, sceneObj, cmp, "switchType", value);
      return true;
    case "Nennstrom":
      setComponentConfig(panel, sceneObj, cmp, "ratedCurrent", value);
      return true;
    case "Versorgt":
      setComponentConfig(panel, sceneObj, cmp, "feeds", value);
      return true;
    case "Abschließbar":
      setComponentConfig(panel, sceneObj, cmp, "lockable", Boolean(value));
      return true;
    case "Klemmenleiste":
      setComponentConfig(panel, sceneObj, cmp, "terminalStrip", value);
      return true;
    case "Klemmenzahl":
      setComponentConfig(panel, sceneObj, cmp, "terminalCount", value);
      return true;
    case "Einspeisung":
      setComponentConfig(panel, sceneObj, cmp, "fedFrom", value);
      return true;
    default:
      return false;
  }
}

function commitPortField(panel, sceneObj, port, label, rawValue, control) {
  const value = valueForControl(control) ?? rawValue;
  const map = {
    "Label": "label",
    "Key": "key",
    "Art": "kind",
    "Richtung": "direction",
    "Spannung": "voltage",
    "Signal": "signal",
    "Stecker/Klemme": "connector",
    "Kabelhinweis": "cableHint",
    "Erforderlich": "required",
    "Aktiv": "enabled"
  };
  const key = map[label];
  if (!key) return false;
  setPortField(panel, sceneObj, port, key, value);
  return true;
}

function commitBomField(panel, sceneObj, row, label, rawValue, control) {
  const value = valueForControl(control) ?? rawValue;
  switch (label) {
    case "Bezeichnung":
      row.label = safeString(value, row.label || row.title || "Material");
      setBomField(panel, sceneObj, row, "label", row.label);
      return true;
    case "Code":
      setBomField(panel, sceneObj, row, "code", value);
      return true;
    case "Menge":
      setBomField(panel, sceneObj, row, "qty", value, true);
      return true;
    case "Einheit":
      row.uom = safeString(value, "Stk");
      setBomField(panel, sceneObj, row, "uom", row.uom);
      return true;
    case "Hersteller":
      setBomField(panel, sceneObj, row, "manufacturer", value);
      return true;
    case "Artikelnummer":
      setBomField(panel, sceneObj, row, "articleNo", value);
      return true;
    case "Kommentar":
      setBomField(panel, sceneObj, row, "comment", value);
      return true;
    default:
      return false;
  }
}

function commitControl(panel, control) {
  const detail = getDetailState(panel);
  const sceneObj = detail?.objectId ? findSceneObjById(panel, detail.objectId) : null;
  if (!detail || !sceneObj) return false;

  const label = labelForControl(control);
  if (!label) return false;
  const value = valueForControl(control);

  if (detail.kind === "component") {
    const cmp = findComponent(sceneObj, detail.componentId);
    return cmp ? commitComponentField(panel, sceneObj, cmp, label, value, control) : false;
  }

  if (detail.kind === "port") {
    const port = findPort(panel, sceneObj, detail.portId);
    return port ? commitPortField(panel, sceneObj, port, label, value, control) : false;
  }

  if (detail.kind === "bom") {
    const row = findBomLine(sceneObj, detail.bomKey);
    return row ? commitBomField(panel, sceneObj, row, label, value, control) : false;
  }

  return false;
}

function armLiveSave(panel, root) {
  if (!root || root.__structureDetailLiveSaveV2Armed) return root;
  root.__structureDetailLiveSaveV2Armed = true;

  const host = root.matches?.(".wa-structure-detail-editor-host")
    ? root
    : root.querySelector?.(".wa-structure-detail-editor-host");
  if (!host) return root;

  const controls = host.querySelectorAll("input, select, textarea");
  for (const control of controls) {
    if (control.__structureDetailLiveSaveV2Armed) continue;
    control.__structureDetailLiveSaveV2Armed = true;

    control.addEventListener("input", (ev) => {
      commitControl(panel, control);
      ev.stopImmediatePropagation();
    }, true);

    control.addEventListener("change", (ev) => {
      commitControl(panel, control);
      ev.stopImmediatePropagation();
    }, true);

    control.addEventListener("blur", () => {
      commitControl(panel, control);
    }, true);
  }

  return root;
}

function installPatch() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__workareaStructureTreeDetailEditorLiveSaveV2Installed) return;
  proto.__workareaStructureTreeDetailEditorLiveSaveV2Installed = true;

  const originalRenderPropertiesPanel = proto._renderPropertiesPanel;
  proto._renderPropertiesPanel = function patchedRenderPropertiesPanelWithLiveSave(...args) {
    const result = originalRenderPropertiesPanel.apply(this, args);
    return armLiveSave(this, result);
  };
  proto._renderPropertiesPanel.__workareaStructureTreeDetailEditorLiveSaveV2 = true;

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();
