/**
 * core/workarea-input-manager.v1.js
 * Version: PATCH_workarea_input_manager_v1_1 (2026-05-22)
 *
 * FIX gegenüber Hardcut v1:
 * ============================================================================
 * Der Crashlog zeigt:
 * - SaveManager v1.1 funktioniert und startet pending-save nach Drag korrekt.
 * - Der Absturz passiert aber weiterhin während längerem Drag auf iPhone/Safari.
 * - Im Log stand z. B. `moveIn: 60, moveRafRuns: 60`.
 *
 * Problem:
 * v1 bündelte PointerMove nur auf requestAnimationFrame. Das sind auf Safari
 * immer noch bis zu 60 Move-Verarbeitungen pro Sekunde. Für schwere Baugruppen
 * ist das zu viel.
 *
 * v1.1:
 * - verarbeitet PointerMove während Drag/Geste nur noch zeitgedrosselt,
 *   auf Touch/iPhone ca. 8–10 FPS, auf Desktop ca. 20 FPS.
 * - der letzte Move wird bei PointerUp garantiert noch verarbeitet.
 * - Resize und RightPanel bleiben während Gesten verzögert.
 * - Render während Drag wird auf Touch stärker reduziert.
 *
 * Wichtig:
 * Keine Geräte-Sonderarchitektur. Die Logik läuft auf allen Geräten,
 * verwendet aber Pointer-/Touch-Merkmale zur Leistungsdrosselung.
 */

import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

const PATCH_ID = "PATCH_workarea_input_manager_v1_1";
const GUARD_ID = "workarea-input-manager-v1.1";
const WRAP_FLAG = Symbol.for("baustellenplaner.workareaInputManager.v1_1.wrapper");

const TOUCH_MOVE_MIN_MS = 115;   // ca. 8–9 FPS während Drag auf Touch/Safari
const DESKTOP_MOVE_MIN_MS = 48;  // ca. 20 FPS während Drag auf Desktop
const TOUCH_RENDER_MIN_MS = 140; // extra vorsichtig: Render während Touch-Drag
const DESKTOP_RENDER_MIN_MS = 58;

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
  // Während echter Drag-/Pinch-/Pan-Gesten stärker drosseln.
  if (isTouchLike()) return TOUCH_MOVE_MIN_MS;
  if (isDragLike(instance)) return DESKTOP_MOVE_MIN_MS;
  return 32;
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
    log(instance, "workarea:input:move-error:v1.1", {
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

function scheduleRightPanelFlush(instance, originalRenderRightPanel, delay = 560, source = "schedule") {
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
      scheduleRightPanelFlush(instance, originalRenderRightPanel, 720, "still-active");
      return;
    }

    st.pendingRightPanel = false;
    log(instance, "workarea:input:right-panel-flush:v1.1", { source });

    try {
      originalRenderRightPanel.call(instance);
    } catch (e) {
      log(instance, "workarea:input:right-panel-error:v1.1", {
        message: e?.message || String(e)
      });
    }
  }, Math.max(160, delay));
}

function wrapMethod(proto, name, wrapperFactory) {
  const current = proto?.[name];

  if (typeof current !== "function") return false;
  if (current[WRAP_FLAG]) return false;

  const wrapped = wrapperFactory(current);
  if (typeof wrapped !== "function") return false;

  wrapped[WRAP_FLAG] = true;
  wrapped.__previousWorkareaInputManagerV1_1 = current;
  proto[name] = wrapped;
  return true;
}

