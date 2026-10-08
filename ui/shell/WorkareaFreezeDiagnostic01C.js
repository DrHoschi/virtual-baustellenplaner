import { WorkareaPanel } from "../panels/WorkareaPanel.js";

const INSTALL_FLAG = Symbol.for("bp.tech-wa-freeze-01c.installed");
const VERSION = "TECH-WA-FREEZE-01C";
const PROBE_MS = 30000;
const WIDTH_TOLERANCE_PX = 2;

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function isPhoneProbeTarget() {
  try {
    return /iPhone|iPod/i.test(navigator.userAgent || "") || window.innerWidth <= 520;
  } catch {
    return false;
  }
}

function breadcrumb(panel, event, payload = {}) {
  try {
    panel?._crashLog?.(`workarea:diag:freeze01c:${event}`, {
      version: VERSION,
      ...payload
    });
  } catch {}
}

function ensureState(panel) {
  if (!panel.__bpFreeze01C) {
    panel.__bpFreeze01C = {
      active: false,
      startedAt: 0,
      lockW: 0,
      lockH: 0,
      suppressed: 0,
      allowedWidthChanges: 0,
      stopLogged: false
    };
  }
  return panel.__bpFreeze01C;
}

function stopIfExpired(panel, state, now) {
  if (!state.active || state.stopLogged || !state.startedAt) return;
  if (now - state.startedAt < PROBE_MS) return;
  state.active = false;
  state.stopLogged = true;
  breadcrumb(panel, "probe-stop", {
    reason: "runtime-limit",
    elapsedMs: Math.round(now - state.startedAt),
    lockW: state.lockW,
    lockH: state.lockH,
    suppressed: state.suppressed,
    allowedWidthChanges: state.allowedWidthChanges
  });
}

export function installWorkareaFreezeDiagnostic01C() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto[INSTALL_FLAG]) return false;
  const original = proto._resizeViewportCanvas;
  if (typeof original !== "function") return false;

  Object.defineProperty(proto, INSTALL_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  proto._resizeViewportCanvas = function patchedFreeze01CResize(reason, options = {}) {
    const state = ensureState(this);
    const now = nowMs();

    if (!isPhoneProbeTarget()) return original.call(this, reason, options);

    if (!state.startedAt || reason === "mount:init") {
      const result = original.call(this, reason, options);
      const rect = this?._vp?.host?.getBoundingClientRect?.();
      state.startedAt = nowMs();
      state.active = true;
      state.stopLogged = false;
      state.lockW = Math.round(Number(this?._vp?.w || rect?.width || 0));
      state.lockH = Math.round(Number(this?._vp?.h || rect?.height || 0));
      state.suppressed = 0;
      state.allowedWidthChanges = 0;
      breadcrumb(this, "probe-start", {
        reason: String(reason || ""),
        probeMs: PROBE_MS,
        widthTolerancePx: WIDTH_TOLERANCE_PX,
        lockW: state.lockW,
        lockH: state.lockH,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        visibility: document.visibilityState
      });
      return result;
    }

    stopIfExpired(this, state, now);
    if (!state.active) return original.call(this, reason, options);

    const rect = this?._vp?.host?.getBoundingClientRect?.();
    const requestedW = Math.round(Number(rect?.width || 0));
    const requestedH = Math.round(Number(rect?.height || 0));
    const widthDelta = Math.abs(requestedW - state.lockW);
    const heightDelta = Math.abs(requestedH - state.lockH);

    if (requestedW > 0 && widthDelta <= WIDTH_TOLERANCE_PX && heightDelta > 1) {
      state.suppressed += 1;
      if (state.suppressed <= 5 || state.suppressed % 10 === 0) {
        breadcrumb(this, "height-resize-suppressed", {
          reason: String(reason || ""), requestedW, requestedH,
          lockW: state.lockW, lockH: state.lockH,
          widthDelta, heightDelta, suppressed: state.suppressed,
          finalSync: !!options?.finalSync, force: !!options?.force,
          visibility: document.visibilityState
        });
      }
      return;
    }

    const result = original.call(this, reason, options);
    if (requestedW > 0 && widthDelta > WIDTH_TOLERANCE_PX) {
      state.allowedWidthChanges += 1;
      const appliedW = Math.round(Number(this?._vp?.w || requestedW));
      const appliedH = Math.round(Number(this?._vp?.h || requestedH));
      breadcrumb(this, "width-change-allowed", {
        reason: String(reason || ""), previousW: state.lockW, previousH: state.lockH,
        requestedW, requestedH, appliedW, appliedH,
        allowedWidthChanges: state.allowedWidthChanges
      });
      state.lockW = appliedW;
      state.lockH = appliedH;
    }
    return result;
  };

  try {
    window.__bpWorkareaFreezeDiagnostic01C = {
      installed: true,
      version: VERSION,
      probeMs: PROBE_MS,
      widthTolerancePx: WIDTH_TOLERANCE_PX
    };
  } catch {}
  return true;
}
