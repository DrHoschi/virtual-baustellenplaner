/**
 * core/workarea-autosave-drag-guard.js
 * Version: v1.0.0 (2026-05-18)
 *
 * Zweck:
 * - Schützt iOS/Safari vor einem harten Reload, wenn Workarea-Autosave mitten
 *   während einer aktiven Touch-/Drag-/Pinch-Geste feuert.
 * - Der CrashLog zeigte genau dieses Muster:
 *   save:scheduled -> pointerdown/drag:start -> plötzlich app:init.
 *
 * Strategie:
 * - WorkareaPanel wird zur Laufzeit gepatcht, ohne die große WorkareaPanel.js
 *   zu überschreiben. Dadurch bleiben alle bisherigen Workarea-Patches erhalten.
 * - Save-Emit wird bei aktiver Geste verschoben.
 * - Nach pointerup/pointercancel und kurzer Ruhezeit wird der Save nachgeholt.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_FLAG = Symbol.for("baustellenplaner.workarea.autosaveDragGuard.v1");

function safeLog(instance, event, data = {}) {
  try {
    if (instance && typeof instance._crashLog === "function") {
      instance._crashLog(event, data);
      return;
    }
  } catch {}

  try {
    window.BP_CRASH_RECORDER?.log?.(event, data);
  } catch {}
}

function isGestureActive(instance) {
  try {
    const P = instance?._vp?.pointer;
    if (!P) return false;

    return !!(
      (P.active && P.active.size > 0) ||
      P.dragActive ||
      P.dragObjId ||
      P.isPanning ||
      P.pinchActive
    );
  } catch {
    return false;
  }
}

function emitProjectSaveNow(instance, reason = "workarea") {
  if (!instance?.bus?.emit) return;

  try {
    safeLog(instance, "workarea:save:emit", {
      reason,
      storeBytes: typeof instance._estimateStoreSnapshotBytes === "function" ? instance._estimateStoreSnapshotBytes() : 0,
      lastPersistBytes: instance?._crashDiag?.lastPersistBytes || 0,
      guard: "autosave-drag-guard-v1"
    });

    instance.bus.emit("ui:project:save", {
      source: "workarea",
      reason,
      ts: Date.now(),
      guard: "autosave-drag-guard-v1"
    });
  } catch (e) {
    safeLog(instance, "workarea:save:emit:error", {
      message: e?.message || String(e),
      stack: e?.stack || null,
      guard: "autosave-drag-guard-v1"
    });
  }
}

function requestAfterGesture(instance, reason = "gesture") {
  if (!instance?._waAutosave?.enabled) return;
  if (instance?._waAutosave?.suppress) return;

  const quiet = Math.max(350, Number(instance._waAutosave.gestureQuietMs || 950) || 950);
  const finalReason = instance._waAutosave.lastReason || String(reason || "gesture");

  try {
    if (instance._waAutosave.timer) clearTimeout(instance._waAutosave.timer);
    instance._waAutosave.timer = 0;
    instance._waAutosave.pendingAfterGesture = false;
    instance._waAutosave.lastReason = finalReason;

    safeLog(instance, "workarea:save:rescheduled-after-gesture", {
      reason: finalReason,
      delay: quiet,
      active: instance?._vp?.pointer?.active?.size || 0,
      guard: "autosave-drag-guard-v1"
    });

    instance._requestProjectSaveDebounced(finalReason, {
      delay: quiet,
      fromGestureEnd: true
    });
  } catch (e) {
    safeLog(instance, "workarea:save:after-gesture:error", {
      message: e?.message || String(e),
      guard: "autosave-drag-guard-v1"
    });
  }
}

export function installWorkareaAutosaveDragGuard() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto[PATCH_FLAG]) return false;

  const originalPointerUp = proto._onViewportPointerUp;

  proto._isWorkareaGestureActive = function _isWorkareaGestureActivePatched() {
    return isGestureActive(this);
  };

  proto._requestProjectSaveAfterGesture = function _requestProjectSaveAfterGesturePatched(reason = "gesture") {
    return requestAfterGesture(this, reason);
  };

  proto._emitProjectSaveNow = function _emitProjectSaveNowPatched(reason = "workarea") {
    return emitProjectSaveNow(this, reason);
  };

  proto._requestProjectSaveDebounced = function _requestProjectSaveDebouncedGuarded(reason = "workarea", options = {}) {
    if (!this?._waAutosave?.enabled) return;
    if (this?._waAutosave?.suppress) return;
    if (!this?.bus?.emit) return;

    try {
      // Felder ergänzen, falls die alte WorkareaPanel-Version sie noch nicht hat.
      this._waAutosave.gestureQuietMs = Math.max(350, Number(this._waAutosave.gestureQuietMs || 950) || 950);
      this._waAutosave.pendingAfterGesture = !!this._waAutosave.pendingAfterGesture;
      this._waAutosave.deferCount = Number(this._waAutosave.deferCount || 0) || 0;

      this._waAutosave.lastReason = String(reason || "workarea");
      if (this._waAutosave.timer) clearTimeout(this._waAutosave.timer);

      const delay = Math.max(150, Number(options?.delay ?? this._waAutosave.debounceMs ?? 650) || 650);
      safeLog(this, "workarea:save:scheduled", {
        reason: this._waAutosave.lastReason,
        delay,
        gestureActive: isGestureActive(this),
        fromGestureEnd: !!options?.fromGestureEnd,
        guard: "autosave-drag-guard-v1"
      });

      this._waAutosave.timer = setTimeout(() => {
        this._waAutosave.timer = 0;

        if (isGestureActive(this)) {
          this._waAutosave.pendingAfterGesture = true;
          this._waAutosave.deferCount = (Number(this._waAutosave.deferCount || 0) || 0) + 1;

          safeLog(this, "workarea:save:deferred:gesture", {
            reason: this._waAutosave.lastReason,
            active: this?._vp?.pointer?.active?.size || 0,
            dragActive: !!this?._vp?.pointer?.dragActive,
            dragObjId: this?._vp?.pointer?.dragObjId || null,
            pinchActive: !!this?._vp?.pointer?.pinchActive,
            deferCount: this._waAutosave.deferCount,
            guard: "autosave-drag-guard-v1"
          });
          return;
        }

        this._waAutosave.pendingAfterGesture = false;
        emitProjectSaveNow(this, this._waAutosave.lastReason);
      }, delay);
    } catch (e) {
      safeLog(this, "workarea:save:schedule:error", {
        message: e?.message || String(e),
        guard: "autosave-drag-guard-v1"
      });
    }
  };

  if (typeof originalPointerUp === "function") {
    proto._onViewportPointerUp = function _onViewportPointerUpAutosaveGuarded(ev) {
      const result = originalPointerUp.call(this, ev);

      try {
        const active = this?._vp?.pointer?.active?.size || 0;
        if (active === 0 && this?._waAutosave?.pendingAfterGesture) {
          requestAfterGesture(this, "pointerup");
        }
      } catch (e) {
        safeLog(this, "workarea:save:pointerup-guard:error", {
          message: e?.message || String(e),
          guard: "autosave-drag-guard-v1"
        });
      }

      return result;
    };
  }

  proto[PATCH_FLAG] = true;

  try {
    window.BP_CRASH_RECORDER?.log?.("workarea:autosave-drag-guard:installed", {
      version: "v1",
      strategy: "prototype-patch"
    });
  } catch {}

  return true;
}
