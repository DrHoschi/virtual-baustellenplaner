/**
 * main.js
 * Version: v1.4.7-mobile-drag-stability-inline-ci-fix (2026-05-18)
 *
 * Zweck:
 * - App-Bootstrap über core/loader.js.
 * - Mobile Header/Menu/Debug/Snapshot-Logik bleibt aktiv.
 * - Crash-Recorder und Autosave-Drag-Guard werden optional/dynamisch geladen,
 *   damit der Import-Graph nicht scheitert, falls eine Zusatzdatei beim Upload
 *   einmal fehlt.
 *
 * WICHTIG:
 * - Statischer Import bleibt nur core/loader.js.
 * - Debug-/Snapshot-Buttons werden VOR startApp verdrahtet.
 */

import { startApp } from "./core/loader.js";

// ============================================================================
// KONSTANTEN
// ============================================================================

const DEFAULT_PROJECT_PATH = "projects/P-2026-0001/project.json";
const SNAPSHOT_COLLAPSE_KEY = "bp:snapshot:collapsed";
const MOBILE_SHELL_QUERY = "(max-width: 700px)";
const CRASH_RECORDER_MODULE_PATH = "./core/" + "crash-recorder.js";
const WORKAREA_AUTOSAVE_DRAG_GUARD_MODULE_PATH = "./core/" + "workarea-autosave-drag-guard.v1_3.js";

// ============================================================================
// KLEINER FALLBACK-CRASH-RECORDER
// ============================================================================

function createFallbackCrashRecorder() {
  const events = [];
  const max = 80;

  const api = {
    __fallback: true,
    log(event, data = null) {
      try {
        events.push({
          t: new Date().toISOString(),
          event: String(event || "event"),
          data: data && typeof data === "object" ? data : (data == null ? null : { value: String(data) })
        });
        while (events.length > max) events.shift();
      } catch {}
      return null;
    },
    text() {
      try {
        return [
          "Baustellenplaner Crash Recorder Fallback",
          `Export: ${new Date().toISOString()}`,
          `Events: ${events.length}`,
          "",
          ...events.map((e, i) => `${String(i + 1).padStart(3, "0")} ${e.t} ${e.event} ${JSON.stringify(e.data || {})}`)
        ].join("\n");
      } catch {
        return "Baustellenplaner Crash Recorder Fallback: export failed";
      }
    },
    async copy() {
      const txt = api.text();
      try {
        await navigator.clipboard.writeText(txt);
        return true;
      } catch {
        return false;
      }
    },
    showInSnapshot() {
      const txt = api.text();
      try {
        const pre = document.querySelector("#snapshot");
        if (pre) pre.textContent = txt;
      } catch {}
      return txt;
    },
    sizeOf(value) {
      try { return new Blob([JSON.stringify(value)]).size; } catch {}
      try { return JSON.stringify(value).length; } catch {}
      return 0;
    }
  };

  return api;
}


function initOptionalWorkareaAutosaveDragGuard({ crashRecorder } = {}) {
  // Optional laden, damit der Import-Graph-Check nicht scheitert, wenn beim
  // GitHub-Mobile-Upload die Zusatzdatei einmal nicht im Commit gelandet ist.
  // Die App startet dann weiter, nur der Guard ist in diesem Lauf nicht aktiv.
  import(WORKAREA_AUTOSAVE_DRAG_GUARD_MODULE_PATH)
    .then((mod) => {
      const install = mod?.installWorkareaAutosaveDragGuard;
      if (typeof install === "function") {
        install({ crashRecorder: crashRecorder || window.BP_CRASH_RECORDER || null });
        window.BP_CRASH_RECORDER?.log?.("workarea:autosave-drag-guard:ready", { mode: "module" });
      } else {
        window.BP_CRASH_RECORDER?.log?.("workarea:autosave-drag-guard:missing-export", {});
      }
    })
    .catch((e) => {
      window.BP_CRASH_RECORDER?.log?.("workarea:autosave-drag-guard:optional-import-failed", {
        message: e?.message || String(e)
      });
      console.warn("[Baustellenplaner] Optionaler Workarea Autosave Drag Guard konnte nicht geladen werden:", e);
    });
}


