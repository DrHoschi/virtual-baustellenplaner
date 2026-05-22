/**
 * core/workarea-input-manager.v1.js
 * Version: PATCH_workarea_input_manager_v1_2 (2026-05-22)
 *
 * FIX gegenüber v1.1:
 * ============================================================================
 * Der Crashlog zeigt:
 * - PointerMove-Drosselung v1.1 funktioniert.
 * - Der Reload passiert jetzt nicht mehr beim schnellen Move selbst,
 *   sondern in der Nachlaufphase nach Drag-Ende:
 *
 *   workarea:save-manager:autosave-scheduled:v1.1
 *   workarea:input:right-panel-flush:v1.1
 *   workarea:mobile-drag:final-render
 *   workarea:input:final-render:v1.1
 *   app:crash-recorder:init
 *
 * Ursache:
 * - Im WorkareaPanel steckt noch ein direkter alter Low-Power-Block:
 *   "v2.2.0-direct-workarea-lowpower".
 * - Dieser erzeugt nach PointerUp zusätzlich einen eigenen finalRender.
 * - Zusammen mit RightPanel-Flush + unserem finalRender entsteht direkt nach
 *   Drag-Ende wieder eine Lastspitze auf iPhone/Safari.
 *
 * v1.2:
 * - neutralisiert den internen WorkareaPanel-MobileDrag-LowPower-Block
 *   über Prototype-Patches:
 *     _enterMobileDragLowPower -> no-op
 *     _leaveMobileDragLowPower -> no-op ohne finalRender
 *     _renderViewport2DThrottled -> direkt über unseren Renderguard
 * - verzögert RightPanel-Flush nach Touch-Drag deutlich.
 * - verzögert finalRender nach Touch-Drag deutlich.
 * - drosselt Touch-Drag noch härter.
 *
 * Wichtig:
 * Das ist weiterhin eine Geräte-unabhängige Architektur. Die Drosselung
 * richtet sich nach Pointer-/Touch-Eigenschaften und aktiver Geste.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_input_manager";
const GUARD_ID = "workarea-input-manager";
const WRAP_FLAG = Symbol.for("baustellenplaner.workareaInputManager.wrapper");

const TOUCH_MOVE_MIN_MS = 160;     // ca. 6 FPS während Drag auf Touch/Safari
const DESKTOP_MOVE_MIN_MS = 55;    // ca. 18 FPS während Drag auf Desktop
const TOUCH_RENDER_MIN_MS = 220;   // max. ca. 4–5 FPS während Touch-Drag
const DESKTOP_RENDER_MIN_MS = 70;

const TOUCH_FINAL_RENDER_DELAY_MS = 1250;
const DESKTOP_FINAL_RENDER_DELAY_MS = 220;
const TOUCH_RIGHT_PANEL_DELAY_MS = 1700;
const DESKTOP_RIGHT_PANEL_DELAY_MS = 650;

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function isTouchLike() {
  try {
    const ua = String(navigator.userAgent || "");
    const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
    const touch = Number(navigator.maxTouchPoints || 0) > 0;
    return /iPhone|iPad|iPod|Android/i.test(ua) || coarse || touch;
  } catch {
    return true;
  }
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
  try {
    return !!(p?.dragActive || p?.dragObjId || p?.isPanning || p?.pinchActive);
  } catch {
    return false;
  }
}

function disableInternalMobileDrag(instance, source = "unknown") {
  try {
    const M = instance?._mobileDrag;
    if (!M) return;
    if (M.finalRenderTimer) {
      try { clearTimeout(M.finalRenderTimer); } catch {}
      M.finalRenderTimer = 0;
    }
    M.enabled = false;
    M.lowPower = false;
    M.minRenderGapMs = 999999;
    M.pointerId = null;
    M.dragObjId = null;
    if (!M.__hardcutDisabledLogged) {
      M.__hardcutDisabledLogged = true;
      log(instance, "workarea:input:internal-mobile-drag-disabled:v1.2", {
        source,
        oldVersion: M.version || null
      });
    }
  } catch {}
}

function ensureState(instance) {
  if (!instance) return null;

  if (!instance.__bpWorkareaInputManagerV1) {
    instance.__bpWorkareaInputManagerV1 = {};
  }

  const st = instance.__bpWorkareaInputManagerV1;
  st.moveTimer ??= 0;
  st.pendingMove ??= null;
  st.resizeTimer ??= 0;
  st.finalRenderTimer ??= 0;
  st.rightPanelTimer ??= 0;
  st.pendingRightPanel ??= false;
  st.lastRenderAt ??= 0;
  st.skippedRenders ??= 0;
  st.moveIn ??= 0;
  st.moveProcessed ??= 0;
  st.moveDropped ??= 0;
  st.nextMoveAllowedAt ??= 0;
  st.gestureStartedAt ??= 0;
  st.installedAt ??= new Date().toISOString();
  return st;
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

function getMoveMinMs(instance) {
  if (isTouchLike()) return TOUCH_MOVE_MIN_MS;
  if (isDragLike(instance)) return DESKTOP_MOVE_MIN_MS;
  return 40;
}

function flushMove(instance, originalMove, source = "flush") {
  const st = ensureState(instance);
  if (!st?.pendingMove || typeof originalMove !== "function") return;

  const ev = st.pendingMove;
  st.pendingMove = null;

  if (st.moveTimer) {
    try { clearTimeout(st.moveTimer); } catch {}
    st.moveTimer = 0;
  }

  st.moveProcessed += 1;
  st.nextMoveAllowedAt = nowMs() + getMoveMinMs(instance);

  try {
    originalMove.call(instance, ev);
  } catch (e) {
    log(instance, "workarea:input:move-error:v1.2", {
      source,
      message: e?.message || String(e)
    });
    throw e;
  }
}

function scheduleMove(instance, originalMove) {
  const st = ensureState(instance);
  if (!st || typeof originalMove !== "function") return;

  const delay = Math.max(0, (st.nextMoveAllowedAt || 0) - nowMs());

  if (delay <= 0) {
    flushMove(instance, originalMove, "immediate");
    return;
  }

  st.moveDropped += 1;

  if (st.moveTimer) return;

  st.moveTimer = window.setTimeout(() => {
    st.moveTimer = 0;
    flushMove(instance, originalMove, "timer");
  }, Math.min(delay, getMoveMinMs(instance)));
}

function scheduleRightPanelFlush(instance, originalRenderRightPanel, delay, source = "schedule") {
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
      scheduleRightPanelFlush(
        instance,
        originalRenderRightPanel,
        isTouchLike() ? TOUCH_RIGHT_PANEL_DELAY_MS : DESKTOP_RIGHT_PANEL_DELAY_MS,
        "still-active"
      );
      return;
    }

    st.pendingRightPanel = false;
    log(instance, "workarea:input:right-panel-flush:v1.2", { source });

    try {
      originalRenderRightPanel.call(instance);
    } catch (e) {
      log(instance, "workarea:input:right-panel-error:v1.2", {
        message: e?.message || String(e)
      });
    }
  }, Math.max(220, delay));
}

function wrapMethod(proto, name, wrapperFactory) {
  const current = proto?.[name];

  if (typeof current !== "function") return false;
  if (current[WRAP_FLAG]) return false;

  const wrapped = wrapperFactory(current);
  if (typeof wrapped !== "function") return false;

  wrapped[WRAP_FLAG] = true;
  wrapped.__previousWorkareaInputManagerV1_2 = current;
  proto[name] = wrapped;
  return true;
}

function install() {
  if (window.__BP_WORKAREA_INPUT_MANAGER_V1_2_INSTALLED) return false;
  window.__BP_WORKAREA_INPUT_MANAGER_V1_2_INSTALLED = true;

  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  const originalMove = proto._onViewportPointerMove;
  const originalRender2D = proto._renderViewport2D;
  const originalRender2DThrottled = proto._renderViewport2DThrottled;
  const originalRenderRightPanel = proto._renderRightPanel;
  const originalResize = proto._resizeViewportCanvas;

  // -------------------------------------------------------------------------
  // HARDCUT: internen MobileDrag-LowPower-Block neutralisieren.
  // -------------------------------------------------------------------------
  wrapMethod(proto, "_enterMobileDragLowPower", (original) => function patchedEnterInternalMobileDragV12(source, ev = null) {
    disableInternalMobileDrag(this, `_enter:${source || "unknown"}`);
    log(this, "workarea:input:internal-mobile-drag-enter-blocked:v1.2", {
      source: source || "unknown",
      pointerId: ev?.pointerId ?? null
    });
    return;
  });

  wrapMethod(proto, "_leaveMobileDragLowPower", (original) => function patchedLeaveInternalMobileDragV12(source, ev = null) {
    disableInternalMobileDrag(this, `_leave:${source || "unknown"}`);
    log(this, "workarea:input:internal-mobile-drag-leave-blocked:v1.2", {
      source: source || "unknown",
      pointerId: ev?.pointerId ?? null
    });
    return;
  });

  if (typeof originalRender2DThrottled === "function" && typeof originalRender2D === "function") {
    wrapMethod(proto, "_renderViewport2DThrottled", () => function patchedRenderViewport2DThrottledV12(dt, t = nowMs()) {
      disableInternalMobileDrag(this, "_renderViewport2DThrottled");
      return this._renderViewport2D(dt);
    });
  }

  wrapMethod(proto, "mount", (original) => async function patchedMountInputManagerV12(...args) {
    const result = await original.apply(this, args);
    try { window.__BP_WORKAREA_ACTIVE_PANEL__ = this; } catch {}
    ensureState(this);
    disableInternalMobileDrag(this, "mount");
    log(this, "workarea:input-manager:mount:v1.2", {
      strategy: "disable-internal-mobile-drag-delay-final-render"
    });
    return result;
  });

  wrapMethod(proto, "_onViewportPointerDown", (original) => function patchedPointerDownInputManagerV12(ev, ...rest) {
    disableInternalMobileDrag(this, "pointerdown");
    const st = ensureState(this);

    if (st) {
      st.moveIn = 0;
      st.moveProcessed = 0;
      st.moveDropped = 0;
      st.skippedRenders = 0;
      st.pendingMove = null;
      st.nextMoveAllowedAt = 0;
      st.gestureStartedAt = nowMs();

      if (st.moveTimer) {
        try { clearTimeout(st.moveTimer); } catch {}
        st.moveTimer = 0;
      }

      if (st.finalRenderTimer) {
        try { clearTimeout(st.finalRenderTimer); } catch {}
        st.finalRenderTimer = 0;
      }
    }

    try { window.__BP_WORKAREA_ACTIVE_PANEL__ = this; } catch {}

    log(this, "workarea:input:pointerdown:v1.2", {
      pointerId: ev?.pointerId,
      touchLike: isTouchLike()
    });

    return original.call(this, ev, ...rest);
  });

  if (typeof originalMove === "function") {
    wrapMethod(proto, "_onViewportPointerMove", () => function patchedPointerMoveInputManagerV12(ev) {
      const st = ensureState(this);
      if (!st) return originalMove.call(this, ev);

      try { ev?.preventDefault?.(); } catch {}

      st.moveIn += 1;
      st.pendingMove = clonePointerEvent(ev);

      // Der erste Move muss schnell durch, damit WorkareaPanel Drag erkennt.
      if (st.moveIn <= 2 && !isDragLike(this)) {
        flushMove(this, originalMove, "startup");
        return;
      }

      scheduleMove(this, originalMove);

      if (st.moveIn > 0 && st.moveIn % 100 === 0) {
        log(this, "workarea:input:move-throttled:v1.2", {
          moveIn: st.moveIn,
          moveProcessed: st.moveProcessed,
          moveDropped: st.moveDropped,
          dragActive: !!getPointer(this)?.dragActive,
          dragObjId: getPointer(this)?.dragObjId || null,
          touchLike: isTouchLike()
        });
      }
    });
  }

  wrapMethod(proto, "_onViewportPointerUp", (original) => function patchedPointerUpInputManagerV12(ev, ...rest) {
    const st = ensureState(this);

    // Letzten Move vor originalem PointerUp final verarbeiten.
    if (st?.pendingMove && typeof originalMove === "function") {
      try { flushMove(this, originalMove, "pointerup-before-original"); } catch {}
    }

    const result = original.call(this, ev, ...rest);

    // Der originale PointerUp kann alte MobileDrag-Flags wieder setzen.
    disableInternalMobileDrag(this, "pointerup-after-original");

    if (st) {
      log(this, "workarea:input:pointerup:v1.2", {
        pointerId: ev?.pointerId,
        moveIn: st.moveIn,
        moveProcessed: st.moveProcessed,
        moveDropped: st.moveDropped,
        skippedRenders: st.skippedRenders
      });

      if (st.finalRenderTimer) {
        try { clearTimeout(st.finalRenderTimer); } catch {}
      }

      const finalDelay = isTouchLike() ? TOUCH_FINAL_RENDER_DELAY_MS : DESKTOP_FINAL_RENDER_DELAY_MS;

      st.finalRenderTimer = window.setTimeout(() => {
        st.finalRenderTimer = 0;
        disableInternalMobileDrag(this, "final-render-timer");

        try { originalRender2D?.call(this, 0); } catch {}

        if (st.pendingRightPanel) {
          scheduleRightPanelFlush(
            this,
            originalRenderRightPanel,
            isTouchLike() ? 350 : 80,
            "pointerup-final"
          );
        }

        log(this, "workarea:input:final-render:v1.2", {
          moveIn: st.moveIn,
          moveProcessed: st.moveProcessed,
          moveDropped: st.moveDropped,
          skippedRenders: st.skippedRenders,
          delay: finalDelay
        });
      }, finalDelay);
    }

    return result;
  });

  if (typeof originalResize === "function") {
    wrapMethod(proto, "_resizeViewportCanvas", () => function patchedResizeViewportCanvasInputManagerV12(...args) {
      const st = ensureState(this);

      if (st && isGestureActive(this)) {
        if (st.resizeTimer) {
          try { clearTimeout(st.resizeTimer); } catch {}
        }

        st.resizeTimer = window.setTimeout(() => {
          st.resizeTimer = 0;

          if (isGestureActive(this)) {
            log(this, "workarea:input:resize-drop-during-gesture:v1.2", {});
            return;
          }

          log(this, "workarea:input:resize-flush:v1.2", {});

          try {
            originalResize.apply(this, args);
          } catch (e) {
            log(this, "workarea:input:resize-error:v1.2", {
              message: e?.message || String(e)
            });
          }
        }, isTouchLike() ? 900 : 520);

        log(this, "workarea:input:resize-deferred:v1.2", {});
        return;
      }

      return originalResize.apply(this, args);
    });
  }

  if (typeof originalRender2D === "function") {
    wrapMethod(proto, "_renderViewport2D", () => function patchedRenderViewport2DInputManagerV12(dt) {
      const st = ensureState(this);

      if (st && isDragLike(this)) {
        const t = nowMs();
        const minFrameMs = isTouchLike() ? TOUCH_RENDER_MIN_MS : DESKTOP_RENDER_MIN_MS;

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
    wrapMethod(proto, "_renderRightPanel", () => function patchedRenderRightPanelInputManagerV12(...args) {
      const st = ensureState(this);

      if (st && isGestureActive(this)) {
        st.pendingRightPanel = true;

        scheduleRightPanelFlush(
          this,
          originalRenderRightPanel,
          isTouchLike() ? TOUCH_RIGHT_PANEL_DELAY_MS : DESKTOP_RIGHT_PANEL_DELAY_MS,
          "gesture-active"
        );

        log(this, "workarea:input:right-panel-deferred:v1.2", {
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
    window.BP_CRASH_RECORDER?.log?.("workarea:input-manager:v1.2-installed", {
      guard: GUARD_ID,
      strategy: "disable-internal-mobile-drag-delay-final-render"
    });
  } catch {}

  return true;
}

install();

export { install };
