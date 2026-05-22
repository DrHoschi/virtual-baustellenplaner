/**
 * core/workarea-structure-tree-detail-editor-save-quarantine.v7.js
 * Version: PATCH_workarea_structure_tree_detail_editor_save_quarantine_v7 (2026-05-21)
 *
 * ZIEL / STABILITÄT:
 * v6 blockiert bereits _persistSceneToStore() für structure-detail-Gründe.
 * Der neue Crashlog zeigt aber, dass danach noch zwei andere Pfade feuern:
 *   - _assemblyPropsPersistScene(..., "assemblyprops:component-eplan:deviceTag")
 *   - _requestProjectSaveDebounced("structure-detail-editor:component:name")
 *
 * Außerdem wird der Autosave-Drag-Guard erst dynamisch über main.js installiert.
 * Dadurch kann er frühere Wrapper überschreiben. Dieser Patch installiert sich
 * deshalb mehrfach verzögert neu und setzt zusätzlich eine Bus-Quarantäne für
 * ui:project:save-Reasons aus dem Struktur-Detail-Editor.
 *
 * REGEL:
 * Während der Bearbeitung im Strukturbaum-Detail-Editor darf KEIN Projekt-Save
 * und KEIN schwerer AssemblyProps-Persist ausgelöst werden. Normale Saves aus
 * anderen Bereichen bleiben erhalten.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_detail_editor_save_quarantine_v7";
const GUARD_ID = "structure-detail-save-quarantine-v7";
const WRAP_FLAG = Symbol.for("baustellenplaner.structureDetailSaveQuarantine.v7.wrapper");

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function log(panel, event, data = {}) {
  try {
    if (panel && typeof panel._crashLog === "function") {
      panel._crashLog(event, data);
      return;
    }
  } catch {}
  try { window.BP_CRASH_RECORDER?.log?.(event, data); } catch {}
}

function ensureState(panel) {
  if (!panel) return null;
  if (!panel.__structureDetailSaveQuarantineV7) {
    panel.__structureDetailSaveQuarantineV7 = {
      lastEditAt: 0,
      active: false,
      blocked: 0
    };
  }
  return panel.__structureDetailSaveQuarantineV7;
}

function isActiveEditorElement(el) {
  try {
    return !!(el && typeof el.closest === "function" && el.closest(".wa-structure-detail-editor-host"));
  } catch {
    return false;
  }
}

function markDetailEditing(panel, source = "editor") {
  const st = ensureState(panel);
  if (!st) return;
  st.active = true;
  st.lastEditAt = nowMs();
  st.lastSource = source;
}

function isDetailEditWindow(panel) {
  const st = ensureState(panel);
  const age = st?.lastEditAt ? nowMs() - Number(st.lastEditAt || 0) : Infinity;
  if (st?.active && age < 10000) return true;
  if (age < 10000) return true;
  try {
    if (isActiveEditorElement(document.activeElement)) return true;
  } catch {}
  return false;
}

function isStructureDetailReason(reason) {
  const text = safeString(reason);
  if (!text) return false;
  return (
    text.includes("structure-detail") ||
    text.includes("structure-tree-detail") ||
    text.includes("structure-detail-editor")
  );
}

function isAssemblyComponentReason(reason) {
  const text = safeString(reason);
  return (
    text.includes("assemblyprops:component-eplan") ||
    text.includes("scene:assemblyprops:component-eplan")
  );
}

function shouldQuarantine(panel, reason) {
  const text = safeString(reason);
  if (isStructureDetailReason(text)) return true;

  // Der Crashlog zeigte diesen Pfad direkt nach Eingaben im Detail-Editor:
  // assemblyprops:component-eplan:deviceTag -> scene:persist -> save:emit.
  // Außerhalb des Detail-Editors bleibt dieser Pfad erlaubt.
  if (isDetailEditWindow(panel) && isAssemblyComponentReason(text)) return true;

  return false;
}

function cancelAutosaveTimers(panel, reason = "structure-detail") {
  try {
    if (panel?._waAutosave?.timer) {
      clearTimeout(panel._waAutosave.timer);
      panel._waAutosave.timer = 0;
    }
    if (panel?._waAutosaveGuard?.idleTimer) {
      clearTimeout(panel._waAutosaveGuard.idleTimer);
      panel._waAutosaveGuard.idleTimer = 0;
    }
    if (panel?._waAutosaveGuard && shouldQuarantine(panel, panel._waAutosaveGuard.pendingReason)) {
      panel._waAutosaveGuard.pendingReason = null;
      panel._waAutosaveGuard.pendingCount = 0;
    }
    if (panel?._waAutosave && shouldQuarantine(panel, panel._waAutosave.lastReason)) {
      panel._waAutosave.lastReason = "workarea";
      panel._waAutosave.pendingAfterGesture = false;
    }
  } catch {}

  log(panel, "workarea:structure-detail-save:timers-cleared:v7", {
    reason: safeString(reason),
    guard: GUARD_ID
  });
}

function block(panel, event, reason, extra = {}) {
  const st = ensureState(panel);
  if (st) st.blocked = Number(st.blocked || 0) + 1;
  cancelAutosaveTimers(panel, reason);
  log(panel, event, {
    reason: safeString(reason),
    blocked: st?.blocked || 0,
    guard: GUARD_ID,
    ...extra
  });
}

function patchBus(panel) {
  const bus = panel?.bus;
  if (!bus || typeof bus.emit !== "function") return;
  if (bus.__structureDetailSaveQuarantineV7EmitWrapped) return;

  const previousEmit = bus.emit.bind(bus);
  bus.emit = function structureDetailSaveQuarantineBusEmitV7(type, payload = {}, ...rest) {
    try {
      if (type === "ui:project:save") {
        const reason = payload?.reason;
        if (shouldQuarantine(panel, reason)) {
          block(panel, "workarea:structure-detail-save:bus-blocked:v7", reason, { type });
          return;
        }
      }
    } catch {}
    return previousEmit(type, payload, ...rest);
  };

  bus.__structureDetailSaveQuarantineV7EmitWrapped = true;
}

function armEditor(panel, root) {
  patchBus(panel);

  const host = root?.matches?.(".wa-structure-detail-editor-host")
    ? root
    : root?.querySelector?.(".wa-structure-detail-editor-host");

  if (!host || host.__structureDetailSaveQuarantineV7Armed) return root;
  host.__structureDetailSaveQuarantineV7Armed = true;

  const mark = (ev) => {
    const tag = String(ev?.target?.tagName || "").toUpperCase();
    if (!["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
    markDetailEditing(panel, ev?.type || "editor-event");
    cancelAutosaveTimers(panel, "editor-event");
  };

  host.addEventListener("focusin", mark, true);
  host.addEventListener("input", mark, true);
  host.addEventListener("change", mark, true);
  host.addEventListener("keydown", mark, true);
  host.addEventListener("pointerdown", mark, true);
  host.addEventListener("touchstart", mark, true);
  host.addEventListener("blur", (ev) => {
    mark(ev);
    const st = ensureState(panel);
    if (st) {
      // Nicht sofort deaktivieren: blur/change erzeugt bei iOS oft noch
      // verzögerte Persist-/Save-Callbacks. Das Fenster bleibt kurz aktiv.
      st.lastEditAt = nowMs();
      window.setTimeout(() => {
        const state = ensureState(panel);
        if (state && nowMs() - Number(state.lastEditAt || 0) > 9000) state.active = false;
      }, 10000);
    }
  }, true);

  return root;
}

function wrapMethod(proto, name, wrapperFactory) {
  const current = proto?.[name];
  if (typeof current !== "function") return false;
  if (current[WRAP_FLAG]) return false;

  const wrapped = wrapperFactory(current);
  if (typeof wrapped !== "function") return false;
  wrapped[WRAP_FLAG] = true;
  wrapped.__previousStructureDetailSaveQuarantineV7 = current;
  proto[name] = wrapped;
  return true;
}

function installPatchPass(label = "pass") {
  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  let changed = false;

  changed = wrapMethod(proto, "mount", (original) => async function patchedMountSaveQuarantineV7(...args) {
    const result = await original.apply(this, args);
    patchBus(this);
    return result;
  }) || changed;

  changed = wrapMethod(proto, "_renderPropertiesPanel", (original) => function patchedRenderPropertiesPanelSaveQuarantineV7(...args) {
    const result = original.apply(this, args);
    return armEditor(this, result);
  }) || changed;

  changed = wrapMethod(proto, "_requestProjectSaveDebounced", (original) => function patchedRequestProjectSaveDebouncedSaveQuarantineV7(reason = "workarea", ...rest) {
    patchBus(this);
    if (shouldQuarantine(this, reason)) {
      block(this, "workarea:structure-detail-save:request-blocked:v7", reason);
      return;
    }
    return original.call(this, reason, ...rest);
  }) || changed;

  changed = wrapMethod(proto, "_persistSceneToStore", (original) => function patchedPersistSceneToStoreSaveQuarantineV7(reason = "scene", ...rest) {
    patchBus(this);
    if (shouldQuarantine(this, reason)) {
      block(this, "workarea:structure-detail-save:persist-blocked:v7", reason, {
        objects: Array.isArray(this?._scene?.objects) ? this._scene.objects.length : 0
      });
      return;
    }
    return original.call(this, reason, ...rest);
  }) || changed;

  changed = wrapMethod(proto, "_assemblyPropsPersistScene", (original) => function patchedAssemblyPropsPersistSceneSaveQuarantineV7(sceneObj, reason = "assemblyprops", ...rest) {
    patchBus(this);
    if (shouldQuarantine(this, reason)) {
      block(this, "workarea:structure-detail-save:assemblyprops-blocked:v7", reason, {
        objectId: safeString(sceneObj?.id, null)
      });
      return;
    }
    return original.call(this, sceneObj, reason, ...rest);
  }) || changed;

  if (changed) {
    try { console.info(`[${PATCH_ID}] installed ${label}`); } catch {}
    try { window.BP_CRASH_RECORDER?.log?.("workarea:structure-detail-save-quarantine:v7-installed", { label, guard: GUARD_ID }); } catch {}
  }

  return changed;
}

// v7.1: Keine delayed-Mehrfachinstallation mehr.
// Die alten Wiederholungen erzeugten auf iOS unnötige Listener-/Wrapper-Ketten.
installPatchPass("initial");

export {};