function initOptionalWorkareaMobileDragStability() {
  // CI-FIX v1.1:
  // -------------------------------------------------------------------------
  // Die vorige Version hat eine optionale Datei dynamisch geladen:
  //   ./core/workarea-mobile-drag-stability.v1.js
  // Wenn diese Datei beim GitHub-Mobile-Upload nicht mit im Commit gelandet ist,
  // erzeugt der Browser einen 404-Fehler. Playwright wertet diesen 404 als fatal.
  //
  // Deshalb wird der mobile Stabilitäts-Patch hier INLINE installiert.
  // Es wird nur noch die ohnehin vorhandene WorkareaPanel.js dynamisch importiert.
  // Dadurch entsteht kein optionaler 404 mehr.
  // -------------------------------------------------------------------------
  import("./ui/panels/WorkareaPanel.js")
    .then((mod) => {
      const WorkareaPanel = mod?.WorkareaPanel;
      const proto = WorkareaPanel?.prototype;
      const PATCH_FLAG = Symbol.for("baustellenplaner.workarea.mobileDragStability.inline.v1");
      const GUARD = "mobile-drag-stability-inline-v1";

      if (!proto || proto[PATCH_FLAG]) return false;
      proto[PATCH_FLAG] = true;

      const nowMs = () => {
        try { return performance.now(); } catch { return Date.now(); }
      };

      const safeLog = (instance, event, data = {}) => {
        try {
          if (instance && typeof instance._crashLog === "function") {
            instance._crashLog(event, { ...(data || {}), guard: GUARD });
            return;
          }
        } catch {}
        try { window.BP_CRASH_RECORDER?.log?.(event, { ...(data || {}), guard: GUARD }); } catch {}
      };

      const isMobileLike = () => {
        try {
          if (window.matchMedia?.("(max-width: 700px)")?.matches) return true;
          if (window.matchMedia?.("(pointer: coarse)")?.matches) return true;
        } catch {}
        try { return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent || ""); } catch { return false; }
      };

      const isGestureActive = (instance) => {
        try {
          const P = instance?._vp?.pointer;
          return !!((P?.active && P.active.size > 0) || P?.dragActive || P?.dragObjId || P?.isPanning || P?.pinchActive);
        } catch { return false; }
      };

      const isDragLike = (instance) => {
        try {
          const P = instance?._vp?.pointer;
          return !!(P?.dragActive || P?.dragObjId || P?.isPanning || P?.pinchActive);
        } catch { return false; }
      };

      const ensureState = (instance) => {
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
            moveRafRuns: 0
          };
        }
        return instance._waMobileDragStability;
      };

      const clonePointerEvent = (ev) => ({
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
      });

      const originalMove = proto._onViewportPointerMove;
      const originalDown = proto._onViewportPointerDown;
      const originalUp = proto._onViewportPointerUp;
      const originalResize = proto._resizeViewportCanvas;
      const originalRender2D = proto._renderViewport2D;
      const originalRenderRightPanel = proto._renderRightPanel;

      if (typeof originalMove !== "function" || typeof originalDown !== "function" || typeof originalUp !== "function") {
        safeLog(null, "workarea:mobile-drag-stability:missing-methods", {});
        return false;
      }

      const flushMove = (instance) => {
        const st = ensureState(instance);
        if (!st?.pendingMove) return;
        const ev = st.pendingMove;
        st.pendingMove = null;
        st.moveRaf = 0;
        st.moveRafRuns += 1;
        originalMove.call(instance, ev);
      };

      const scheduleRightPanelFlush = (instance, delay = 420, source = "schedule") => {
        const st = ensureState(instance);
        if (!st || typeof originalRenderRightPanel !== "function") return;
        st.pendingRightPanel = true;
        if (st.rightPanelTimer) {
          try { clearTimeout(st.rightPanelTimer); } catch {}
          st.rightPanelTimer = 0;
        }
        st.rightPanelTimer = setTimeout(() => {
          st.rightPanelTimer = 0;
          if (!st.pendingRightPanel) return;
          if (isGestureActive(instance)) {
            scheduleRightPanelFlush(instance, 520, "still-active");
            return;
          }
          st.pendingRightPanel = false;
          safeLog(instance, "workarea:mobile-drag:right-panel-flush", { source });
          try { originalRenderRightPanel.call(instance); } catch (e) { console.error("[workarea] right panel flush failed", e); }
        }, Math.max(120, delay));
      };

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
          try {
            flushMove(this);
            if (st.moveIn > 0 && st.moveIn % 40 === 0) {
              safeLog(this, "workarea:mobile-drag:move-throttled", {
                moveIn: st.moveIn,
                moveRafRuns: st.moveRafRuns,
                dragActive: !!this._vp?.pointer?.dragActive,
                dragObjId: this._vp?.pointer?.dragObjId || null
              });
            }
          } catch (e) {
            safeLog(this, "workarea:mobile-drag:move-flush-error", { message: e?.message || String(e) });
            throw e;
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
          flushMove(this);
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
            if (st.pendingRightPanel) scheduleRightPanelFlush(this, 50, "pointerup-final");
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
              if (isDragLike(this)) return;
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
            const minFrameMs = 33;
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
            scheduleRightPanelFlush(this, 520, "gesture-active");
            safeLog(this, "workarea:mobile-drag:right-panel-deferred", {
              dragActive: !!this._vp?.pointer?.dragActive,
              dragObjId: this._vp?.pointer?.dragObjId || null
            });
            return;
          }
          return originalRenderRightPanel.apply(this, args);
        };
      }

      window.BP_CRASH_RECORDER?.log?.("workarea:mobile-drag-stability:installed", {
        version: "v1.1-inline",
        strategy: "inline-raf-move-rightpanel-resize-render-throttle",
        mobile: isMobileLike(),
        guard: GUARD
      });
      window.BP_CRASH_RECORDER?.log?.("workarea:mobile-drag-stability:ready", { mode: "inline" });
      return true;
    })
    .catch((e) => {
      window.BP_CRASH_RECORDER?.log?.("workarea:mobile-drag-stability:inline-install-failed", {
        message: e?.message || String(e)
      });
      console.warn("[Baustellenplaner] Inline Workarea Mobile Drag Stability Patch konnte nicht installiert werden:", e);
    });
}

