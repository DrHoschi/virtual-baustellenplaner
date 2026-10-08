import { WorkareaPanel } from "../panels/WorkareaPanel.js";

const INSTALL_FLAG = Symbol.for("bp.tech-wa-freeze-01b1.installed");
const VERSION = "TECH-WA-FREEZE-01B.1";

function stateFor(panel) {
  if (!panel.__bpFreeze01B1) {
    panel.__bpFreeze01B1 = {
      resizeCalls: 0,
      requestCalls: 0,
      loopCalls: 0,
      renderCalls: 0
    };
  }
  return panel.__bpFreeze01B1;
}

function breadcrumb(panel, event, payload = {}) {
  try {
    panel?._crashLog?.(`workarea:diag:freeze01b1:${event}`, {
      version: VERSION,
      ...payload
    });
  } catch {}
}

function wrapRequest(proto) {
  const original = proto._requestViewportCanvasResize;
  if (typeof original !== "function") return;

  proto._requestViewportCanvasResize = function patchedRequest(reason = "resize-request", opts = {}) {
    const state = stateFor(this);
    state.requestCalls += 1;
    const trace = state.requestCalls <= 4;
    if (trace) breadcrumb(this, "resize-request-enter", { call: state.requestCalls, reason });
    try {
      return original.call(this, reason, opts);
    } finally {
      if (trace) breadcrumb(this, "resize-request-return", { call: state.requestCalls, reason });
    }
  };
}

function wrapResize(proto) {
  const original = proto._resizeViewportCanvas;
  if (typeof original !== "function") return;

  proto._resizeViewportCanvas = function patchedResize(reason = "resize", opts = {}) {
    const state = stateFor(this);
    state.resizeCalls += 1;
    const call = state.resizeCalls;
    const trace = call <= 8;
    if (trace) {
      breadcrumb(this, "resize-apply-enter", {
        call,
        reason,
        force: !!opts?.force,
        finalSync: !!opts?.finalSync
      });
    }
    try {
      return original.call(this, reason, opts);
    } finally {
      if (trace) {
        breadcrumb(this, "resize-apply-return", {
          call,
          reason,
          w: this?._vp?.w || 0,
          h: this?._vp?.h || 0
        });
      }
    }
  };
}

function wrapRender(proto) {
  const original = proto._renderViewport2DThrottled;
  if (typeof original !== "function") return;

  proto._renderViewport2DThrottled = function patchedRender(dt, now) {
    const state = stateFor(this);
    state.renderCalls += 1;
    const call = state.renderCalls;
    const trace = call <= 2;
    if (trace) breadcrumb(this, "render-enter", { call, dt: Math.round(Number(dt || 0)) });
    try {
      return original.call(this, dt, now);
    } finally {
      if (trace) breadcrumb(this, "render-return", { call, fps: Number(this?._vp?.fps || 0) });
    }
  };
}

function wrapLoop(proto) {
  const original = proto._viewportLoop;
  if (typeof original !== "function") return;

  proto._viewportLoop = function patchedLoop(t) {
    const state = stateFor(this);
    state.loopCalls += 1;
    const call = state.loopCalls;
    const trace = call <= 2;
    if (trace) breadcrumb(this, "raf-loop-enter", { call, t: Math.round(Number(t || 0)) });
    try {
      return original.call(this, t);
    } finally {
      if (trace) breadcrumb(this, "raf-loop-return", { call, raf: this?._vp?.raf || 0 });
    }
  };
}

export function installWorkareaFreezeDiagnostic01B1() {
  const proto = WorkareaPanel?.prototype;
  if (!proto || proto[INSTALL_FLAG]) return false;

  Object.defineProperty(proto, INSTALL_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  wrapRequest(proto);
  wrapResize(proto);
  wrapRender(proto);
  wrapLoop(proto);

  try {
    window.__bpWorkareaFreezeDiagnostic01B1 = {
      installed: true,
      version: VERSION
    };
  } catch {}

  return true;
}
