/**
 * core/workarea-structure-tree-detail-editor-stability-clean.v5.js
 * Version: PATCH_workarea_structure_tree_stability_clean_v5 (2026-05-21)
 *
 * Ziel:
 * - Stabilitäts-Clean-Patch nach den schnellen Detail-Editor-Hotfixes v2/v3/v4.
 * - Die Dateien v2/v3/v4 dürfen NICHT mehr geladen werden, weil sie parallel
 *   mehrere input/change/blur-Listener und mehrere Persist-Pfade aktivieren.
 *
 * Was dieser Patch macht:
 * 1) Eingaben im Strukturbaum-Detail-Editor werden live in die aktuelle
 *    Workarea-Scene geschrieben, damit Felder beim Wechseln nicht zurückspringen.
 * 2) Bauteilnamen werden in die wichtigsten Spiegel innerhalb der Scene synchronisiert
 *    (components, componentRefs, ports, cablePoints, BOM).
 * 3) Automatischer schwerer Projekt-Save wird für alle structure-detail-Gründe
 *    zuverlässig unterdrückt – auch wenn der Grund als "scene:structure-detail..."
 *    bei _requestProjectSaveDebounced ankommt.
 * 4) Normale Workarea-Saves außerhalb des Detail-Editors bleiben unverändert.
 *
 * Ladereihenfolge:
 * - NACH workarea-structure-tree-detail-editor.v1.js
 * - STATT live-save.v2 / mirror-persist.v3 / safe-memory-save.v4
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_stability_clean_v5";

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

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Wichtig:
 * Vorher wurde nur startsWith("structure-detail...") geprüft.
 * _persistSceneToStore hängt aber "scene:" davor.
 * Darum muss hier bewusst includes() genutzt werden.
 */
function isStructureDetailReason(reason) {
  const text = safeString(reason);
  return text.includes("structure-detail") || text.includes("structure-tree-detail");
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

function findComponent(sceneObj, componentId) {
  const id = safeString(componentId);
  if (!id) return null;
  return asArray(sceneObj?.components).find((cmp, index) => {
    return safeString(cmp?.id || cmp?.componentId || `cmp-${index + 1}`) === id;
  }) || null;
}

function ensureObj(target, key) {
  if (!target || typeof target !== "object") return {};
  if (!target[key] || typeof target[key] !== "object") target[key] = {};
  return target[key];
}

function controlValue(control) {
  if (!control) return "";
  if (control.type === "checkbox") return Boolean(control.checked);
  return control.value;
}

function labelForControl(control) {
  let node = control?.previousElementSibling || null;
  while (node) {
    if (String(node.tagName || "").toLowerCase() === "label") {
      return safeString(node.textContent);
    }
    node = node.previousElementSibling;
  }
  return "";
}

function idsMatch(value, componentId) {
  return safeString(value) && safeString(value) === safeString(componentId);
}

function syncPortComponentName(port, componentId, name) {
  if (!port || typeof port !== "object") return;
  if (!idsMatch(port.componentId || port.assemblyComponentId, componentId)) return;
  port.componentName = name;
  port.updatedAt = nowIso();
}

function syncCablePointComponentName(point, componentId, name) {
  if (!point || typeof point !== "object") return;
  if (!idsMatch(point.componentId || point.assemblyComponentId, componentId)) return;
  point.componentName = name;
  const portLabel = safeString(point.portLabel || point.portKey || point.label || "");
  if (portLabel) point.endpointLabel = `${name} · ${portLabel}`;
  point.updatedAt = nowIso();
}

function roleLabel(panel, role) {
  try {
    return safeString(panel?._getAssemblyRoleLabelV1?.(role), role);
  } catch {
    return safeString(role, "component");
  }
}

/**
 * Synchronisiert nur die aktuelle Scene-Instanz.
 * Kein AssemblyLab-Template-Persist hier, damit beim Tippen kein schwerer
 * Speicherpfad losläuft.
 */
function syncComponentMirrors(panel, sceneObj, componentId, patch = {}) {
  if (!sceneObj || typeof sceneObj !== "object") return false;

  const id = safeString(componentId);
  if (!id) return false;

  const cmp = findComponent(sceneObj, id);
  if (!cmp) return false;

  const now = nowIso();
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    const name = safeString(patch.name, cmp.name || cmp.label || "Bauteil");

    cmp.name = name;
    cmp.label = name;
    cmp.componentName = name;
    cmp.updatedAt = now;

    for (const ref of asArray(sceneObj.componentRefs)) {
      if (!idsMatch(ref.id || ref.componentId || ref.assemblyComponentId, id)) continue;
      ref.name = name;
      ref.label = name;
      ref.componentName = name;
      ref.updatedAt = now;
    }

    for (const row of asArray(sceneObj.bom)) {
      if (!idsMatch(row.id || row.componentId || row.assemblyComponentId || row.code, id)) continue;
      row.name = name;
      row.label = name;
      row.title = name;
      row.updatedAt = now;
    }

    for (const port of asArray(sceneObj.ports)) syncPortComponentName(port, id, name);
    for (const port of asArray(cmp.ports)) syncPortComponentName(port, id, name);
    for (const point of asArray(sceneObj.cablePoints)) syncCablePointComponentName(point, id, name);
    for (const point of asArray(sceneObj.cablepoints)) syncCablePointComponentName(point, id, name);

    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "role")) {
    const role = safeString(patch.role, cmp.role || "component");
    cmp.role = role;
    cmp.roleLabel = roleLabel(panel, role);
    cmp.updatedAt = now;

    for (const ref of asArray(sceneObj.componentRefs)) {
      if (!idsMatch(ref.id || ref.componentId || ref.assemblyComponentId, id)) continue;
      ref.role = role;
      ref.roleLabel = cmp.roleLabel;
      ref.updatedAt = now;
    }

    for (const row of asArray(sceneObj.bom)) {
      if (!idsMatch(row.id || row.componentId || row.assemblyComponentId || row.code, id)) continue;
      row.role = role;
      row.roleLabel = cmp.roleLabel;
      row.category = cmp.roleLabel || row.category;
      row.updatedAt = now;
    }

    changed = true;
  }

  if (patch.eplan && typeof patch.eplan === "object") {
    const eplan = ensureObj(cmp, "eplan");
    Object.assign(eplan, patch.eplan, { updatedAt: now });

    const tag = safeString(patch.eplan.deviceTag || patch.eplan.equipmentTag || "");
    if (tag) {
      eplan.deviceTag = tag;
      eplan.equipmentTag = tag;
      cmp.equipmentTag = tag;

      for (const ref of asArray(sceneObj.componentRefs)) {
        if (!idsMatch(ref.id || ref.componentId || ref.assemblyComponentId, id)) continue;
        ref.equipmentTag = tag;
        ref.eplan = ref.eplan && typeof ref.eplan === "object" ? ref.eplan : {};
        ref.eplan.deviceTag = tag;
        ref.eplan.equipmentTag = tag;
        ref.updatedAt = now;
      }
    }

    changed = true;
  }

  if (patch.config && typeof patch.config === "object") {
    cmp.config = cmp.config && typeof cmp.config === "object" ? cmp.config : {};
    Object.assign(cmp.config, patch.config);
    cmp.updatedAt = now;
    changed = true;
  }

  if (changed) sceneObj.updatedAt = now;
  return changed;
}

