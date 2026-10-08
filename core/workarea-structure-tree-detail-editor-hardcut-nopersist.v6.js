/**
 * core/workarea-structure-tree-detail-editor-hardcut-nopersist.v6.js
 * Version: PATCH_workarea_structure_tree_detail_editor_hardcut_nopersist_v6 (2026-05-21)
 *
 * ZIEL / NOTFALL-STABILISIERUNG:
 * Nach v5 zeigt der Crashlog weiterhin Neustarts kurz nach:
 *   workarea:scene:persist { reason: "structure-detail:memory-only:v5" }
 *
 * Daraus folgt: Nicht nur der Projekt-Save, sondern bereits _persistSceneToStore()
 * ist auf iPhone/Safari beim Tippen zu schwer. Diese Datei ist deshalb ein
 * harter Stabilitäts-Schnitt:
 *
 * - Strukturbaum-Detail-Eingaben dürfen die laufende Workarea-Scene im Speicher
 *   ändern.
 * - Sie dürfen aber KEIN store.update(), KEIN cb:scene:changed und KEINEN
 *   ui:project:save auslösen.
 * - Normale Workarea-Saves außerhalb des Struktur-Detail-Editors bleiben erhalten.
 * - Zusätzlich wird ein Mobile-Resize-Ausreißer h <= 40 px geblockt, weil im
 *   Crashlog ein Canvas-Resize auf h:1 sichtbar war.
 *
 * LADEREIHENFOLGE:
 * - NACH workarea-structure-tree-detail-editor-stability-clean.v5.js
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_structure_tree_detail_editor_hardcut_nopersist_v6";

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function isStructureDetailReason(reason) {
  const text = safeString(reason);
  return text.includes("structure-detail") || text.includes("structure-tree-detail");
}

function isMobileLike(panel) {
  try {
    const lm = panel?._detectWorkareaLayoutMode?.();
    if (lm?.mode === "mobile" || lm?.mode === "tablet") return true;
  } catch {}

  try {
    const ua = String(navigator?.userAgent || "");
    const touch = Number(navigator?.maxTouchPoints || 0) || 0;
    const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
    return /iPhone|iPad|iPod|Android/i.test(ua) || touch > 1 || coarse;
  } catch {
    return true;
  }
}

function installPatch() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto.__workareaStructureDetailHardcutNoPersistV6Installed) return;
  proto.__workareaStructureDetailHardcutNoPersistV6Installed = true;

  const previousRequestSave = proto._requestProjectSaveDebounced;
  proto._requestProjectSaveDebounced = function patchedRequestProjectSaveDebouncedHardcutV6(reason = "workarea", ...rest) {
    if (isStructureDetailReason(reason)) {
      try {
        this._crashLog?.("workarea:structure-detail-save:hard-blocked:v6", {
          reason: safeString(reason),
          guard: "structure-detail-hardcut-nopersist-v6"
        });
      } catch {}
      return;
    }

    return previousRequestSave?.call(this, reason, ...rest);
  };

  const previousPersistScene = proto._persistSceneToStore;
  proto._persistSceneToStore = function patchedPersistSceneToStoreHardcutV6(reason = "scene", ...rest) {
    if (isStructureDetailReason(reason)) {
      try {
        // WICHTIG: absichtlich KEIN previousPersistScene() aufrufen.
        // previousPersistScene() macht store.update() + cb:scene:changed + AutoSave.
        // Genau dieser Pfad löst aktuell auf iPhone/Safari die Instabilität aus.
        this._crashLog?.("workarea:scene:persist:hard-blocked:v6", {
          reason: safeString(reason),
          objects: Array.isArray(this?._scene?.objects) ? this._scene.objects.length : 0,
          guard: "structure-detail-hardcut-nopersist-v6"
        });
      } catch {}
      return;
    }

    return previousPersistScene?.call(this, reason, ...rest);
  };

  const previousShouldResize = proto._shouldDeferOrIgnoreViewportResize;
  if (typeof previousShouldResize === "function") {
    proto._shouldDeferOrIgnoreViewportResize = function patchedShouldDeferOrIgnoreViewportResizeV6(nextSize, reason = "resize", opts = {}) {
      try {
        const h = Number(nextSize?.h || 0);
        const w = Number(nextSize?.w || 0);
        const forceMount = !!opts?.force && String(reason || "").includes("mount:init");

        // Im Crashlog war ein echter angewendeter Resize auf h:1 sichtbar.
        // Das ist kein brauchbarer Canvas-Zustand und darf mobil nie angewendet werden.
        if (isMobileLike(this) && !forceMount && w > 0 && h > 0 && h <= 40) {
          this._crashLog?.("workarea:viewport:resize:blocked-tiny-height:v6", {
            reason: safeString(reason),
            w,
            h,
            force: !!opts?.force,
            finalSync: !!opts?.finalSync,
            guard: "structure-detail-hardcut-nopersist-v6"
          });
          return { action: "ignore", why: "mobile-tiny-height-hard-block-v6" };
        }
      } catch {}

      return previousShouldResize.call(this, nextSize, reason, opts);
    };
  }

  console.info(`[${PATCH_ID}] installed`);
}

installPatch();

export {};
