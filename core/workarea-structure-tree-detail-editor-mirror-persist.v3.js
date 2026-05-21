/**
 * core/workarea-structure-tree-detail-editor-mirror-persist.v3.js
 * Version: PATCH_workarea_structure_tree_detail_editor_mirror_persist_v3 (2026-05-21)
 *
 * Zweck:
 * - Hotfix nach live-save v2: Eingaben blieben zwar kurz im Feld stehen,
 *   wurden beim erneuten Öffnen aber wieder aus alten Spiegel-Daten gelesen.
 * - Ursache: Eine Baugruppen-Instanz hält dieselbe Bauteil-Info mehrfach:
 *   components[], componentRefs[], bom[], ports[], cablePoints[] und ggf.
 *   zusätzlich im AssemblyLab-Template/Variant. Wenn nur components[] geändert
 *   wird, können Baum/Editor später wieder alte Werte anzeigen.
 * - Lösung: Vor jedem Persist und zusätzlich direkt während der Eingabe werden
 *   Bauteil-Namen und wichtige Anzeige-/EPLAN-Felder in alle relevanten Spiegel
 *   synchronisiert.
 *
 * Wird NACH folgenden Dateien geladen:
 * - workarea-structure-tree-detail-editor.v1.js
 * - workarea-structure-tree-detail-editor-live-save.v2.js
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_detail_editor_mirror_persist_v3";

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
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
  return asArray(sceneObj?.components).find((cmp, index) => safeString(cmp?.id || `cmp-${index + 1}`) === id) || null;
}

function ensureObj(target, key) {
  if (!target || typeof target !== "object") return {};
  if (!target[key] || typeof target[key] !== "object") target[key] = {};
  return target[key];
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

function idsMatch(value, componentId) {
  return safeString(value) && safeString(value) === safeString(componentId);
}

function syncPortComponentName(port, componentId, name) {
  if (!port || typeof port !== "object") return;
  if (!idsMatch(port.componentId || port.assemblyComponentId, componentId)) return;
  port.componentName = name;
  port.updatedAt = new Date().toISOString();
}

function syncCablePointComponentName(point, componentId, name) {
  if (!point || typeof point !== "object") return;
  if (!idsMatch(point.componentId || point.assemblyComponentId, componentId)) return;
  point.componentName = name;
  const portLabel = safeString(point.portLabel || point.portKey || point.label || "");
  if (portLabel) point.endpointLabel = `${name} · ${portLabel}`;
  point.updatedAt = new Date().toISOString();
}

function syncAssemblyLabVariantComponent(panel, sceneObj, componentId, patch = {}) {
  if (!panel || !sceneObj || !componentId) return false;
  if (typeof panel._getAssemblyLabFromStore !== "function" || typeof panel._persistAssemblyLabToStore !== "function") return false;

  const templateId = safeString(sceneObj.templateId || sceneObj.assemblyLab?.templateId);
  const variantId = safeString(sceneObj.variantId || sceneObj.assemblyLab?.variantId);
  if (!templateId || !variantId) return false;

  const lab = panel._getAssemblyLabFromStore();
  if (!lab || typeof lab !== "object" || !Array.isArray(lab.templates)) return false;

  const tpl = lab.templates.find((t) => safeString(t?.id) === templateId);
  const variant = asArray(tpl?.variants).find((v) => safeString(v?.id) === variantId);
  const cmp = asArray(variant?.components).find((c) => safeString(c?.id) === safeString(componentId));
  if (!cmp) return false;

  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    cmp.name = patch.name;
    cmp.label = patch.name;
    for (const port of asArray(cmp.ports)) syncPortComponentName(port, componentId, patch.name);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "role")) {
    cmp.role = patch.role;
  }
  if (patch.eplan && typeof patch.eplan === "object") {
    cmp.eplan = cmp.eplan && typeof cmp.eplan === "object" ? cmp.eplan : {};
    Object.assign(cmp.eplan, patch.eplan, { updatedAt: new Date().toISOString() });
  }
  if (patch.config && typeof patch.config === "object") {
    cmp.config = cmp.config && typeof cmp.config === "object" ? cmp.config : {};
    Object.assign(cmp.config, patch.config);
  }

  cmp.updatedAt = new Date().toISOString();
  variant.updatedAt = cmp.updatedAt;
  tpl.updatedAt = cmp.updatedAt;
  panel._persistAssemblyLabToStore(lab, `structure-detail-mirror:v3:${componentId}`, { silent: true });
  return true;
}

function syncComponentMirrors(panel, sceneObj, componentId, patch = {}) {
  if (!sceneObj || typeof sceneObj !== "object") return false;
  const id = safeString(componentId);
  if (!id) return false;

  const cmp = findComponent(sceneObj, id);
  if (!cmp) return false;

  const now = new Date().toISOString();
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    const name = safeString(patch.name, cmp.name || cmp.label || "Bauteil");
    cmp.name = name;
    cmp.label = name;
    cmp.componentName = name;
    cmp.updatedAt = now;
    changed = true;

    for (const ref of asArray(sceneObj.componentRefs)) {
      if (!idsMatch(ref.id || ref.componentId, id)) continue;
      ref.name = name;
      ref.label = name;
      ref.componentName = name;
      ref.updatedAt = now;
    }

    for (const row of asArray(sceneObj.bom)) {
      if (!idsMatch(row.id || row.componentId || row.code, id)) continue;
      row.label = name;
      row.title = name;
      row.name = name;
      row.updatedAt = now;
    }

    for (const port of asArray(sceneObj.ports)) syncPortComponentName(port, id, name);
    for (const port of asArray(cmp.ports)) syncPortComponentName(port, id, name);
    for (const point of asArray(sceneObj.cablePoints)) syncCablePointComponentName(point, id, name);
    for (const point of asArray(sceneObj.cablepoints)) syncCablePointComponentName(point, id, name);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "role")) {
    const role = safeString(patch.role, cmp.role || "component");
    cmp.role = role;
    try { cmp.roleLabel = safeString(panel?._getAssemblyRoleLabelV1?.(role), cmp.roleLabel || role); } catch {}
    for (const ref of asArray(sceneObj.componentRefs)) {
      if (!idsMatch(ref.id || ref.componentId, id)) continue;
      ref.role = cmp.role;
      ref.roleLabel = cmp.roleLabel || ref.roleLabel;
      ref.updatedAt = now;
    }
    for (const row of asArray(sceneObj.bom)) {
      if (!idsMatch(row.id || row.componentId || row.code, id)) continue;
      row.role = cmp.role;
      row.roleLabel = cmp.roleLabel || row.roleLabel;
      row.category = cmp.roleLabel || row.category;
      row.updatedAt = now;
    }
    changed = true;
  }

  if (patch.eplan && typeof patch.eplan === "object") {
    const eplan = ensureObj(cmp, "eplan");
    Object.assign(eplan, patch.eplan, { updatedAt: now });
    if (patch.eplan.deviceTag || patch.eplan.equipmentTag) {
      const tag = safeString(patch.eplan.deviceTag || patch.eplan.equipmentTag);
      eplan.deviceTag = tag;
      eplan.equipmentTag = tag;
      cmp.equipmentTag = tag;
      for (const ref of asArray(sceneObj.componentRefs)) {
        if (!idsMatch(ref.id || ref.componentId, id)) continue;
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
    changed = true;
  }

  if (changed) {
    sceneObj.updatedAt = now;
    syncAssemblyLabVariantComponent(panel, sceneObj, id, patch);
  }

  return changed;
}

function syncAllComponentMirrors(panel, sceneObj) {
  let changed = false;
  for (const cmp of asArray(sceneObj?.components)) {
    const id = safeString(cmp?.id);
    if (!id) continue;
    const name = safeString(cmp.name || cmp.label || cmp.componentName || "");
    if (name) changed = syncComponentMirrors(panel, sceneObj, id, { name }) || changed;
  }
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
    default:
      return null;
  }
}

function scheduleFullPersist(panel, sceneObj, reason = "structure-detail-mirror:v3") {
  if (!panel || !sceneObj) return;
  if (!panel.__structureDetailMirrorPersistV3Timer) panel.__structureDetailMirrorPersistV3Timer = 0;
  window.clearTimeout(panel.__structureDetailMirrorPersistV3Timer);
  panel.__structureDetailMirrorPersistV3Timer = window.setTimeout(() => {
    panel.__structureDetailMirrorPersistV3Timer = 0;
    try {
      syncAllComponentMirrors(panel, sceneObj);
      panel._assemblyPropsPersistScene?.(sceneObj, reason);
      panel._setStatus?.("Bauteil gespeichert");
    } catch (err) {
      console.warn(`[${PATCH_ID}] persist failed`, err);
    }
  }, 120);
}

function commitFromHostEvent(panel, ev) {
  const control = ev?.target;
  if (!control || !["INPUT", "SELECT", "TEXTAREA"].includes(String(control.tagName || ""))) return false;

  const detail = getDetailState(panel);
  if (!detail || detail.kind !== "component") return false;

  const sceneObj = findSceneObjById(panel, detail.objectId);
  if (!sceneObj) return false;

  const label = labelForControl(control);
  const patch = patchFromEditorLabel(label, controlValue(control));
  if (!patch) return false;

  const ok = syncComponentMirrors(panel, sceneObj, detail.componentId, patch);
  if (ok) scheduleFullPersist(panel, sceneObj, `structure-detail-mirror:v3:${label}`);
  return ok;
}

function armHostCapture(panel, root) {
  const host = root?.matches?.(".wa-structure-detail-editor-host")
    ? root
    : root?.querySelector?.(".wa-structure-detail-editor-host");
  if (!host || host.__structureDetailMirrorPersistV3Armed) return root;
  host.__structureDetailMirrorPersistV3Armed = true;

  const handler = (ev) => {
    // Der Handler sitzt am Host in der Capture-Phase. Dadurch läuft er vor den
    // target-listenern aus live-save v2, die stopImmediatePropagation nutzen.
    commitFromHostEvent(panel, ev);
  };

  host.addEventListener("input", handler, true);
  host.addEventListener("change", handler, true);
  host.addEventListener("blur", handler, true);
  return root;
}

function installPatch() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__workareaStructureTreeDetailEditorMirrorPersistV3Installed) return;
  proto.__workareaStructureTreeDetailEditorMirrorPersistV3Installed = true;

  const originalPersist = proto._assemblyPropsPersistScene;
  if (typeof originalPersist === "function") {
    proto._assemblyPropsPersistScene = function patchedAssemblyPropsPersistSceneMirrorV3(sceneObj, reason = "assemblyprops") {
      try {
        if (sceneObj?.type === "assembly.instance") syncAllComponentMirrors(this, sceneObj);
      } catch (err) {
        console.warn(`[${PATCH_ID}] mirror sync before persist failed`, err);
      }
      return originalPersist.call(this, sceneObj, reason);
    };
    proto._assemblyPropsPersistScene.__structureDetailMirrorPersistV3 = true;
  }

  const originalRenderPropertiesPanel = proto._renderPropertiesPanel;
  proto._renderPropertiesPanel = function patchedRenderPropertiesPanelMirrorPersistV3(...args) {
    const result = originalRenderPropertiesPanel.apply(this, args);
    return armHostCapture(this, result);
  };
  proto._renderPropertiesPanel.__structureDetailMirrorPersistV3 = true;

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();
