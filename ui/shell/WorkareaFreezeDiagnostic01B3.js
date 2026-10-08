import { WorkareaPanel } from "../panels/WorkareaPanel.js";

const INSTALL_FLAG = Symbol.for("bp.tech-wa-freeze-01b3.installed");
const VERSION = "TECH-WA-FREEZE-01B.3";
const WATCHDOG_MS = 1000;
const STALL_MS = 1800;
const MAX_RUNTIME_MS = 30000;

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function errorPayload(error) {
  return {
    name: String(error?.name || "Error"),
    message: String(error?.message || error || "unknown").slice(0, 500),
    stack: String(error?.stack || "").slice(0, 1200)
  };
}

function breadcrumb(panel, event, payload = {}) {
  try {
    panel?._crashLog?.(`workarea:diag:freeze01b3:${event}`, {
      version: VERSION,
      ...payload
    });
  } catch {}
}

function ensureState(panel) {
  if (!panel.__bpFreeze01B3) {
    panel.__bpFreeze01B3 = {
      startedAt: 0,
      frameCount: 0,
      renderCount: 0,
      lastLoopEnterAt: 0,
      lastLoopReturnAt: 0,
      lastRenderEnterAt: 0,
      lastRenderReturnAt: 0,
      lastRafAtEnter: 0,
      lastRafAfterReturn: 0,
      lastRunningAtEnter: false,
      lastRunningAfterReturn: false,
      lastScheduleObserved: false,
      lastPhase: "idle",
      watchdogId: 0,
      stallLogged: false,
      stopped: false
    };
  }
  return panel.__bpFreeze01B3;
}

function snapshot(panel, state, now = nowMs()) {
  return {
    frameCount: state.frameCount,
    renderCount: state.renderCount,
    phase: state.lastPhase,
    running: !!panel?._vp?.running,
    raf: Number(panel?._vp?.raf || 0),
    lastRafAtEnter: Number(state.lastRafAtEnter || 0),
    lastRafAfterReturn: Number(state.lastRafAfterReturn || 0),
    lastScheduleObserved: !!state.lastScheduleObserved,
    sinceLoopEnterMs: state.lastLoopEnterAt ? Math.round(now - state.lastLoopEnterAt) : null,
    sinceLoopReturnMs: state.lastLoopReturnAt ? Math.round(now - state.lastLoopReturnAt) : null,
    sinceRenderEnterMs: state.lastRenderEnterAt ? Math.round(now - state.lastRenderEnterAt) : null,
    sinceRenderReturnMs: state.lastRenderReturnAt ? Math.round(now - state.lastRenderReturnAt) : null,
    visibility: document.visibilityState
  };
}

function stopWatchdog(state) {
  if (!state || state.stopped) return;
  state.stopped = true;
  if (state.watchdogId) {
    clearTimeout(state.watchdogId);
    state.watchdogId = 0;
  }
}

function scheduleWatchdog(panel, state) {
  state.watchdogId = setTimeout(() => {
    if (state.stopped) return;

    const now = nowMs();
    const elapsed = now - state.startedAt;
    const lastAlive = Math.max(state.lastLoopEnterAt, state.lastLoopReturnAt, state.lastRenderReturnAt);
    const gap = lastAlive ? now - lastAlive : 0;

    if (!state.stallLogged && document.visibilityState === "visible" && gap >= STALL_MS) {
      state.stallLogged = true;
      breadcrumb(panel, "raf-stall-detected", {
        stalledForMs: Math.round(gap),
        ...snapshot(panel, state, now)
      });
    }

    if (elapsed >= MAX_RUNTIME_MS) {
      breadcrumb(panel, "watchdog-stop", {
        reason: "runtime-limit",
        elapsedMs: Math.round(elapsed),
        ...snapshot(panel, state, now)
      });
      stopWatchdog(state);
      return;
    }

    scheduleWatchdog(panel, state);
  }, WATCHDOG_MS);
}

function startWatchdog(panel, state) {
  if (state.startedAt) return;
  state.startedAt = nowMs();
  breadcrumb(panel, "watchdog-start", {
    running: !!panel?._vp?.running,
    raf: Number(panel?._vp?.raf || 0),
    visibility: document.visibilityState
  });
  scheduleWatchdog(panel, state);
}

function wrapRender(proto) {
  const original = proto._renderViewport2DThrottled;
  if (typeof original !== "function") return;

  proto._renderViewport2DThrottled = function patchedFreeze01B3Render(dt, now) {
    const state = ensureState(this);
    state.renderCount += 1;
    state.lastRenderEnterAt = nowMs();
    state.lastPhase = "render-enter";

    try {
      const result = original.call(this, dt, now);
      state.lastRenderReturnAt = nowMs();
      state.lastPhase = "render-return";
      return result;
    } catch (error) {
      state.lastPhase = "render-throw";
      breadcrumb(this, "render-throw", {
        dt: Math.round(Number(dt || 0)),
        ...snapshot(this, state),
        error: errorPayload(error)
      });
      throw error;
    }
  };
}

function wrapLoop(proto) {
  const original = proto._viewportLoop;
  if (typeof original !== "function") return;

  proto._viewportLoop = function patchedFreeze01B3Loop(t) {
    const state = ensureState(this);
    startWatchdog(this, state);

    state.frameCount += 1;
    state.stallLogged = false;
    state.lastLoopEnterAt = nowMs();
    state.lastRunningAtEnter = !!this?._vp?.running;
    state.lastRafAtEnter = Number(this?._vp?.raf || 0);
    state.lastPhase = "loop-enter";

    try {
      const result = original.call(this, t);
      state.lastLoopReturnAt = nowMs();
      state.lastRunningAfterReturn = !!this?._vp?.running;
      state.lastRafAfterReturn = Number(this?._vp?.raf || 0);
      state.lastScheduleObserved = state.lastRunningAfterReturn && state.lastRafAfterReturn > 0 && state.lastRafAfterReturn !== state.lastRafAtEnter;
      state.lastPhase = "loop-return";

      if (state.frameCount <= 2 || !state.lastScheduleObserved) {
        breadcrumb(this, state.lastScheduleObserved ? "next-raf-observed" : "next-raf-missing", {
          frame: state.frameCount,
          runningAtEnter: state.lastRunningAtEnter,
          runningAfterReturn: state.lastRunningAfterReturn,
          rafAtEnter: state.lastRafAtEnter,
          rafAfterReturn: state.lastRafAfterReturn,
          ...snapshot(this, state)
        });
      }

      return result;
    } catch (error) {
      state.lastPhase = "loop-throw";
      breadcrumb(this, "loop-throw", {
        frame: state.frameCount,
        runningAtEnter: state.lastRunningAtEnter,
        rafAtEnter: state.lastRafAtEnter,
        ...snapshot(this, state),
        error: errorPayload(error)
      });
      throw error;
    }
  };
}

export function installWorkareaFreezeDiagnostic01B3() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto[INSTALL_FLAG]) return false;

  Object.defineProperty(proto, INSTALL_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  wrapRender(proto);
  wrapLoop(proto);

  try {
    window.__bpWorkareaFreezeDiagnostic01B3 = {
      installed: true,
      version: VERSION,
      watchdogMs: WATCHDOG_MS,
      stallMs: STALL_MS,
      maxRuntimeMs: MAX_RUNTIME_MS
    };
  } catch {}

  return true;
}
