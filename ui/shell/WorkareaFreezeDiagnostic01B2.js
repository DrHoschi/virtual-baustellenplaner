import { WorkareaPanel } from "../panels/WorkareaPanel.js";

const INSTALL_FLAG = Symbol.for("bp.tech-wa-freeze-01b2.installed");
const VERSION = "TECH-WA-FREEZE-01B.2";
const HEARTBEAT_MS = 1000;
const MAX_RUNTIME_MS = 30000;

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function breadcrumb(panel, event, payload = {}) {
  try {
    panel?._crashLog?.(`workarea:diag:freeze01b2:${event}`, {
      version: VERSION,
      ...payload
    });
  } catch {}
}

function ensureState(panel) {
  if (!panel.__bpFreeze01B2) {
    panel.__bpFreeze01B2 = {
      started: false,
      startedAt: 0,
      frameCount: 0,
      lastRafAt: 0,
      lastRafLogAt: 0,
      lastTimerAt: 0,
      timerCount: 0,
      timerId: 0,
      stopped: false
    };
  }
  return panel.__bpFreeze01B2;
}

function stopMonitor(panel, state, reason) {
  if (!state || state.stopped) return;
  state.stopped = true;
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = 0;
  }
  breadcrumb(panel, "monitor-stop", {
    reason,
    elapsedMs: Math.round(nowMs() - state.startedAt),
    frameCount: state.frameCount,
    timerCount: state.timerCount,
    visibility: document.visibilityState
  });
}

function scheduleTimerHeartbeat(panel, state) {
  state.timerId = setTimeout(() => {
    if (state.stopped) return;

    const now = nowMs();
    const elapsedMs = now - state.startedAt;
    const timerGapMs = state.lastTimerAt ? now - state.lastTimerAt : elapsedMs;
    state.lastTimerAt = now;
    state.timerCount += 1;

    breadcrumb(panel, "timer-heartbeat", {
      tick: state.timerCount,
      elapsedMs: Math.round(elapsedMs),
      timerGapMs: Math.round(timerGapMs),
      sinceLastRafMs: state.lastRafAt ? Math.round(now - state.lastRafAt) : null,
      frameCount: state.frameCount,
      visibility: document.visibilityState
    });

    if (elapsedMs >= MAX_RUNTIME_MS) {
      stopMonitor(panel, state, "runtime-limit");
      return;
    }

    scheduleTimerHeartbeat(panel, state);
  }, HEARTBEAT_MS);
}

function startMonitor(panel, state, rafTime) {
  if (state.started) return;
  const now = nowMs();
  state.started = true;
  state.startedAt = now;
  state.lastRafAt = now;
  state.lastRafLogAt = now;
  state.lastTimerAt = now;

  breadcrumb(panel, "monitor-start", {
    rafTime: Math.round(Number(rafTime || 0)),
    visibility: document.visibilityState
  });

  scheduleTimerHeartbeat(panel, state);
}

function wrapLoop(proto) {
  const original = proto._viewportLoop;
  if (typeof original !== "function") return;

  proto._viewportLoop = function patchedFreeze01B2Loop(t) {
    const state = ensureState(this);
    const before = nowMs();
    startMonitor(this, state, t);

    state.frameCount += 1;
    state.lastRafAt = before;

    if (!state.stopped && before - state.lastRafLogAt >= HEARTBEAT_MS) {
      breadcrumb(this, "raf-heartbeat", {
        frame: state.frameCount,
        elapsedMs: Math.round(before - state.startedAt),
        sinceLastTimerMs: Math.round(before - state.lastTimerAt),
        fps: Number(this?._vp?.fps || 0),
        visibility: document.visibilityState
      });
      state.lastRafLogAt = before;
    }

    try {
      return original.call(this, t);
    } finally {
      if (!state.stopped && before - state.startedAt >= MAX_RUNTIME_MS) {
        stopMonitor(this, state, "runtime-limit-from-raf");
      }
    }
  };
}

export function installWorkareaFreezeDiagnostic01B2() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto[INSTALL_FLAG]) return false;

  Object.defineProperty(proto, INSTALL_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  wrapLoop(proto);

  try {
    window.__bpWorkareaFreezeDiagnostic01B2 = {
      installed: true,
      version: VERSION,
      heartbeatMs: HEARTBEAT_MS,
      maxRuntimeMs: MAX_RUNTIME_MS
    };
  } catch {}

  return true;
}
