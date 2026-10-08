/**
 * core/workarea-structure-tree-detail-editor-safe-memory-save.v4.js
 * Version: PATCH_workarea_structure_tree_detail_editor_safe_memory_save_v4 (2026-05-21)
 *
 * Zweck:
 * - Hotfix nach v2/v3: Auf iPhone/Safari kam es beim automatischen Speichern
 *   während der Eingabe im Strukturbaum-Detail-Editor zu harten Reloads.
 * - Dieser Patch trennt deshalb zwei Dinge sauber:
 *   1) Live-Eingabe bleibt sofort im laufenden Projekt/Scene-State sichtbar.
 *   2) Der schwere Projekt-Save wird für Strukturbaum-Editor-Eingaben NICHT
 *      mehr automatisch ausgelöst.
 *
 * Wirkung:
 * - Tippen in Name/BMK/Hersteller/... darf die Seite nicht mehr neu laden.
 * - Beim Wechsel raus und wieder rein bleibt der geänderte Wert im aktuellen
 *   Laufzustand erhalten.
 * - Der normale Projekt-Save bleibt für alle anderen Workarea-Aktionen erhalten.
 *
 * Wird NACH v3 geladen:
 * - workarea-structure-tree-detail-editor.v1.js
 * - workarea-structure-tree-detail-editor-live-save.v2.js
 * - workarea-structure-tree-detail-editor-mirror-persist.v3.js
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_detail_editor_safe_memory_save_v4";
const STRUCTURE_DETAIL_REASON_PREFIXES = [
  "structure-detail-live",
  "structure-detail-mirror",
  "structure-detail-editor",
  "structure-detail-safe"
];

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isStructureDetailReason(reason) {
  const text = safeString(reason);
  return STRUCTURE_DETAIL_REASON_PREFIXES.some((prefix) => text.startsWith(prefix));
}

function nowIso() {
  return new Date().toISOString();
}

function getDetailState(panel) {
  const detail = panel?.state?.structureTreeDetailV1;
  return detail && typeof detail === "object" ? detail : null;
}

function getSceneObjects(panel) {
  const direct = panel?._scene?.objects;
  if (Array.isArray(direct)) return direct.filter(Boolean);
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

function idsMatch(value, componentId) {
  return !!safeString(value) && safeString(value) === safeString(componentId);
}

function labelForControl(control) {
  let node = control?.previousElementSibling || null;
  while (node) {
    if (String(node.tagName || "").toLowerCase() === "label") return safeString(node.textContent);
    node = node.previousElementSibling;
  }
  return "";
}

function controlValue(control) {
  if (!control) return "";
  if (control.type === "checkbox") return Boolean(control.checked);
  return control.value;
}

function ensureObj(target, key) {
  if (!target || typeof target !== "object") return {};
  if (!target[key] || typeof target[key] !== "object") target[key] = {};
  return target[key];
}

function syncNameMirrors(sceneObj, componentId, name) {
  const text = safeString(name, "Bauteil");
  const now = nowIso();

  const cmp = findComponent(sceneObj, componentId);
  if (cmp) {
    cmp.name = text;
    cmp.label = text;
    cmp.componentName = text;
    cmp.updatedAt = now;
  }

  for (const ref of asArray(sceneObj?.componentRefs)) {
    if (!idsMatch(ref.id || ref.componentId, componentId)) continue;
    ref.name = text;
    ref.label = text;
    ref.componentName = text;
    ref.updatedAt = now;
  }

  for (const row of asArray(sceneObj?.bom)) {
    if (!idsMatch(row.id || row.componentId || row.code, componentId)) continue;
    row.name = text;
    row.label = text;
    row.title = text;
    row.updatedAt = now;
  }

  const syncPort = (port) => {
    if (!port || typeof port !== "object") return;
    if (!idsMatch(port.componentId || port.assemblyComponentId, componentId)) return;
    port.componentName = text;
    port.updatedAt = now;
  };

  for (const port of asArray(sceneObj?.ports)) syncPort(port);
  for (const port of asArray(cmp?.ports)) syncPort(port);

  const syncPoint = (point) => {
    if (!point || typeof point !== "object") return;
    if (!idsMatch(point.componentId || point.assemblyComponentId, componentId)) return;
    point.componentName = text;
    const portLabel = safeString(point.portLabel || point.portKey || point.label || "");
    if (portLabel) point.endpointLabel = `${text} · ${portLabel}`;
    point.updatedAt = now;
  };

  for (const point of asArray(sceneObj?.cablePoints)) syncPoint(point);
  for (const point of asArray(sceneObj?.cablepoints)) syncPoint(point);

  sceneObj.updatedAt = now;
}

function applyBasicComponentEdit(panel, control) {
  const detail = getDetailState(panel);
  if (!detail || detail.kind !== "component") return false;

  const sceneObj = findSceneObjById(panel, detail.objectId);
  const cmp = sceneObj ? findComponent(sceneObj, detail.componentId) : null;
  if (!sceneObj || !cmp) return false;

  const label = labelForControl(control);
  const value = controlValue(control);
  const now = nowIso();

  if (label === "Name") {
    syncNameMirrors(sceneObj, detail.componentId, safeString(value, cmp.name || cmp.label || "Bauteil"));
  } else if (label === "Rolle") {
    cmp.role = safeString(value, cmp.role || "component");
    try { cmp.roleLabel = safeString(panel?._getAssemblyRoleLabelV1?.(cmp.role), cmp.roleLabel || cmp.role); } catch {}
    cmp.updatedAt = now;
    sceneObj.updatedAt = now;
  } else {
    const eplan = ensureObj(cmp, "eplan");
    const config = ensureObj(cmp, "config");
    const text = typeof value === "boolean" ? value : safeString(value);

    switch (label) {
      case "BMK / Gerät":
      case "BMK":
        eplan.deviceTag = safeString(text);
        eplan.equipmentTag = safeString(text);
        cmp.equipmentTag = safeString(text);
        break;
      case "Funktion":
        eplan.functionText = safeString(text);
        cmp.functionText = safeString(text);
        break;
      case "Anschluss": eplan.connectionRef = safeString(text); break;
      case "Klemme": eplan.terminalRef = safeString(text); break;
      case "Seite/Pfad": eplan.pagePath = safeString(text); break;
      case "Hersteller": config.manufacturer = safeString(text); break;
      case "Typ / Name": config.typeName = safeString(text); cmp.typeName = safeString(text); break;
      case "Artikelnummer": config.articleNo = safeString(text); cmp.articleNo = safeString(text); break;
      case "Kommentar": config.comment = safeString(text); cmp.comment = safeString(text); break;
      case "Leistung kW": config.powerKw = safeString(text); break;
      case "Spannung": config.voltage = safeString(text); break;
      case "Strom A": config.currentA = safeString(text); break;
      case "Drehzahl": config.speedRpm = safeString(text); break;
      case "Baugröße": config.frameSize = safeString(text); break;
      case "Versorgt von":
      case "Zuleitung von": config.fedFrom = safeString(text); break;
      case "Antriebsseite": config.driveSide = safeString(text); break;
      case "400V Einspeisung": config.supply400 = safeString(text); break;
      case "24V Versorgung": config.supply24 = safeString(text); break;
      case "Safety / STO": config.safety = safeString(text); break;
      case "Netzwerk": config.network = safeString(text); break;
      case "Quelle/Schrank": config.sourceCabinet = safeString(text); break;
      case "IP / Adresse": config.networkAddress = safeString(text); break;
      case "Sensorfunktion": config.sensorFunction = safeString(text); break;
      case "Signal": config.signal = safeString(text); break;
      case "Stecker": config.connector = safeString(text); break;
      case "Ziel Eingang": config.targetInput = safeString(text); break;
      case "Position": config.mountPosition = safeString(text); break;
      case "Typ": config.switchType = safeString(text); break;
      case "Nennstrom": config.ratedCurrent = safeString(text); break;
      case "Versorgt": config.feeds = safeString(text); break;
      case "Abschließbar": config.lockable = Boolean(text); break;
      case "Klemmenleiste": config.terminalStrip = safeString(text); break;
      case "Klemmenzahl": config.terminalCount = safeString(text); break;
      case "Einspeisung": config.fedFrom = safeString(text); break;
      default:
        return false;
    }

    eplan.updatedAt = now;
    cmp.updatedAt = now;
    sceneObj.updatedAt = now;
  }

  // Nur leichter Store-State, KEIN schwerer Projekt-Save während der Eingabe.
  try { panel?._persistSceneToStore?.("structure-detail-safe:memory-only"); } catch {}
  try { panel?._setStatus?.("Änderung im laufenden Projekt übernommen"); } catch {}
  return true;
}

function markEditorDirty(panel, control) {
  if (!panel) return;
  panel.__structureDetailSafeMemoryV4 = panel.__structureDetailSafeMemoryV4 || {};
  panel.__structureDetailSafeMemoryV4.dirty = true;
  panel.__structureDetailSafeMemoryV4.lastEditAt = Date.now();
  panel.__structureDetailSafeMemoryV4.active = !!control;
}

function armSafeEditor(panel, root) {
  const host = root?.matches?.(".wa-structure-detail-editor-host")
    ? root
    : root?.querySelector?.(".wa-structure-detail-editor-host");
  if (!host || host.__structureDetailSafeMemoryV4Armed) return root;
  host.__structureDetailSafeMemoryV4Armed = true;

  const handler = (ev) => {
    const control = ev?.target;
    if (!control || !["INPUT", "SELECT", "TEXTAREA"].includes(String(control.tagName || ""))) return;
    markEditorDirty(panel, control);
    applyBasicComponentEdit(panel, control);
  };

  // Capture-Phase: läuft vor den alten v2/v3 Target-Handlern.
  host.addEventListener("input", handler, true);
  host.addEventListener("change", handler, true);
  host.addEventListener("blur", (ev) => {
    handler(ev);
    if (panel?.__structureDetailSafeMemoryV4) panel.__structureDetailSafeMemoryV4.active = false;
  }, true);

  return root;
}

function installPatch() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__workareaStructureDetailSafeMemoryV4Installed) return;
  proto.__workareaStructureDetailSafeMemoryV4Installed = true;

  const previousRequestSave = proto._requestProjectSaveDebounced;
  proto._requestProjectSaveDebounced = function patchedRequestProjectSaveDebouncedSafeMemoryV4(reason = "workarea", ...rest) {
    if (isStructureDetailReason(reason)) {
      try {
        this._crashLog?.("workarea:structure-detail-save:suppressed", {
          reason: safeString(reason),
          guard: "structure-detail-safe-memory-v4"
        });
      } catch {}
      return;
    }
    return previousRequestSave?.call(this, reason, ...rest);
  };
  proto._requestProjectSaveDebounced.__structureDetailSafeMemoryV4 = true;

  const previousAssemblyPersist = proto._assemblyPropsPersistScene;
  proto._assemblyPropsPersistScene = function patchedAssemblyPropsPersistSceneSafeMemoryV4(sceneObj, reason = "assemblyprops", ...rest) {
    if (isStructureDetailReason(reason)) {
      if (!sceneObj) return;
      try {
        sceneObj.config = sceneObj.config && typeof sceneObj.config === "object" ? sceneObj.config : {};
        sceneObj.visual = sceneObj.visual && typeof sceneObj.visual === "object" ? sceneObj.visual : {};
        sceneObj.visual.label = sceneObj.name || sceneObj.visual.label || "Baugruppe";
        sceneObj.config.name = sceneObj.name || sceneObj.config.name || "Baugruppe";
        sceneObj.updatedAt = nowIso();
        this._persistSceneToStore?.("structure-detail-safe:memory-only");
        this._crashLog?.("workarea:structure-detail-persist:memory-only", {
          id: sceneObj.id || null,
          reason: safeString(reason),
          guard: "structure-detail-safe-memory-v4"
        });
      } catch (err) {
        console.warn(`[${PATCH_ID}] memory-only persist failed`, err);
      }
      return;
    }
    return previousAssemblyPersist?.call(this, sceneObj, reason, ...rest);
  };
  proto._assemblyPropsPersistScene.__structureDetailSafeMemoryV4 = true;

  const previousRenderPropertiesPanel = proto._renderPropertiesPanel;
  proto._renderPropertiesPanel = function patchedRenderPropertiesPanelSafeMemoryV4(...args) {
    const result = previousRenderPropertiesPanel.apply(this, args);
    return armSafeEditor(this, result);
  };
  proto._renderPropertiesPanel.__structureDetailSafeMemoryV4 = true;

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();
