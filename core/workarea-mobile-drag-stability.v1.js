/**
 * core/workarea-mobile-drag-stability.v1.js
 * Version: v1.0.0-mobile-drag-stability (2026-05-18)
 *
 * Zweck:
 * - Stabilisiert die Workarea auf iPhone/iPad/Safari, wenn viele Objekte schnell
 *   hintereinander gezogen werden.
 * - Der CrashLog zeigte nach dem Autosave-Guard v1.3 weiterhin harte Reloads
 *   direkt während `drag:start` / `drag:move`, also ohne `save:emit`.
 *
 * Strategie:
 * - PointerMove auf requestAnimationFrame takten.
 * - Während aktiver Touch-/Drag-Geste keine teuren Right-Panel-Rebuilds.
 * - ResizeObserver während Drag/Pan/Pinch entprellen.
 * - Canvas-Rendering während Drag auf ca. 30 FPS begrenzen.
 * - Nach Drag-End kurz warten, dann final rendern und Properties nachziehen.
 *
 * Wichtig:
 * - Die große WorkareaPanel.js wird NICHT überschrieben.
 * - Diese Datei patcht nur zur Laufzeit die Prototype-Methoden.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_FLAG = Symbol.for("baustellenplaner.workarea.mobileDragStability.v1");
const GUARD = "mobile-drag-stability-v1";

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function safeLog(instance, event, data = {}) {
  try {
    if (instance && typeof instance._crashLog === "function") {
      instance._crashLog(event, { ...(data || {}), guard: GUARD });
      return;
    }
  } catch {}
  try {
    window.BP_CRASH_RECORDER?.log?.(event, { ...(data || {}), guard: GUARD });
  } catch {}
}

function isMobileLike() {
  try {
    if (window.matchMedia?.("(max-width: 700px)")?.matches) return true;
    if (window.matchMedia?.("(pointer: coarse)")?.matches) return true;
  } catch {}
  try {
    return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}

function isGestureActive(instance) {
  try {
    const P = instance?._vp?.pointer;
    return !!(
      (P?.active && P.active.size > 0) ||
      P?.dragActive ||
      P?.dragObjId ||
      P?.isPanning ||
      P?.pinchActive
    );
  } catch {
    return false;
  }
}

function isDragLike(instance) {
  try {
    const P = instance?._vp?.pointer;
    return !!(P?.dragActive || P?.dragObjId || P?.isPanning || P?.pinchActive);
  } catch {
    return false;
  }
}

function ensureState(instance) {
  if (!instance) return null;
  if (!instance._waMobileDragStability) {
    instance._waMobileDragStability = {
      enabled: isMobileLike(),
      moveRaf: 0,
      pendingMove: null,
      pendingRightPanel: false,
      rightPanelTimer: 0,
      resizeTimer: 0,
      finalRenderTimer: 0,
      lastRenderAt: 0,
      skippedRenders: 0,
      moveIn: 0,
      moveRafRuns: 0,
      installedAt: new Date().toISOString()
    };
  }
  return instance._waMobileDragStability;
}

function clonePointerEvent(ev) {
  return {
    pointerId: ev?.pointerId,
    clientX: ev?.clientX,
    clientY: ev?.clientY,
    pageX: ev?.pageX,
    pageY: ev?.pageY,
    screenX: ev?.screenX,
    screenY: ev?.screenY,
    button: ev?.button,
    buttons: ev?.buttons,
    pointerType: ev?.pointerType,
    altKey: !!ev?.altKey,
    ctrlKey: !!ev?.ctrlKey,
    metaKey: !!ev?.metaKey,
    shiftKey: !!ev?.shiftKey,
    preventDefault() {},
    stopPropagation() {}
  };
}

function flushMove(instance, originalMove) {
  const st = ensureState(instance);
  if (!st?.pendingMove) return;
  const ev = st.pendingMove;
  st.pendingMove = null;
  st.moveRaf = 0;
  st.moveRafRuns += 1;
  try {
    originalMove.call(instance, ev);
  } catch (e) {
    safeLog(instance, "workarea:mobile-drag:move-flush-error", { message: e?.message || String(e) });
    throw e;
  }
}

function scheduleRightPanelFlush(instance, originalRenderRightPanel, delay = 420, source = "schedule") {
  const st = ensureState(instance);
  if (!st) return;
  st.pendingRightPanel = true;
  if (st.rightPanelTimer) {
    try { clearTimeout(st.rightPanelTimer); } catch {}
    st.rightPanelTimer = 0;
  }
  st.rightPanelTimer = setTimeout(() => {
    st.rightPanelTimer = 0;
    if (!st.pendingRightPanel) return;
    if (isGestureActive(instance)) {
      scheduleRightPanelFlush(instance, originalRenderRightPanel, 520, "still-active");
      return;
    }
    st.pendingRightPanel = false;
    safeLog(instance, "workarea:mobile-drag:right-panel-flush", { source });
    try { originalRenderRightPanel.call(instance); } catch (e) { console.error("[workarea] right panel flush failed", e); }
  }, Math.max(120, delay));
}

export function installWorkareaMobileDragStability() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto[PATCH_FLAG]) return false;
  proto[PATCH_FLAG] = true;

  const originalMove = proto._onViewportPointerMove;
  const originalDown = proto._onViewportPointerDown;
  const originalUp = proto._onViewportPointerUp;
  const originalResize = proto._resizeViewportCanvas;
  const originalRender2D = proto._renderViewport2D;
  const originalRenderRightPanel = proto._renderRightPanel;

  if (typeof originalMove !== "function" || typeof originalDown !== "function" || typeof originalUp !== "function") {
    try { window.BP_CRASH_RECORDER?.log?.("workarea:mobile-drag-stability:missing-methods", { guard: GUARD }); } catch {}
    return false;
  }

  proto._onViewportPointerDown = function patchedPointerDown(ev) {
    const st = ensureState(this);
    if (st?.enabled) {
      st.moveIn = 0;
      st.moveRafRuns = 0;
      st.pendingMove = null;
      if (st.moveRaf) {
        try { cancelAnimationFrame(st.moveRaf); } catch {}
        st.moveRaf = 0;
      }
      if (st.finalRenderTimer) {
        try { clearTimeout(st.finalRenderTimer); } catch {}
        st.finalRenderTimer = 0;
      }
      safeLog(this, "workarea:mobile-drag:pointerdown", { pointerId: ev?.pointerId });
    }
    return originalDown.call(this, ev);
  };

  proto._onViewportPointerMove = function patchedPointerMove(ev) {
    const st = ensureState(this);
    if (!st?.enabled) return originalMove.call(this, ev);

    try { ev?.preventDefault?.(); } catch {}

    st.moveIn += 1;
    st.pendingMove = clonePointerEvent(ev);

    if (st.moveRaf) return;

    st.moveRaf = requestAnimationFrame(() => {
      flushMove(this, originalMove);
      if (st.moveIn > 0 && st.moveIn % 40 === 0) {
        safeLog(this, "workarea:mobile-drag:move-throttled", {
          moveIn: st.moveIn,
          moveRafRuns: st.moveRafRuns,
          dragActive: !!this._vp?.pointer?.dragActive,
          dragObjId: this._vp?.pointer?.dragObjId || null
        });
      }
    });
  };

  proto._onViewportPointerUp = function patchedPointerUp(ev) {
    const st = ensureState(this);
    if (st?.enabled && st.pendingMove) {
      if (st.moveRaf) {
        try { cancelAnimationFrame(st.moveRaf); } catch {}
        st.moveRaf = 0;
      }
      flushMove(this, originalMove);
    }

    const out = originalUp.call(this, ev);

    if (st?.enabled) {
      safeLog(this, "workarea:mobile-drag:pointerup", {
        pointerId: ev?.pointerId,
        moveIn: st.moveIn,
        moveRafRuns: st.moveRafRuns,
        skippedRenders: st.skippedRenders
      });

      if (st.finalRenderTimer) {
        try { clearTimeout(st.finalRenderTimer); } catch {}
      }
      st.finalRenderTimer = setTimeout(() => {
        st.finalRenderTimer = 0;
        try { originalRender2D?.call(this, 0); } catch {}
        if (st.pendingRightPanel) scheduleRightPanelFlush(this, originalRenderRightPanel, 50, "pointerup-final");
        safeLog(this, "workarea:mobile-drag:final-render", { moveIn: st.moveIn, moveRafRuns: st.moveRafRuns });
      }, 360);
    }

    return out;
  };

  if (typeof originalResize === "function") {
    proto._resizeViewportCanvas = function patchedResizeViewportCanvas(...args) {
      const st = ensureState(this);
      if (st?.enabled && isDragLike(this)) {
        if (st.resizeTimer) {
          try { clearTimeout(st.resizeTimer); } catch {}
        }
        st.resizeTimer = setTimeout(() => {
          st.resizeTimer = 0;
          if (isDragLike(this)) {
            try { this._resizeViewportCanvas?.(...args); } catch {}
            return;
          }
          safeLog(this, "workarea:mobile-drag:resize-flush", {});
          originalResize.apply(this, args);
        }, 520);
        safeLog(this, "workarea:mobile-drag:resize-deferred", {});
        return;
      }
      return originalResize.apply(this, args);
    };
  }

  if (typeof originalRender2D === "function") {
    proto._renderViewport2D = function patchedRenderViewport2D(dt) {
      const st = ensureState(this);
      if (st?.enabled && isDragLike(this)) {
        const t = nowMs();
        const minFrameMs = 33; // ca. 30 FPS während Drag/Pan/Pinch
        if (st.lastRenderAt && t - st.lastRenderAt < minFrameMs) {
          st.skippedRenders += 1;
          return;
        }
        st.lastRenderAt = t;
      }
      return originalRender2D.call(this, dt);
    };
  }

  if (typeof originalRenderRightPanel === "function") {
    proto._renderRightPanel = function patchedRenderRightPanel(...args) {
      const st = ensureState(this);
      if (st?.enabled && isGestureActive(this)) {
        st.pendingRightPanel = true;
        scheduleRightPanelFlush(this, originalRenderRightPanel, 520, "gesture-active");
        safeLog(this, "workarea:mobile-drag:right-panel-deferred", {
          dragActive: !!this._vp?.pointer?.dragActive,
          dragObjId: this._vp?.pointer?.dragObjId || null
        });
        return;
      }
      return originalRenderRightPanel.apply(this, args);
    };
  }

  try {
    window.BP_CRASH_RECORDER?.log?.("workarea:mobile-drag-stability:installed", {
      version: "v1",
      strategy: "raf-move-rightpanel-resize-render-throttle",
      mobile: isMobileLike(),
      guard: GUARD
    });
  } catch {}

  return true;
}
