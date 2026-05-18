/**
 * core/workarea-autosave-drag-guard.js
 * Version: v1.2.0-strict-idle (2026-05-18)
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

const PATCH_FLAG = Symbol.for("baustellenplaner.workarea.autosaveDragGuard.v1.2");

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

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function ensureGuardState(instance) {
  if (!instance) return null;
  if (!instance._waAutosaveGuard) {
    instance._waAutosaveGuard = {
      lastPointerDownAt: 0,
      lastPointerUpAt: 0,
      lastGestureAt: 0,
      idleTimer: 0,
      pendingReason: null,
      pendingCount: 0,
      strictQuietMs: 1700
    };
  }
  return instance._waAutosaveGuard;
}

function idleAge(instance) {
  const st = ensureGuardState(instance);
  if (!st) return Infinity;
  const last = Math.max(Number(st.lastPointerDownAt || 0), Number(st.lastPointerUpAt || 0), Number(st.lastGestureAt || 0));
  if (!last) return Infinity;
  return nowMs() - last;
}

function clearIdleTimer(instance) {
  const st = ensureGuardState(instance);
  if (st?.idleTimer) {
    try { clearTimeout(st.idleTimer); } catch {}
    st.idleTimer = 0;
  }
}

function scheduleIdleSave(instance, reason = "workarea", delay = 1700, source = "idle") {
  const st = ensureGuardState(instance);
  if (!st || !instance?._waAutosave?.enabled || instance?._waAutosave?.suppress) return;

  st.pendingReason = String(reason || st.pendingReason || "workarea");
  st.pendingCount = (Number(st.pendingCount || 0) || 0) + 1;
  clearIdleTimer(instance);

  const quiet = Math.max(1200, Number(delay || st.strictQuietMs || 1700) || 1700);

  safeLog(instance, "workarea:save:idle-scheduled", {
    reason: st.pendingReason,
    delay: quiet,
    source,
    active: instance?._vp?.pointer?.active?.size || 0,
    dragActive: !!instance?._vp?.pointer?.dragActive,
    idleAge: Math.round(idleAge(instance)),
    pendingCount: st.pendingCount,
    guard: "autosave-drag-guard-v1.2"
  });

  st.idleTimer = setTimeout(() => {
    st.idleTimer = 0;

    const active = isGestureActive(instance);
    const age = idleAge(instance);
    const minQuiet = Math.max(1200, Number(st.strictQuietMs || 1700) || 1700);

    if (active || age < minQuiet) {
      safeLog(instance, "workarea:save:idle-deferred", {
        reason: st.pendingReason,
        active: instance?._vp?.pointer?.active?.size || 0,
        dragActive: !!instance?._vp?.pointer?.dragActive,
        idleAge: Math.round(age),
        minQuiet,
        guard: "autosave-drag-guard-v1.2"
      });
      scheduleIdleSave(instance, st.pendingReason, minQuiet, "idle-deferred");
      return;
    }

    const finalReason = st.pendingReason || reason || "workarea";
    st.pendingReason = null;
    st.pendingCount = 0;
    emitProjectSaveNow(instance, finalReason);
  }, quiet);
}

function emitProjectSaveNow(instance, reason = "workarea") {
  if (!instance?.bus?.emit) return;

  try {
    safeLog(instance, "workarea:save:emit", {
      reason,
      storeBytes: typeof instance._estimateStoreSnapshotBytes === "function" ? instance._estimateStoreSnapshotBytes() : 0,
      lastPersistBytes: instance?._crashDiag?.lastPersistBytes || 0,
      guard: "autosave-drag-guard-v1.2"
    });

    instance.bus.emit("ui:project:save", {
      source: "workarea",
      reason,
      ts: Date.now(),
      guard: "autosave-drag-guard-v1.2"
    });
  } catch (e) {
    safeLog(instance, "workarea:save:emit:error", {
      message: e?.message || String(e),
      stack: e?.stack || null,
      guard: "autosave-drag-guard-v1.2"
    });
  }
}

function requestAfterGesture(instance, reason = "gesture") {
  if (!instance?._waAutosave?.enabled) return;
  if (instance?._waAutosave?.suppress) return;

  const st = ensureGuardState(instance);
  if (st) st.lastGestureAt = nowMs();

  try {
    if (instance._waAutosave.timer) clearTimeout(instance._waAutosave.timer);
    instance._waAutosave.timer = 0;
    instance._waAutosave.pendingAfterGesture = false;
    instance._waAutosave.lastReason = instance._waAutosave.lastReason || String(reason || "gesture");

    safeLog(instance, "workarea:save:rescheduled-after-gesture", {
      reason: instance._waAutosave.lastReason,
      delay: Number(st?.strictQuietMs || 1700),
      active: instance?._vp?.pointer?.active?.size || 0,
      guard: "autosave-drag-guard-v1.2",
      mode: "strict-idle"
    });

    scheduleIdleSave(instance, instance._waAutosave.lastReason, Number(st?.strictQuietMs || 1700), "after-gesture");
  } catch (e) {
    safeLog(instance, "workarea:save:after-gesture:error", {
      message: e?.message || String(e),
      guard: "autosave-drag-guard-v1.2"
    });
  }
}


export function installWorkareaAutosaveDragGuard() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto[PATCH_FLAG]) return false;

  const originalPointerDown = proto._onViewportPointerDown;
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
      this._waAutosave.gestureQuietMs = Math.max(1200, Number(this._waAutosave.gestureQuietMs || 1700) || 1700);
      this._waAutosave.pendingAfterGesture = !!this._waAutosave.pendingAfterGesture;
      this._waAutosave.deferCount = Number(this._waAutosave.deferCount || 0) || 0;
      this._waAutosave.lastReason = String(reason || "workarea");

      const st = ensureGuardState(this);
      const requestedDelay = Math.max(150, Number(options?.delay ?? this._waAutosave.debounceMs ?? 650) || 650);
      const minQuiet = Math.max(1200, Number(st?.strictQuietMs || this._waAutosave.gestureQuietMs || 1700) || 1700);
      const active = isGestureActive(this);
      const age = idleAge(this);

      safeLog(this, "workarea:save:scheduled", {
        reason: this._waAutosave.lastReason,
        delay: requestedDelay,
        gestureActive: active,
        idleAge: Math.round(age),
        minQuiet,
        fromGestureEnd: !!options?.fromGestureEnd,
        guard: "autosave-drag-guard-v1.2",
        mode: "strict-idle"
      });

      // Der entscheidende Unterschied zu v1:
      // Bei aktiver Geste ODER in der kurzen Ruhezeit nach einer Geste wird
      // KEIN normaler Save-Timer gestartet. Stattdessen gibt es nur einen
      // Strict-Idle-Timer. Damit kann kein Save mitten in die nächste Touch-
      // Geste hineinfeuern.
      if (active || age < minQuiet || options?.fromGestureEnd) {
        this._waAutosave.pendingAfterGesture = true;
        this._waAutosave.deferCount = (Number(this._waAutosave.deferCount || 0) || 0) + 1;

        safeLog(this, "workarea:save:deferred:strict-idle", {
          reason: this._waAutosave.lastReason,
          active: this?._vp?.pointer?.active?.size || 0,
          dragActive: !!this?._vp?.pointer?.dragActive,
          dragObjId: this?._vp?.pointer?.dragObjId || null,
          pinchActive: !!this?._vp?.pointer?.pinchActive,
          idleAge: Math.round(age),
          minQuiet,
          deferCount: this._waAutosave.deferCount,
          guard: "autosave-drag-guard-v1.2"
        });

        if (this._waAutosave.timer) {
          try { clearTimeout(this._waAutosave.timer); } catch {}
          this._waAutosave.timer = 0;
        }
        scheduleIdleSave(this, this._waAutosave.lastReason, minQuiet, active ? "active-gesture" : "quiet-window");
        return;
      }

      if (this._waAutosave.timer) clearTimeout(this._waAutosave.timer);
      this._waAutosave.timer = setTimeout(() => {
        this._waAutosave.timer = 0;

        if (isGestureActive(this) || idleAge(this) < minQuiet) {
          this._waAutosave.pendingAfterGesture = true;
          this._waAutosave.deferCount = (Number(this._waAutosave.deferCount || 0) || 0) + 1;
          safeLog(this, "workarea:save:deferred:gesture", {
            reason: this._waAutosave.lastReason,
            active: this?._vp?.pointer?.active?.size || 0,
            dragActive: !!this?._vp?.pointer?.dragActive,
            dragObjId: this?._vp?.pointer?.dragObjId || null,
            pinchActive: !!this?._vp?.pointer?.pinchActive,
            idleAge: Math.round(idleAge(this)),
            minQuiet,
            deferCount: this._waAutosave.deferCount,
            guard: "autosave-drag-guard-v1.2"
          });
          scheduleIdleSave(this, this._waAutosave.lastReason, minQuiet, "timer-gesture");
          return;
        }

        this._waAutosave.pendingAfterGesture = false;
        emitProjectSaveNow(this, this._waAutosave.lastReason);
      }, requestedDelay);
    } catch (e) {
      safeLog(this, "workarea:save:schedule:error", {
        message: e?.message || String(e),
        guard: "autosave-drag-guard-v1.2"
      });
    }
  };


  if (typeof originalPointerDown === "function") {
    proto._onViewportPointerDown = function _onViewportPointerDownAutosaveGuarded(ev) {
      const st = ensureGuardState(this);
      if (st) {
        st.lastPointerDownAt = nowMs();
        st.lastGestureAt = st.lastPointerDownAt;
      }

      // Sobald eine neue Geste beginnt, dürfen alte normale Save-Timer nicht
      // mehr feuern. Der Pending-Save wird danach als Idle-Save neu geplant.
      try {
        if (this?._waAutosave?.timer) {
          clearTimeout(this._waAutosave.timer);
          this._waAutosave.timer = 0;
          this._waAutosave.pendingAfterGesture = true;
          safeLog(this, "workarea:save:timer-cancelled:pointerdown", {
            reason: this?._waAutosave?.lastReason || "pointerdown",
            guard: "autosave-drag-guard-v1.2"
          });
        }
      } catch {}

      return originalPointerDown.call(this, ev);
    };
  }

  if (typeof originalPointerUp === "function") {
    proto._onViewportPointerUp = function _onViewportPointerUpAutosaveGuarded(ev) {
      const result = originalPointerUp.call(this, ev);

      try {
        const st = ensureGuardState(this);
        if (st) {
          st.lastPointerUpAt = nowMs();
          st.lastGestureAt = st.lastPointerUpAt;
        }

        const active = this?._vp?.pointer?.active?.size || 0;
        if (active === 0 && this?._waAutosave?.pendingAfterGesture) {
          requestAfterGesture(this, "pointerup");
        }
      } catch (e) {
        safeLog(this, "workarea:save:pointerup-guard:error", {
          message: e?.message || String(e),
          guard: "autosave-drag-guard-v1.2"
        });
      }

      return result;
    };
  }

  proto[PATCH_FLAG] = true;

  try {
    window.BP_CRASH_RECORDER?.log?.("workarea:autosave-drag-guard:installed", {
      version: "v1.2",
      strategy: "strict-idle-prototype-patch"
    });
  } catch {}

  return true;
}