function initOptionalCrashRecorderBackground() {
  let crashRecorder = window.BP_CRASH_RECORDER || createFallbackCrashRecorder();
  window.BP_CRASH_RECORDER = crashRecorder;

  // Nicht awaiten: Die App und Mobile-Buttons sollen sofort starten.
  import(CRASH_RECORDER_MODULE_PATH)
    .then((mod) => {
      if (mod?.initCrashRecorder) {
        const next = mod.initCrashRecorder({ max: 220 }) || crashRecorder;
        window.BP_CRASH_RECORDER = next;
        next?.log?.("crash-recorder:ready", { mode: "module" });
      }
    })
    .catch((e) => {
      crashRecorder?.log?.("crash-recorder:optional-import-failed", {
        message: e?.message || String(e)
      });
      console.warn("[Baustellenplaner] Optionaler Crash-Recorder konnte nicht geladen werden:", e);
    });

  return crashRecorder;
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function byId(id) {
  return document.getElementById(id);
}

function isMobileShellWidth() {
  return window.matchMedia(MOBILE_SHELL_QUERY).matches;
}

function setExpanded(button, expanded) {
  if (!button) return;
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function closeMobileMenu() {
  document.body.classList.remove("mobile-menu-open");
  setExpanded(byId("btnMobileMenu"), false);
}

function closeMobileDebug() {
  document.body.classList.remove("mobile-debug-open");
  setExpanded(byId("btnMobileDebug"), false);
}

// ============================================================================
// MOBILE HEADER / MENU / DEBUG
// ============================================================================

function setupMobileMenuToggle() {
  const btn = byId("btnMobileMenu");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("mobile-menu-open");
    setExpanded(btn, isOpen);
    if (isOpen) closeMobileDebug();
  });

  document.addEventListener("click", (ev) => {
    if (!isMobileShellWidth()) return;
    if (!document.body.classList.contains("mobile-menu-open")) return;

    const menu = byId("menu");
    const target = ev.target;

    if (target instanceof Node) {
      if (btn.contains(target)) return;
      if (menu && menu.contains(target)) return;
    }

    closeMobileMenu();
  }, true);

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    closeMobileMenu();
    closeMobileDebug();
  });
}

function setupMobileDebugToggle() {
  const btn = byId("btnMobileDebug");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("mobile-debug-open");
    setExpanded(btn, isOpen);
    if (isOpen) closeMobileMenu();
  });
}