function patchFromEditorLabel(label, value) {
  const text = typeof value === "boolean" ? value : safeString(value);

  switch (label) {
    case "Name":
      return { name: safeString(text, "Bauteil") };
    case "Rolle":
      return { role: safeString(text, "component") };
    case "BMK / Gerät":
    case "BMK":
      return { eplan: { deviceTag: safeString(text), equipmentTag: safeString(text) } };
    case "Funktion":
      return { eplan: { functionText: safeString(text) } };
    case "Anschluss":
      return { eplan: { connectionRef: safeString(text) } };
    case "Klemme":
      return { eplan: { terminalRef: safeString(text) } };
    case "Seite/Pfad":
      return { eplan: { pagePath: safeString(text) } };
    case "Hersteller":
      return { config: { manufacturer: safeString(text) } };
    case "Typ / Name":
      return { config: { typeName: safeString(text) } };
    case "Artikelnummer":
      return { config: { articleNo: safeString(text) } };
    case "Kommentar":
      return { config: { comment: safeString(text) } };
    case "Leistung kW":
      return { config: { powerKw: safeNumber(text, "") } };
    case "Spannung":
      return { config: { voltage: safeString(text) } };
    case "Strom A":
      return { config: { currentA: safeNumber(text, "") } };
    case "Baugröße":
      return { config: { frameSize: safeString(text) } };
    case "Versorgt von":
      return { config: { suppliedBy: safeString(text) } };
    case "Antriebsseite":
      return { config: { driveSide: safeString(text) } };
    case "400V Einspeisung":
      return { config: { supply400: safeString(text) } };
    case "24V Versorgung":
      return { config: { supply24: safeString(text) } };
    case "Safety / STO":
      return { config: { safetySto: safeString(text) } };
    case "Netzwerk":
      return { config: { network: safeString(text) } };
    case "Quelle/Schrank":
      return { config: { sourceCabinet: safeString(text) } };
    case "IP / Adresse":
      return { config: { networkAddress: safeString(text) } };
    case "Sensorfunktion":
      return { config: { sensorFunction: safeString(text) } };
    case "Signal":
      return { config: { signal: safeString(text) } };
    case "Stecker":
      return { config: { connector: safeString(text) } };
    case "Ziel Eingang":
      return { config: { targetInput: safeString(text) } };
    case "Position":
      return { config: { mountPosition: safeString(text) } };
    case "Typ":
      return { config: { switchType: safeString(text) } };
    case "Nennstrom":
      return { config: { ratedCurrent: safeString(text) } };
    case "Versorgt":
      return { config: { feeds: safeString(text) } };
    case "Zuleitung von":
      return { config: { fedFrom: safeString(text) } };
    case "Abschließbar":
      return { config: { lockable: Boolean(value) } };
    case "Klemmenleiste":
      return { config: { terminalStrip: safeString(text) } };
    case "Klemmenzahl":
      return { config: { terminalCount: safeString(text) } };
    case "Einspeisung":
      return { config: { fedFrom: safeString(text) } };
    default:
      return null;
  }
}

