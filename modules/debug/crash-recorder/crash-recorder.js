/**
 * modules/debug/crash-recorder/crash-recorder.js
 * Version: v1.0.0-workarea-crash-recorder (2026-05-17)
 *
 * Zweck:
 * - Kleiner, robuster Breadcrumb-/Crash-Recorder fuer Safari/iOS und CI.
 * - Speichert die letzten Ereignisse bewusst klein in localStorage.
 * - Nach einem Reload kann man nachvollziehen, was unmittelbar davor passiert ist.
 *
 * WICHTIG:
 * - Keine externen Abhaengigkeiten.
 * - Keine grossen Projekt-/Base64-Daten speichern.
 * - Pointer-Move/Render-Logs muessen vom Aufrufer gedrosselt werden.
 */

const DEFAULT_KEY = "baustellenplaner:crash-recorder:v1";
const DEFAULT_MAX = 180;

function nowIso() {
  try { return new Date().toISOString(); } catch { return String(Date.now()); }
}

function getPerfMs() {
  try { return Math.round(performance.now()); } catch { return 0; }
}

function safeString(value, max = 280) {
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    if (!s) return "";
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    try { return String(value).slice(0, max); } catch { return "[unserializable]"; }
  }
}

function sanitize(value, depth = 0) {
  if (value == null) return value;
  const t = typeof value;
  if (t === "string") {
    // Base64/dataUrls nie in den Crash-Log schreiben.
    if (value.startsWith("data:")) return `[data-url:${value.length}]`;
    return value.length > 420 ? `${value.slice(0, 420)}…` : value;
  }
  if (t === "number" || t === "boolean") return value;
  if (t === "function") return "[function]";
  if (depth > 3) return "[depth-limit]";
  if (Array.isArray(value)) return value.slice(0, 18).map((v) => sanitize(v, depth + 1));

  try {
    const out = {};
    for (const [k, v] of Object.entries(value || {})) {
      if (/dataUrl|thumbnail|base64|buffer|model/i.test(k)) {
        out[k] = typeof v === "string" ? `[large:${v.length}]` : "[large]";
      } else {
        out[k] = sanitize(v, depth + 1);
      }
    }
    return out;
  } catch {
    return safeString(value);
  }
}

function estimateJsonBytes(value) {
  try { return new Blob([JSON.stringify(value)]).size; } catch {}
  try { return JSON.stringify(value).length; } catch { return 0; }
}

function loadState(key) {
  try {
    const raw = localStorage.getItem(key);
    const obj = raw ? JSON.parse(raw) : null;
    if (obj && Array.isArray(obj.events)) return obj;
  } catch {}
  return { schema: "baustellenplaner.crash-recorder.v1", sessions: [], events: [] };
}

function saveState(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch (e) {
    // Wenn localStorage voll ist: aeltere Eintraege hart kuerzen.
    try {
      state.events = (state.events || []).slice(-80);
      localStorage.setItem(key, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }
}

function formatText(state) {
  const lines = [];
  lines.push("Baustellenplaner Crash Recorder v1");
  lines.push(`Export: ${nowIso()}`);
  lines.push(`Events: ${(state.events || []).length}`);
  lines.push("");
  for (const e of state.events || []) {
    const data = e.data == null ? "" : ` ${safeString(e.data, 900)}`;
    lines.push(`${e.t || ""} +${String(e.ms || 0).padStart(6, " ")}ms [${e.session || "-"}] ${e.event || "event"}${data}`);
  }
  return lines.join("\n");
}

export function initCrashRecorder(options = {}) {
  if (typeof window === "undefined") return null;
  if (window.BP_CRASH_RECORDER?.__ready) return window.BP_CRASH_RECORDER;

  const key = options.key || DEFAULT_KEY;
  const max = Number(options.max || DEFAULT_MAX) || DEFAULT_MAX;
  const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  let state = loadState(key);
  state.sessions = Array.isArray(state.sessions) ? state.sessions.slice(-10) : [];
  state.sessions.push({ id: sessionId, startedAt: nowIso(), ua: navigator.userAgent || "" });
  state.events = Array.isArray(state.events) ? state.events.slice(-max) : [];

  let saveQueued = false;
  const flushSoon = () => {
    if (saveQueued) return;
    saveQueued = true;
    setTimeout(() => {
      saveQueued = false;
      saveState(key, state);
    }, 40);
  };

  const api = {
    __ready: true,
    key,
    sessionId,

    log(event, data = null) {
      try {
        const entry = {
          t: nowIso(),
          ms: getPerfMs(),
          session: sessionId,
          event: String(event || "event"),
          data: sanitize(data)
        };
        state.events.push(entry);
        if (state.events.length > max) state.events = state.events.slice(-max);
        flushSoon();
        return entry;
      } catch {
        return null;
      }
    },

    mark(event, data = null) { return this.log(event, data); },
    sizeOf(value) { return estimateJsonBytes(value); },
    getState() { return loadState(key); },
    getEvents() { return this.getState().events || []; },
    text() { return formatText(this.getState()); },

    clear() {
      state = { schema: "baustellenplaner.crash-recorder.v1", sessions: [], events: [] };
      saveState(key, state);
      return true;
    },

    async copy() {
      const txt = this.text();
      try {
        await navigator.clipboard.writeText(txt);
        this.log("recorder:copy", { ok: true, chars: txt.length });
        return true;
      } catch (e) {
        console.warn("[crash-recorder] Clipboard copy failed", e);
        this.log("recorder:copy", { ok: false, error: String(e?.message || e), chars: txt.length });
        return false;
      }
    },

    showInSnapshot() {
      const txt = this.text();
      const pre = document.querySelector("#snapshot");
      if (pre) pre.textContent = txt;
      return txt;
    }
  };

  window.BP_CRASH_RECORDER = api;

  api.log("app:crash-recorder:init", {
    href: location.href,
    visibility: document.visibilityState,
    ua: navigator.userAgent,
    dpr: window.devicePixelRatio || 1,
    viewport: { w: window.innerWidth, h: window.innerHeight }
  });

  window.addEventListener("load", () => api.log("window:load", { href: location.href }));
  window.addEventListener("pageshow", (ev) => api.log("window:pageshow", { persisted: !!ev.persisted, href: location.href }));
  window.addEventListener("pagehide", (ev) => { api.log("window:pagehide", { persisted: !!ev.persisted }); saveState(key, state); });
  window.addEventListener("beforeunload", () => { api.log("window:beforeunload"); saveState(key, state); });
  document.addEventListener("visibilitychange", () => api.log("document:visibilitychange", { visibility: document.visibilityState }));

  window.addEventListener("error", (ev) => {
    api.log("window:error", {
      message: ev.message,
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
      stack: ev.error?.stack || null
    });
    saveState(key, state);
  });

  window.addEventListener("unhandledrejection", (ev) => {
    api.log("window:unhandledrejection", {
      reason: safeString(ev.reason?.stack || ev.reason?.message || ev.reason, 900)
    });
    saveState(key, state);
  });

  saveState(key, state);
  return api;
}
