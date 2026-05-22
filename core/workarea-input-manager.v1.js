/**
 * core/workarea-input-manager.v1.js
 * Version: PATCH_workarea_hardcut_save_input_v1 (2026-05-22)
 *
 * ZIEL
 * ============================================================================
 * Ein zentraler Input-/Render-Guard für die Workarea.
 *
 * Keine Mobile-/Desktop-Sonderarchitektur:
 * - Der Manager wird auf allen Geräten installiert.
 * - Er drosselt nur dann, wenn tatsächlich eine Geste/Drag aktiv ist.
 *
 * Aufgaben:
 * - PointerMove per requestAnimationFrame bündeln.
 * - Während Drag/Pan/Pinch keine Resize-Neuberechnung.
 * - Während Drag/Pan/Pinch RightPanel-Render verzögern.
 * - Viewport-Render während Drag auf ca. 24 FPS begrenzen.
 * - Nach Drag-Ende final rendern.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_hardcut_save_input_v1";
const GUARD_ID = "workarea-input-manager-v1";
const WRAP_FLAG = Symbol.for("baustellenplaner.workareaInputManager.v1.wrapper");

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function log(instance, event, data = {}) {
  try {
    if (instance && typeof instance._crashLog === "function") {
      instance._crashLog(event, { ...(data || {}), guard: GUARD_ID });
      return;
    }
  } catch {}
  try { window.BP_CRASH_RECORDER?.log?.(event, { ...(data || {}), guard: GUARD_ID }); } catch {}
}

function getPointer(instance) {
  try { return instance?._vp?.pointer || null; } catch { return null; }
}

function isGestureActive(instance) {
  const p = getPointer(instance);
  try {
    return !!(
      (p?.active && p.active.size > 0) ||
      p?.dragActive ||
      p?.dragObjId ||
      p?.isPanning ||
      p?.pinchActive
    );
  } catch {
    return false;
  }
}

function isDragLike(instance) {
  const p = getPointer(instance);
  try { return !!(p?.dragActive || p?.dragObjId || p?.isPanning || p?.pinchActive); }
  catch { return false; }
}

function ensureState(instance) {
  if (!instance) return null;
  if (!instance.__bpWorkareaInputManagerV1) {
    instance.__bpWorkareaInputManagerV1 = {
      moveRaf: 0,
      pendingMove: null,
      resizeTimer: 0,
      finalRenderTimer: 0,
      rightPanelTimer: 0,
      pendingRightPanel: false,
      lastRenderAt: 0,
      skippedRenders: 0,
      moveIn: 0,
      moveRafRuns: 0,
      gestureStartedAt: 0,
      installedAt: new Date().toISOString()
    };
  }
  return instance.__bpWorkareaInputManagerV1;
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
  originalMove.call(instance, ev);
}

function scheduleRightPanelFlush(instance, originalRenderRightPanel, delay = 480, source = "schedule") {
  const st = ensureState(instance);
  if (!st || typeof originalRenderRightPanel !== "function") return;

  st.pendingRightPanel = true;
  if (st.rightPanelTimer) {
    try { clearTimeout(st.rightPanelTimer); } catch {}
    st.rightPanelTimer = 0;
  }

  st.rightPanelTimer = window.setTimeout(() => {
    st.rightPanelTimer = 0;
    if (!st.pendingRightPanel) return;
    if (isGestureActive(instance)) {
      scheduleRightPanelFlush(instance, originalRenderRightPanel, 520, "still-active");
      return;
    }

    st.pendingRightPanel = false;
    log(instance, "workarea:input:right-panel-flush:v1", { source });
    try { originalRenderRightPanel.call(instance); } catch (e) {
      log(instance, "workarea:input:right-panel-error:v1", { message: e?.message || String(e) });
    }
  }, Math.max(120, delay));
}

function wrapMethod(proto, name, wrapperFactory) {
  const current = proto?.[name];
  if (typeof current !== "function") return false;
  if (current[WRAP_FLAG]) return false;

  const wrapped = wrapperFactory(current);
  if (typeof wrapped !== "function") return false;
  wrapped[WRAP_FLAG] = true;
  wrapped.__previousWorkareaInputManagerV1 = current;
  proto[name] = wrapped;
  return true;
}

function install() {
  if (window.__BP_WORKAREA_INPUT_MANAGER_V1_INSTALLED) return false;
  window.__BP_WORKAREA_INPUT_MANAGER_V1_INSTALLED = true;

  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  const originalMove = proto._onViewportPointerMove;
  const originalRender2D = proto._renderViewport2D;
  const originalRenderRightPanel = proto._renderRightPanel;
  const originalResize = proto._resizeViewportCanvas;

  wrapMethod(proto, "mount", (original) => async function patchedMountInputManagerV1(...args) {
    const result = await original.apply(this, args);
    try { window.__BP_WORKAREA_ACTIVE_PANEL__ = this; } catch {}
    ensureState(this);
    log(this, "workarea:input-manager:mount:v1", {});
    return result;
  });

  wrapMethod(proto, "_onViewportPointerDown", (original) => function patchedPointerDownInputManagerV1(ev, ...rest) {
    const st = ensureState(this);
    if (st) {
      st.moveIn = 0;
      st.moveRafRuns = 0;
      st.pendingMove = null;
      st.gestureStartedAt = nowMs();
      if (st.moveRaf) {
        try { cancelAnimationFrame(st.moveRaf); } catch {}
        st.moveRaf = 0;
      }
      if (st.finalRenderTimer) {
        try { clearTimeout(st.finalRenderTimer); } catch {}
        st.finalRenderTimer = 0;
      }
    }
    try { window.__BP_WORKAREA_ACTIVE_PANEL__ = this; } catch {}
    log(this, "workarea:input:pointerdown:v1", { pointerId: ev?.pointerId });
    return original.call(this, ev, ...rest);
  });

  if (typeof originalMove === "function") {
    wrapMethod(proto, "_onViewportPointerMove", () => function patchedPointerMoveInputManagerV1(ev) {
      const st = ensureState(this);
      if (!st) return originalMove.call(this, ev);

      try { ev?.preventDefault?.(); } catch {}
      st.moveIn += 1;
      st.pendingMove = clonePointerEvent(ev);

      if (st.moveRaf) return;

      st.moveRaf = requestAnimationFrame(() => {
        try {
          flushMove(this, originalMove);
          if (st.moveIn > 0 && st.moveIn % 60 === 0) {
            log(this, "workarea:input:move-throttled:v1", {
              moveIn: st.moveIn,
              moveRafRuns: st.moveRafRuns,
              dragActive: !!getPointer(this)?.dragActive,
              dragObjId: getPointer(this)?.dragObjId || null
            });
          }
        } catch (e) {
          log(this, "workarea:input:move-error:v1", { message: e?.message || String(e) });
          throw e;
        }
      });
    });
  }

  wrapMethod(proto, "_onViewportPointerUp", (original) => function patchedPointerUpInputManagerV1(ev, ...rest) {
    const st = ensureState(this);

    if (st?.pendingMove && typeof originalMove === "function") {
      if (st.moveRaf) {
        try { cancelAnimationFrame(st.moveRaf); } catch {}
        st.moveRaf = 0;
      }
      try { flushMove(this, originalMove); } catch {}
    }

    const result = original.call(this, ev, ...rest);

    if (st) {
      log(this, "workarea:input:pointerup:v1", {
        pointerId: ev?.pointerId,
        moveIn: st.moveIn,
        moveRafRuns: st.moveRafRuns,
        skippedRenders: st.skippedRenders
      });

      if (st.finalRenderTimer) {
        try { clearTimeout(st.finalRenderTimer); } catch {}
      }

      st.finalRenderTimer = window.setTimeout(() => {
        st.finalRenderTimer = 0;
        try { originalRender2D?.call(this, 0); } catch {}
        if (st.pendingRightPanel) scheduleRightPanelFlush(this, originalRenderRightPanel, 50, "pointerup-final");
        log(this, "workarea:input:final-render:v1", {
          moveIn: st.moveIn,
          moveRafRuns: st.moveRafRuns,
          skippedRenders: st.skippedRenders
        });
      }, 180);
    }

    return result;
  });

  if (typeof originalResize === "function") {
    wrapMethod(proto, "_resizeViewportCanvas", () => function patchedResizeViewportCanvasInputManagerV1(...args) {
      const st = ensureState(this);
      if (st && isGestureActive(this)) {
        if (st.resizeTimer) {
          try { clearTimeout(st.resizeTimer); } catch {}
        }

        st.resizeTimer = window.setTimeout(() => {
          st.resizeTimer = 0;
          if (isGestureActive(this)) {
            // Während aktiver Geste nicht rekursiv wieder _resizeViewportCanvas()
            // aufrufen. Genau das war in alten Patches gefährlich.
            log(this, "workarea:input:resize-drop-during-gesture:v1", {});
            return;
          }
          log(this, "workarea:input:resize-flush:v1", {});
          try { originalResize.apply(this, args); } catch (e) {
            log(this, "workarea:input:resize-error:v1", { message: e?.message || String(e) });
          }
        }, 420);

        log(this, "workarea:input:resize-deferred:v1", {});
        return;
      }

      return originalResize.apply(this, args);
    });
  }

  if (typeof originalRender2D === "function") {
    wrapMethod(proto, "_renderViewport2D", () => function patchedRenderViewport2DInputManagerV1(dt) {
      const st = ensureState(this);
      if (st && isDragLike(this)) {
        const t = nowMs();
        const minFrameMs = 42; // ca. 24 FPS während Drag/Pan/Pinch
        if (st.lastRenderAt && t - st.lastRenderAt < minFrameMs) {
          st.skippedRenders += 1;
          return;
        }
        st.lastRenderAt = t;
      }
      return originalRender2D.call(this, dt);
    });
  }

  if (typeof originalRenderRightPanel === "function") {
    wrapMethod(proto, "_renderRightPanel", () => function patchedRenderRightPanelInputManagerV1(...args) {
      const st = ensureState(this);
      if (st && isGestureActive(this)) {
        st.pendingRightPanel = true;
        scheduleRightPanelFlush(this, originalRenderRightPanel, 520, "gesture-active");
        log(this, "workarea:input:right-panel-deferred:v1", {
          dragActive: !!getPointer(this)?.dragActive,
          dragObjId: getPointer(this)?.dragObjId || null
        });
        return;
      }

      return originalRenderRightPanel.apply(this, args);
    });
  }

  try { console.info(`[${PATCH_ID}] input manager installed`); } catch {}
  try {
    window.BP_CRASH_RECORDER?.log?.("workarea:input-manager:v1-installed", {
      guard: GUARD_ID,
      strategy: "device-neutral-raf-resize-render-guard"
    });
  } catch {}
  return true;
}

install();

export { install };