function install() {
  if (window.__BP_WORKAREA_INPUT_MANAGER_V1_1_INSTALLED) return false;
  window.__BP_WORKAREA_INPUT_MANAGER_V1_1_INSTALLED = true;

  const proto = WorkareaPanel?.prototype;
  if (!proto) return false;

  const originalMove = proto._onViewportPointerMove;
  const originalRender2D = proto._renderViewport2D;
  const originalRenderRightPanel = proto._renderRightPanel;
  const originalResize = proto._resizeViewportCanvas;

  wrapMethod(proto, "mount", (original) => async function patchedMountInputManagerV11(...args) {
    const result = await original.apply(this, args);
    try { window.__BP_WORKAREA_ACTIVE_PANEL__ = this; } catch {}
    ensureState(this);
    log(this, "workarea:input-manager:mount:v1.1", {
      strategy: "device-neutral-timed-pointer-throttle"
    });
    return result;
  });

  wrapMethod(proto, "_onViewportPointerDown", (original) => function patchedPointerDownInputManagerV11(ev, ...rest) {
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

    log(this, "workarea:input:pointerdown:v1.1", {
      pointerId: ev?.pointerId,
      touchLike: isTouchLike()
    });

    return original.call(this, ev, ...rest);
  });

  if (typeof originalMove === "function") {
    wrapMethod(proto, "_onViewportPointerMove", () => function patchedPointerMoveInputManagerV11(ev) {
      const st = ensureState(this);
      if (!st) return originalMove.call(this, ev);

      try { ev?.preventDefault?.(); } catch {}

      st.moveIn += 1;
      st.pendingMove = clonePointerEvent(ev);

      // Der erste Move muss schnell durch, damit WorkareaPanel Drag korrekt erkennt.
      if (st.moveIn <= 2 && !isDragLike(this)) {
        flushMove(this, originalMove, "startup");
        return;
      }

      scheduleMove(this, originalMove);

      if (st.moveIn > 0 && st.moveIn % 80 === 0) {
        log(this, "workarea:input:move-throttled:v1.1", {
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

  wrapMethod(proto, "_onViewportPointerUp", (original) => function patchedPointerUpInputManagerV11(ev, ...rest) {
    const st = ensureState(this);

    // Wichtig: den letzten Move vor dem originalen PointerUp final verarbeiten.
    if (st?.pendingMove && typeof originalMove === "function") {
      try { flushMove(this, originalMove, "pointerup-before-original"); } catch {}
    }

    const result = original.call(this, ev, ...rest);

    if (st) {
      log(this, "workarea:input:pointerup:v1.1", {
        pointerId: ev?.pointerId,
        moveIn: st.moveIn,
        moveProcessed: st.moveProcessed,
        moveDropped: st.moveDropped,
        skippedRenders: st.skippedRenders
      });

      if (st.finalRenderTimer) {
        try { clearTimeout(st.finalRenderTimer); } catch {}
      }

      st.finalRenderTimer = window.setTimeout(() => {
        st.finalRenderTimer = 0;

        try { originalRender2D?.call(this, 0); } catch {}

        if (st.pendingRightPanel) {
          scheduleRightPanelFlush(this, originalRenderRightPanel, 60, "pointerup-final");
        }

        log(this, "workarea:input:final-render:v1.1", {
          moveIn: st.moveIn,
          moveProcessed: st.moveProcessed,
          moveDropped: st.moveDropped,
          skippedRenders: st.skippedRenders
        });
      }, isTouchLike() ? 260 : 160);
    }

    return result;
  });

  if (typeof originalResize === "function") {
    wrapMethod(proto, "_resizeViewportCanvas", () => function patchedResizeViewportCanvasInputManagerV11(...args) {
      const st = ensureState(this);

      if (st && isGestureActive(this)) {
        if (st.resizeTimer) {
          try { clearTimeout(st.resizeTimer); } catch {}
        }

        st.resizeTimer = window.setTimeout(() => {
          st.resizeTimer = 0;

          if (isGestureActive(this)) {
            log(this, "workarea:input:resize-drop-during-gesture:v1.1", {});
            return;
          }

          log(this, "workarea:input:resize-flush:v1.1", {});

          try {
            originalResize.apply(this, args);
          } catch (e) {
            log(this, "workarea:input:resize-error:v1.1", {
              message: e?.message || String(e)
            });
          }
        }, isTouchLike() ? 680 : 420);

        log(this, "workarea:input:resize-deferred:v1.1", {});
        return;
      }

      return originalResize.apply(this, args);
    });
  }

  if (typeof originalRender2D === "function") {
    wrapMethod(proto, "_renderViewport2D", () => function patchedRenderViewport2DInputManagerV11(dt) {
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
    wrapMethod(proto, "_renderRightPanel", () => function patchedRenderRightPanelInputManagerV11(...args) {
      const st = ensureState(this);

      if (st && isGestureActive(this)) {
        st.pendingRightPanel = true;

        scheduleRightPanelFlush(
          this,
          originalRenderRightPanel,
          isTouchLike() ? 840 : 560,
          "gesture-active"
        );

        log(this, "workarea:input:right-panel-deferred:v1.1", {
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
    window.BP_CRASH_RECORDER?.log?.("workarea:input-manager:v1.1-installed", {
      guard: GUARD_ID,
      strategy: "device-neutral-timed-pointer-throttle"
    });
  } catch {}

  return true;
}

install();

export { install };