function persistSceneMemoryOnly(panel, reason = "structure-detail:memory") {
  if (!panel || typeof panel._persistSceneToStore !== "function") return;

  const autosave = panel._waAutosave;
  const hadAutosave = !!(autosave && typeof autosave === "object");
  const previousSuppress = hadAutosave ? autosave.suppress : undefined;

  try {
    if (hadAutosave) autosave.suppress = true;
    panel._persistSceneToStore(reason);
  } finally {
    if (hadAutosave) autosave.suppress = previousSuppress;
  }
}

function commitFromEditor(panel, control) {
  const detail = getDetailState(panel);
  if (!detail || detail.kind !== "component") return false;

  const sceneObj = findSceneObjById(panel, detail.objectId);
  if (!sceneObj) return false;

  const label = labelForControl(control);
  const patch = patchFromEditorLabel(label, controlValue(control));
  if (!patch) return false;

  const ok = syncComponentMirrors(panel, sceneObj, detail.componentId, patch);
  if (!ok) return false;

  panel.__structureDetailStabilityV5 = panel.__structureDetailStabilityV5 || {};
  panel.__structureDetailStabilityV5.active = true;
  panel.__structureDetailStabilityV5.dirty = true;
  panel.__structureDetailStabilityV5.lastEditAt = Date.now();

  try { persistSceneMemoryOnly(panel, "structure-detail:memory-only:v5"); } catch {}
  try { panel._setStatus?.("Änderung übernommen – Projekt-Save nicht automatisch ausgelöst"); } catch {}

  return true;
}

function armEditor(panel, root) {
  const host = root?.matches?.(".wa-structure-detail-editor-host")
    ? root
    : root?.querySelector?.(".wa-structure-detail-editor-host");

  if (!host || host.__structureDetailStabilityV5Armed) return root;
  host.__structureDetailStabilityV5Armed = true;

  const handler = (ev) => {
    const control = ev?.target;
    if (!control || !["INPUT", "SELECT", "TEXTAREA"].includes(String(control.tagName || ""))) return;
    commitFromEditor(panel, control);
  };

  host.addEventListener("input", handler, true);
  host.addEventListener("change", handler, true);
  host.addEventListener("blur", (ev) => {
    handler(ev);
    if (panel?.__structureDetailStabilityV5) {
      panel.__structureDetailStabilityV5.active = false;
    }
  }, true);

  return root;
}

function installPatch() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__workareaStructureDetailStabilityCleanV5Installed) return;
  proto.__workareaStructureDetailStabilityCleanV5Installed = true;

  const previousRequestSave = proto._requestProjectSaveDebounced;
  proto._requestProjectSaveDebounced = function patchedRequestProjectSaveDebouncedStabilityV5(reason = "workarea", ...rest) {
    if (isStructureDetailReason(reason)) {
      try {
        this._crashLog?.("workarea:structure-detail-save:suppressed:v5", {
          reason: safeString(reason),
          guard: "structure-detail-stability-clean-v5"
        });
      } catch {}
      return;
    }
    return previousRequestSave?.call(this, reason, ...rest);
  };

  const previousPersistScene = proto._persistSceneToStore;
  proto._persistSceneToStore = function patchedPersistSceneToStoreStabilityV5(reason = "scene", ...rest) {
    if (isStructureDetailReason(reason)) {
      const autosave = this._waAutosave;
      const hadAutosave = !!(autosave && typeof autosave === "object");
      const previousSuppress = hadAutosave ? autosave.suppress : undefined;

      try {
        if (hadAutosave) autosave.suppress = true;
        return previousPersistScene?.call(this, reason, ...rest);
      } finally {
        if (hadAutosave) autosave.suppress = previousSuppress;
      }
    }

    return previousPersistScene?.call(this, reason, ...rest);
  };

  const previousRenderPropertiesPanel = proto._renderPropertiesPanel;
  proto._renderPropertiesPanel = function patchedRenderPropertiesPanelStabilityV5(...args) {
    const result = previousRenderPropertiesPanel.apply(this, args);
    return armEditor(this, result);
  };

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();

export {};