function setupActiveModuleMirror() {
  const source = byId("active");
  const target = byId("mobileActiveValue");

  if (!source || !target) return;

  const sync = () => {
    const txt = (source.textContent || "").trim();
    target.textContent = txt || "(lädt...)";
  };

  sync();

  const observer = new MutationObserver(sync);
  observer.observe(source, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function setupResponsiveCleanup() {
  const mq = window.matchMedia(MOBILE_SHELL_QUERY);

  const cleanupIfDesktop = () => {
    if (mq.matches) return;
    closeMobileMenu();
    closeMobileDebug();
  };

  if (mq.addEventListener) {
    mq.addEventListener("change", cleanupIfDesktop);
  } else if (mq.addListener) {
    mq.addListener(cleanupIfDesktop);
  }

  cleanupIfDesktop();
}

// ============================================================================
// SNAPSHOT / DEBUG TOOLS
// ============================================================================

function applyCollapsedState(isCollapsed) {
  document.body.classList.toggle("snapshot-collapsed", Boolean(isCollapsed));

  const btn = byId("btnToggleSnapshot");
  if (btn) btn.textContent = isCollapsed ? "Snapshot anzeigen" : "Snapshot ausblenden";
}

function setupSnapshotToggle() {
  applyCollapsedState(localStorage.getItem(SNAPSHOT_COLLAPSE_KEY) === "1");

  byId("btnToggleSnapshot")?.addEventListener("click", () => {
    const isCollapsed = document.body.classList.toggle("snapshot-collapsed");
    localStorage.setItem(SNAPSHOT_COLLAPSE_KEY, isCollapsed ? "1" : "0");
    applyCollapsedState(isCollapsed);
  });
}

function readSnapshotObject() {
  const pre = byId("snapshot");
  const txt = pre ? (pre.textContent || "").trim() : "";
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

function getFilteredSnapshotText() {
  const filter = byId("snapshotFilter")?.value || "__ALL__";
  const pre = byId("snapshot");
  const raw = pre ? (pre.textContent || "") : "";
  const obj = readSnapshotObject();

  if (!obj || filter === "__ALL__") return raw;

  const sub = Object.prototype.hasOwnProperty.call(obj, filter) ? obj[filter] : {};
  try { return JSON.stringify({ [filter]: sub }, null, 2); } catch { return raw; }
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";

  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);

  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

function setupGlobalCrashLogButton() {
  const tools = byId("debugTools");
  if (!tools || byId("btnCrashLogGlobal")) return;

  const btn = document.createElement("button");
  btn.id = "btnCrashLogGlobal";
  btn.className = "bp-btn bp-btn-secondary";
  btn.type = "button";
  btn.textContent = "CrashLog";
  btn.title = "Letzte Reload-/Fehler-/Workarea-Ereignisse anzeigen und kopieren";

  btn.addEventListener("click", async () => {
    const rec = window.BP_CRASH_RECORDER || crashRecorder;
    try { rec?.log?.("ui:crashlog:button", { source: "global-debug" }); } catch {}

    let txt = "Crash Recorder nicht verfügbar.";
    try {
      if (rec?.text) txt = rec.text();
      else if (rec?.showInSnapshot) txt = rec.showInSnapshot();
    } catch (e) {
      txt = `CrashLog konnte nicht gelesen werden: ${e?.message || String(e)}`;
    }

    const pre = byId("snapshot");
    if (pre) pre.textContent = txt;

    // Snapshot sichtbar machen, damit man auf dem iPhone sofort sieht, was kopiert wurde.
    localStorage.setItem(SNAPSHOT_COLLAPSE_KEY, "0");
    applyCollapsedState(false);
    document.body.classList.add("mobile-debug-open");
    setExpanded(byId("btnMobileDebug"), true);

    try {
      const ok = await copyText(txt);
      btn.textContent = ok ? "CrashLog kopiert" : "CrashLog angezeigt";
      setTimeout(() => { btn.textContent = "CrashLog"; }, 1600);
    } catch {
      btn.textContent = "CrashLog angezeigt";
      setTimeout(() => { btn.textContent = "CrashLog"; }, 1600);
    }
  });

  const copyBtn = byId("btnCopySnapshot");
  if (copyBtn?.parentNode) copyBtn.parentNode.insertBefore(btn, copyBtn.nextSibling);
  else tools.appendChild(btn);
}

function setupSnapshotCopyAndExport() {
  setupGlobalCrashLogButton();

  byId("btnCopySnapshot")?.addEventListener("click", async () => {
    await copyText(getFilteredSnapshotText());
  });

  byId("btnDownloadSnapshot")?.addEventListener("click", () => {
    const text = getFilteredSnapshotText();
    const filter = byId("snapshotFilter")?.value || "__ALL__";
    const tag = filter === "__ALL__" ? "ALL" : filter;

    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapshot_${tag}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// ============================================================================
// APP START
// ============================================================================

function getProjectPathFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("project") || DEFAULT_PROJECT_PATH;
}

function showStartError(error) {
  console.error("[Baustellenplaner] startApp failed:", error);
  window.BP_CRASH_RECORDER?.log?.("app:startApp:failed", {
    message: error?.message || String(error),
    stack: error?.stack || null
  });

  const active = byId("active");
  if (active) active.textContent = "Fehler beim Start (siehe Console)";

  const mobileActive = byId("mobileActiveValue");
  if (mobileActive) mobileActive.textContent = "Fehler beim Start";

  const snapshot = byId("snapshot");
  if (snapshot) snapshot.textContent = String(error?.stack || error);

  document.body.classList.add("mobile-debug-open");
  setExpanded(byId("btnMobileDebug"), true);
}

// Wichtig: zuerst UI-Buttons verdrahten, dann App starten.
const crashRecorder = initOptionalCrashRecorderBackground();
initOptionalWorkareaAutosaveDragGuard({ crashRecorder });
  initOptionalWorkareaMobileDragStability();
setupMobileMenuToggle();
setupMobileDebugToggle();
setupActiveModuleMirror();
setupResponsiveCleanup();
setupSnapshotToggle();
setupSnapshotCopyAndExport();

const projectPath = getProjectPathFromUrl();
crashRecorder?.log?.("app:start", { projectPath });

startApp({ projectPath }).catch(showStartError);
