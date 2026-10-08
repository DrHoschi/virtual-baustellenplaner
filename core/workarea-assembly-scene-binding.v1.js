/*
 * =====================================================================
 * DATEI: /core/workarea-assembly-scene-binding.v1.js
 * VERSION: v1.0.0-real-workarea-scene-binding
 * STAND: 2026-05-19
 * PATCH: PATCH_workarea_assembly_scene_binding_v1
 *
 * ZWECK:
 * - Kleine Bridge zwischen Baugruppen-Katalog/Baugruppen-Panel und der
 *   echten WorkareaPanel-Scene.
 * - Stellt window.__BAUSTELLENPLANER_ASSEMBLY_BINDING__ bereit.
 * - Kann fertige assembly.instance-Objekte erzeugen und an die aktuelle
 *   Workarea weitergeben.
 *
 * WICHTIG:
 * - Additiv und defensiv: kein bestehender App-Start wird blockiert.
 * - Die eigentliche Store-Persistenz macht WorkareaPanel._persistSceneToStore().
 * =====================================================================
 */

import {
  ASSEMBLY_CATALOG,
  buildAssemblyInstance,
  getAssemblyTemplate,
  getAssemblyVariant,
  listAssemblyTemplates
} from "./workarea-assembly-catalog.v1.js";

const VERSION = "v1.0.0-real-workarea-scene-binding";
const PATCH = "PATCH_workarea_assembly_scene_binding_v1";

function log(type, detail = {}) {
  const payload = { version: VERSION, patch: PATCH, ...detail };
  try {
    window.dispatchEvent(new CustomEvent("bp:debug:event", { detail: { type, ...payload } }));
  } catch {}
  try {
    if (window.__bpCrashRecorder?.log) window.__bpCrashRecorder.log(type, payload);
    else if (window.BaustellenplanerCrashRecorder?.log) window.BaustellenplanerCrashRecorder.log(type, payload);
    else if (window.BP_CRASH_RECORDER?.log) window.BP_CRASH_RECORDER.log(type, payload);
  } catch {}
}

function makeId(prefix = "asm") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneJson(value, fallback = null) {
  try {
    return value == null ? fallback : JSON.parse(JSON.stringify(value));
  } catch {
    if (value && typeof value === "object") return { ...value };
    return fallback;
  }
}

function getCurrentWorkareaPanel() {
  return (
    window.__workareaPanel ||
    window.__WORKAREA_PANEL__ ||
    window.workareaPanel ||
    window.WorkareaPanel?.instance ||
    window.baustellenplanerWorkarea ||
    null
  );
}

function getAppStoreSnapshot() {
  try {
    const store = window.app?.store || window.store || window.__store || null;
    if (store?.snapshot) return store.snapshot();
    if (store?.getState) return store.getState();
    if (store?.get) {
      return {
        app: store.get("app"),
        project: store.get("project"),
        settings: store.get("settings"),
        ui: store.get("ui")
      };
    }
  } catch {}
  return null;
}

function findSceneArray(snapshot) {
  const candidates = [
    snapshot?.app?.project?.workspace?.scene?.objects,
    snapshot?.project?.workspace?.scene?.objects,
    snapshot?.app?.settings?.workspace?.scene?.objects,
    snapshot?.settings?.workspace?.scene?.objects,
    snapshot?.workarea?.scene?.objects,
    snapshot?.scene?.objects
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

function createAssemblyInstance(templateId, variantId, placement = {}, configPatch = {}) {
  const template = getAssemblyTemplate(templateId) || listAssemblyTemplates()[0];
  if (!template) throw new Error("Kein Baugruppen-Template verfügbar.");

  const variant = getAssemblyVariant(template.id, variantId) || template.variants?.[0];
  if (!variant) throw new Error(`Keine Variante für ${template.id} verfügbar.`);

  const mergedConfig = {
    ...(template.defaultConfig || {}),
    ...(variant.patchConfig || {}),
    ...(configPatch || {})
  };

  const built = buildAssemblyInstance({
    templateId: template.id,
    variantId: variant.id,
    x: Number(placement.x || 0) || 0,
    y: Number(placement.y || 0) || 0,
    rotation: Number(placement.rotation || placement.rotDeg || 0) || 0,
    config: mergedConfig
  });

  return {
    ...built,
    id: built.id || makeId("asm"),
    type: "assembly.instance",
    assemblyId: built.assemblyId || built.templateId || template.id,
    templateId: built.templateId || template.id,
    variantId: built.variantId || variant.id,
    name: built.name || mergedConfig.name || template.shortTitle || template.title,
    x: Number(built.x || placement.x || 0) || 0,
    y: Number(built.y || placement.y || 0) || 0,
    r: Number(built.r || 42) || 42,
    rotDeg: Number(built.rotDeg ?? built.rotation ?? placement.rotDeg ?? placement.rotation ?? 0) || 0,
    config: mergedConfig,
    params: cloneJson(mergedConfig, {}),
    bom: Array.isArray(built.bom) ? built.bom : cloneJson(variant.bom || [], []),
    ports: Array.isArray(built.ports) ? built.ports : cloneJson(template.ports || [], []),
    assemblyMeta: {
      catalogVersion: ASSEMBLY_CATALOG.version,
      domain: ASSEMBLY_CATALOG.domain,
      templateTitle: template.title,
      variantTitle: variant.title,
      createdBy: PATCH,
      createdAt: new Date().toISOString()
    }
  };
}

function insertAssemblyInstance(instance, reason = "assembly-binding") {
  const wa = getCurrentWorkareaPanel();
  const obj = cloneJson(instance, instance);

  try {
    if (wa?.addSceneObject) {
      const inserted = wa.addSceneObject(obj, reason);
      log("workarea:assembly-binding:inserted-direct", { id: inserted?.id || obj?.id, reason });
      return inserted;
    }
    if (wa?.insertSceneObject) {
      const inserted = wa.insertSceneObject(obj, reason);
      log("workarea:assembly-binding:inserted-direct", { id: inserted?.id || obj?.id, reason });
      return inserted;
    }
  } catch (err) {
    log("workarea:assembly-binding:direct-error", { message: String(err?.message || err), reason });
  }

  try {
    window.dispatchEvent(new CustomEvent("bp:workarea:assembly:insert", { detail: { object: obj, reason } }));
    window.dispatchEvent(new CustomEvent("workarea:assembly:insert", { detail: { object: obj, reason } }));
    log("workarea:assembly-binding:insert-event", { id: obj?.id, reason });
    return obj;
  } catch (err) {
    log("workarea:assembly-binding:event-error", { message: String(err?.message || err), reason });
  }

  return null;
}

const api = {
  version: VERSION,
  patch: PATCH,
  catalog: ASSEMBLY_CATALOG,
  createAssemblyInstance,
  insertAssemblyInstance,
  buildAssemblyInstance,
  getAssemblyTemplate,
  getAssemblyVariant,
  listAssemblyTemplates,
  getCurrentWorkareaPanel,
  getAppStoreSnapshot,
  findSceneArray
};

try {
  window.__BAUSTELLENPLANER_ASSEMBLY_BINDING__ = api;
  window.BPAssemblySceneBinding = api;
  log("workarea:assembly-binding:ready", { templates: ASSEMBLY_CATALOG.templates.length });
} catch {}

export default api;
export {
  api as WorkareaAssemblySceneBinding,
  createAssemblyInstance,
  insertAssemblyInstance,
  getCurrentWorkareaPanel,
  getAppStoreSnapshot,
  findSceneArray
};
