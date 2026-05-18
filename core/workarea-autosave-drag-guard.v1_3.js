/**
 * core/workarea-autosave-drag-guard.js
 * Version: v1.3.0-hard-idle-cancel (2026-05-18)
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

const PATCH_FLAG = Symbol.for("baustellenplaner.workarea.autosaveDragGuard.v1.3");

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
      strictQuietMs: 2600
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

function clearAllSaveTimers(instance, source = "timer-clear") {
  try {
    const st = ensureGuardState(instance);
    let cleared = false;

    if (instance?._waAutosave?.timer) {
      try { clearTimeout(instance._waAutosave.timer); } catch {}
      instance._waAutosave.timer = 0;
      cleared = true;
    }

    if (st?.idleTimer) {
      try { clearTimeout(st.idleTimer); } catch {}
      st.idleTimer = 0;
      cleared = true;
    }

    if (cleared) {
      safeLog(instance, "workarea:save:timer-cancelled:pointerdown", {
        reason: instance?._waAutosave?.lastReason || st?.pendingReason || source,
        source,
        guard: "autosave-drag-guard-v1.3"
      });
    }
  } catch {}
}

function scheduleIdleSave(instance, reason = "workarea", delay = 1700, source = "idle") {
  const st = ensureGuardState(instance);
  if (!st || !instance?._waAutosave?.enabled || instance?._waAutosave?.suppress) return;

  st.pendingReason = String(reason || st.pendingReason || "workarea");
  st.pendingCount = (Number(st.pendingCount || 0) || 0) + 1;
  clearIdleTimer(instance);

  const quiet = Math.max(1800, Number(delay || st.strictQuietMs || 2600) || 2600);

  safeLog(instance, "workarea:save:idle-scheduled", {
    reason: st.pendingReason,
    delay: quiet,
    source,
    active: instance?._vp?.pointer?.active?.size || 0,
    dragActive: !!instance?._vp?.pointer?.dragActive,
    idleAge: Math.round(idleAge(instance)),
    pendingCount: st.pendingCount,
    guard: "autosave-drag-guard-v1.3"
  });

  st.idleTimer = setTimeout(() => {
    st.idleTimer = 0;

    const active = isGestureActive(instance);
    const age = idleAge(instance);
    const minQuiet = Math.max(1800, Number(st.strictQuietMs || 2600) || 2600);

    if (active || age < minQuiet) {
      safeLog(instance, "workarea:save:idle-deferred", {
        reason: st.pendingReason,
        active: instance?._vp?.pointer?.active?.size || 0,
        dragActive: !!instance?._vp?.pointer?.dragActive,
        idleAge: Math.round(age),
        minQuiet,
        guard: "autosave-drag-guard-v1.3"
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
      guard: "autosave-drag-guard-v1.3"
    });

    instance.bus.emit("ui:project:save", {
      source: "workarea",
      reason,
      ts: Date.now(),
      guard: "autosave-drag-guard-v1.3"
    });
  } catch (e) {
    safeLog(instance, "workarea:save:emit:error", {
      message: e?.message || String(e),
      stack: e?.stack || null,
      guard: "autosave-drag-guard-v1.3"
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
      delay: Number(st?.strictQuietMs || 2600),
      active: instance?._vp?.pointer?.active?.size || 0,
      guard: "autosave-drag-guard-v1.3",
      mode: "strict-idle"
    });

    clearAllSaveTimers(instance, "after-gesture-before-schedule");
    scheduleIdleSave(instance, instance._waAutosave.lastReason, Number(st?.strictQuietMs || 2600), "after-gesture");
  } catch (e) {
    safeLog(instance, "workarea:save:after-gesture:error", {
      message: e?.message || String(e),
      guard: "autosave-drag-guard-v1.3"
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
      this._waAutosave.gestureQuietMs = Math.max(1800, Number(this._waAutosave.gestureQuietMs || 2600) || 2600);
      this._waAutosave.pendingAfterGesture = !!this._waAutosave.pendingAfterGesture;
      this._waAutosave.deferCount = Number(this._waAutosave.deferCount || 0) || 0;
      this._waAutosave.lastReason = String(reason || "workarea");

      const st = ensureGuardState(this);
      const requestedDelay = Math.max(150, Number(options?.delay ?? this._waAutosave.debounceMs ?? 650) || 650);
      const minQuiet = Math.max(1800, Number(st?.strictQuietMs || this._waAutosave.gestureQuietMs || 2600) || 2600);
      const active = isGestureActive(this);
      const age = idleAge(this);

      safeLog(this, "workarea:save:scheduled", {
        reason: this._waAutosave.lastReason,
        delay: requestedDelay,
        gestureActive: active,
        idleAge: Math.round(age),
        minQuiet,
        fromGestureEnd: !!options?.fromGestureEnd,
        guard: "autosave-drag-guard-v1.3",
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
          guard: "autosave-drag-guard-v1.3"
        });

        if (this._waAutosave.timer) {
          try { clearTimeout(this._waAutosave.timer); } catch {}
          this._waAutosave.timer = 0;
        }
        if (active) {
          // Während einer laufenden Geste bewusst KEINEN Timer starten.
          // Der Timer wird erst im pointerup-Wrapper neu gesetzt. Dadurch kann
          // auf iOS/Safari kein Timer-Callback mitten in die Drag-Geste fallen.
          clearAllSaveTimers(this, "active-gesture-no-timer");
          return;
        }

        scheduleIdleSave(this, this._waAutosave.lastReason, minQuiet, "quiet-window");
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
            guard: "autosave-drag-guard-v1.3"
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
        guard: "autosave-drag-guard-v1.3"
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

      // Sobald eine neue Geste beginnt, dürfen alte Save-Timer GAR NICHT mehr
      // feuern. v1.2 löschte nur den normalen Debounce-Timer. Der Log zeigte
      // aber, dass ein Strict-Idle-Timer noch während der nächsten Drag-Geste
      // feuern konnte. v1.3 löscht daher beide Timer-Arten sofort.
      try {
        if (this?._waAutosave) this._waAutosave.pendingAfterGesture = true;
        clearAllSaveTimers(this, "viewport-pointerdown");
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
          guard: "autosave-drag-guard-v1.3"
        });
      }

      return result;
    };
  }

  // Zusätzliche globale Sicherung: Falls die Workarea-Handler durch iOS/Safari
  // oder Event-Reihenfolge einmal nicht greifen, werden Timer bereits im Capture-
  // Phase Event abgeräumt. Das ist absichtlich defensiv.
  try {
    if (!window.__BP_WORKAREA_AUTOSAVE_GUARD_GLOBAL_V13__) {
      window.__BP_WORKAREA_AUTOSAVE_GUARD_GLOBAL_V13__ = true;
      const cancelGlobalTimers = (ev) => {
        try {
          // Kein DOM-Scan nach Instanzen. Stattdessen nur global loggen; die
          // eigentliche Instanz-Cancel-Logik sitzt im Workarea-Prototype.
          window.BP_CRASH_RECORDER?.log?.("workarea:save:global-input", {
            type: ev?.type || "input",
            guard: "autosave-drag-guard-v1.3"
          });
        } catch {}
      };
      window.addEventListener("pointerdown", cancelGlobalTimers, true);
      window.addEventListener("touchstart", cancelGlobalTimers, true);
      window.addEventListener("mousedown", cancelGlobalTimers, true);
    }
  } catch {}

  proto[PATCH_FLAG] = true;

  try {
    window.BP_CRASH_RECORDER?.log?.("workarea:autosave-drag-guard:installed", {
      version: "v1.3",
      strategy: "hard-idle-cancel-prototype-patch"
    });
  } catch {}

  return true;
}
