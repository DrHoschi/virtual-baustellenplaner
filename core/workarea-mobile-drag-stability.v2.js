/**
 * ============================================================================
 * DATEI: /core/workarea-mobile-drag-stability.v2.js
 * VERSION: v2.0.0-hard-low-power-drag
 * STAND: 2026-05-18
 *
 * ZWECK:
 * - Harter Low-Power-Drag-Modus für Safari/iPhone/iPad in der Workarea.
 * - Reduziert während aktivem Drag die UI-/Render-Last.
 * - Verhindert mobile Browser-Gesten auf dem Workarea-Canvas.
 * - Verzögert teure rechte Panel-/Properties-Aktualisierungen während Drag.
 * - Drosselt requestAnimationFrame während Drag auf ca. 18 FPS.
 *
 * WICHTIG:
 * - Diese Datei ist bewusst als eigenständiges Guard-/Patch-Modul gebaut.
 * - Keine Imports, keine Abhängigkeiten, keine direkten App-Imports.
 * - Dadurch kann sie früh in index.html geladen werden.
 *
 * EINBINDUNG IN /index.html:
 * <script type="module" src="./core/workarea-mobile-drag-stability.v2.js?v=2"></script>
 *
 * EMPFOHLENE POSITION:
 * - Nach dem Crash Recorder / Debug-Recorder.
 * - Vor main.js bzw. vor dem eigentlichen App-Start.
 * ============================================================================
 */

(function installWorkareaMobileDragStabilityV2() {
  "use strict";

  const VERSION = "v2.0.0-hard-low-power-drag";
  const GUARD = "mobile-drag-stability-v2";

  // ---------------------------------------------------------------------------
  // KONFIGURATION
  // ---------------------------------------------------------------------------

  const CONFIG = Object.freeze({
    // Nur auf Touch-Geräten aktivieren. Desktop bleibt praktisch unangetastet.
    touchOnly: true,

    // Harte rAF-Drossel während Drag.
    // 55 ms ≈ 18 FPS. Das ist auf iPhone/Safari deutlich entspannter.
    lowPowerFrameMs: 55,

    // Nach pointerup noch kurz im Low-Power-Modus bleiben,
    // damit Safari/DOM/Layout nicht sofort wieder alles gleichzeitig berechnet.
    releaseCooldownMs: 950,

    // Panel-/Properties-Updates erst nach kompletter Drag-Ruhe wieder zulassen.
    panelFlushDelayMs: 850,

    // Doppelte Logs begrenzen.
    maxGlobalInputLogsPerSession: 8,

    // CSS-Klasse am <html>, solange Low-Power aktiv ist.
    htmlClass: "bp-wa-low-power-drag",

    // CSS-Klasse am <html>, wenn generell installiert.
    installedClass: "bp-wa-mobile-drag-v2-installed",
  });

  // ---------------------------------------------------------------------------
  // BASIS-ERKENNUNG
  // ---------------------------------------------------------------------------

  const isBrowser =
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof navigator !== "undefined";

  if (!isBrowser) return;

  const hasTouch =
    "ontouchstart" in window ||
    Number(navigator.maxTouchPoints || 0) > 0 ||
    Number(navigator.msMaxTouchPoints || 0) > 0;

  if (CONFIG.touchOnly && !hasTouch) {
    safeLog("workarea:mobile-drag:skip", {
      version: VERSION,
      guard: GUARD,
      reason: "no-touch-device",
    });
    return;
  }

  if (window.__workareaMobileDragStabilityV2Installed) {
    safeLog("workarea:mobile-drag:skip", {
      version: VERSION,
      guard: GUARD,
      reason: "already-installed",
    });
    return;
  }

  window.__workareaMobileDragStabilityV2Installed = true;

  // ---------------------------------------------------------------------------
  // GLOBALER STATUS
  // ---------------------------------------------------------------------------

  const state = {
    installedAt: Date.now(),

    active: false,
    pointerId: null,
    pointerTarget: null,

    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,

    moveIn: 0,
    movePrevented: 0,

    rafThrottled: 0,
    rafDelayed: 0,
    rafSyntheticId: 1,
    rafTimers: new Map(),
    lastRafRunAt: 0,

    panelDeferred: 0,
    panelFlushTimer: 0,

    releaseTimer: 0,
    lastGestureEndAt: 0,

    globalInputLogs: 0,
  };

  // Für Debug-Konsole / Crash Recorder sichtbar machen.
  window.__workareaLowPowerDrag = state;

  // ---------------------------------------------------------------------------
  // CSS: Touch stabilisieren, Panels im Drag entschärfen
  // ---------------------------------------------------------------------------

  injectCss();

  document.documentElement.classList.add(CONFIG.installedClass);

  // ---------------------------------------------------------------------------
  // requestAnimationFrame während aktivem Drag hart drosseln
  // ---------------------------------------------------------------------------

  patchRequestAnimationFrame();

  // ---------------------------------------------------------------------------
  // Canvas / Workarea Hosts automatisch vorbereiten
  // ---------------------------------------------------------------------------

  prepareExistingCanvases();
  observeCanvasMounts();

  // ---------------------------------------------------------------------------
  // Globale Input-Listener im Capture-Modus
  // ---------------------------------------------------------------------------

  window.addEventListener("pointerdown", onGlobalPointerDownCapture, {
    capture: true,
    passive: false,
  });

  window.addEventListener("pointermove", onGlobalPointerMoveCapture, {
    capture: true,
    passive: false,
  });

  window.addEventListener("pointerup", onGlobalPointerUpCancelCapture, {
    capture: true,
    passive: true,
  });

  window.addEventListener("pointercancel", onGlobalPointerUpCancelCapture, {
    capture: true,
    passive: true,
  });

  window.addEventListener("touchstart", onGlobalTouchStartCapture, {
    capture: true,
    passive: false,
  });

  window.addEventListener("touchmove", onGlobalTouchMoveCapture, {
    capture: true,
    passive: false,
  });

  window.addEventListener("touchend", onGlobalTouchEndCapture, {
    capture: true,
    passive: true,
  });

  window.addEventListener("touchcancel", onGlobalTouchEndCapture, {
    capture: true,
    passive: true,
  });

  // Bei Seitenwechsel sauber markieren.
  window.addEventListener("pagehide", () => {
    safeLog("workarea:mobile-drag:pagehide", {
      guard: GUARD,
      active: state.active,
      pointerId: state.pointerId,
      moveIn: state.moveIn,
      rafThrottled: state.rafThrottled,
      rafDelayed: state.rafDelayed,
      panelDeferred: state.panelDeferred,
    });
  }, { capture: true, passive: true });

  safeLog("workarea:mobile-drag:installed", {
    version: VERSION,
    strategy: "hard-low-power-drag",
    guard: GUARD,
    touch: hasTouch,
    frameMs: CONFIG.lowPowerFrameMs,
    releaseCooldownMs: CONFIG.releaseCooldownMs,
    panelFlushDelayMs: CONFIG.panelFlushDelayMs,
  });

  // ---------------------------------------------------------------------------
  // EVENT-HANDLER
  // ---------------------------------------------------------------------------

  function onGlobalPointerDownCapture(event) {
    logGlobalInput("pointerdown");

    if (!isWorkareaInteractiveTarget(event.target)) {
      return;
    }

    enterLowPowerDrag("pointerdown", event);

    // Pointer-Capture hilft Safari/iOS, die Geste sauber am Canvas zu halten.
    try {
      if (event.target && typeof event.target.setPointerCapture === "function") {
        event.target.setPointerCapture(event.pointerId);
      }
    } catch (_) {
      // Safari kann hier je nach Ziel/Timing werfen. Ignorieren.
    }

    // Native Browser-Aktionen auf der Zeichenfläche verhindern.
    preventIfPossible(event);
  }

  function onGlobalPointerMoveCapture(event) {
    if (!state.active) return;
    if (state.pointerId !== null && event.pointerId !== state.pointerId) return;

    state.moveIn += 1;
    state.lastX = Number(event.clientX || 0);
    state.lastY = Number(event.clientY || 0);

    // Während Drag darf Safari nicht scrollen/zoomen/text-selektieren.
    preventIfPossible(event);
  }

  function onGlobalPointerUpCancelCapture(event) {
    if (!state.active) return;
    if (state.pointerId !== null && event.pointerId !== state.pointerId) return;

    finishLowPowerDrag(event.type, event);
  }

  function onGlobalTouchStartCapture(event) {
    logGlobalInput("touchstart");

    if (!isWorkareaInteractiveTarget(event.target)) return;

    // Ein-Finger-Touch auf Canvas: App-Drag.
    // Zwei-Finger-Touch bleibt möglich für Pinch/Zoom, wird aber ebenfalls
    // gegen Browser-Scroll geschützt.
    if (event.touches && event.touches.length >= 1) {
      preventIfPossible(event);
    }
  }

  function onGlobalTouchMoveCapture(event) {
    if (!state.active && !isWorkareaInteractiveTarget(event.target)) return;

    // Wichtig für iOS Safari:
    // Ohne preventDefault versucht Safari bei Canvas-Bewegung gerne zu scrollen,
    // Adressleiste einzublenden oder Layout/Resize-Kaskaden auszulösen.
    preventIfPossible(event);
  }

  function onGlobalTouchEndCapture() {
    // pointerup macht normalerweise den Abschluss.
    // Dieser Fallback ist nur für Safari-Sonderfälle.
    if (state.active) {
      scheduleRelease("touchend-fallback");
    }
  }

  // ---------------------------------------------------------------------------
  // LOW-POWER DRAG STATUS
  // ---------------------------------------------------------------------------

  function enterLowPowerDrag(reason, event) {
    clearTimeout(state.releaseTimer);

    const alreadyActive = state.active;

    state.active = true;
    state.pointerId = typeof event.pointerId === "number" ? event.pointerId : null;
    state.pointerTarget = event.target || null;

    state.startX = Number(event.clientX || 0);
    state.startY = Number(event.clientY || 0);
    state.lastX = state.startX;
    state.lastY = state.startY;

    if (!alreadyActive) {
      state.moveIn = 0;
      state.movePrevented = 0;
      state.rafThrottled = 0;
      state.rafDelayed = 0;
      state.panelDeferred = 0;
      state.globalInputLogs = 0;
      state.lastRafRunAt = 0;
    }

    document.documentElement.classList.add(CONFIG.htmlClass);

    safeLog("workarea:mobile-drag:low-power-enter", {
      guard: GUARD,
      reason,
      pointerId: state.pointerId,
      target: describeTarget(event.target),
      alreadyActive,
    });
  }

  function finishLowPowerDrag(reason, event) {
    state.lastGestureEndAt = Date.now();

    safeLog("workarea:mobile-drag:pointer-release", {
      guard: GUARD,
      reason,
      pointerId: state.pointerId,
      moveIn: state.moveIn,
      movePrevented: state.movePrevented,
      rafThrottled: state.rafThrottled,
      rafDelayed: state.rafDelayed,
      panelDeferred: state.panelDeferred,
      x: Number(event && event.clientX || 0),
      y: Number(event && event.clientY || 0),
    });

    scheduleRelease(reason);
  }

  function scheduleRelease(reason) {
    clearTimeout(state.releaseTimer);

    // Pointer sofort lösen, Low-Power-Klasse aber noch kurz stehen lassen.
    state.pointerId = null;
    state.pointerTarget = null;

    state.releaseTimer = window.setTimeout(() => {
      state.active = false;
      document.documentElement.classList.remove(CONFIG.htmlClass);

      schedulePanelFlush("release");

      safeLog("workarea:mobile-drag:low-power-exit", {
        guard: GUARD,
        reason,
        moveIn: state.moveIn,
        rafThrottled: state.rafThrottled,
        rafDelayed: state.rafDelayed,
        panelDeferred: state.panelDeferred,
      });
    }, CONFIG.releaseCooldownMs);
  }

  // ---------------------------------------------------------------------------
  // requestAnimationFrame PATCH
  // ---------------------------------------------------------------------------

  function patchRequestAnimationFrame() {
    if (window.__workareaMobileDragRafPatchedV2) return;
    window.__workareaMobileDragRafPatchedV2 = true;

    const nativeRaf = window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : (cb) => window.setTimeout(() => cb(Date.now()), 16);

    const nativeCancel = window.cancelAnimationFrame
      ? window.cancelAnimationFrame.bind(window)
      : (id) => window.clearTimeout(id);

    window.requestAnimationFrame = function patchedRequestAnimationFrame(callback) {
      if (!state.active) {
        return nativeRaf(callback);
      }

      const now = Date.now();
      const since = now - state.lastRafRunAt;

      if (since >= CONFIG.lowPowerFrameMs) {
        state.lastRafRunAt = now;
        return nativeRaf(function runLowPowerFrame(ts) {
          try {
            callback(ts);
          } catch (err) {
            safeLog("workarea:mobile-drag:raf-error", {
              guard: GUARD,
              message: String(err && err.message || err),
              stack: String(err && err.stack || ""),
            });
            throw err;
          }
        });
      }

      state.rafThrottled += 1;
      state.rafDelayed += 1;

      const syntheticId = -state.rafSyntheticId++;
      const delay = Math.max(8, CONFIG.lowPowerFrameMs - since);

      const timer = window.setTimeout(() => {
        state.rafTimers.delete(syntheticId);

        nativeRaf(function runDelayedLowPowerFrame(ts) {
          if (!state.active) {
            callback(ts);
            return;
          }

          state.lastRafRunAt = Date.now();
          try {
            callback(ts);
          } catch (err) {
            safeLog("workarea:mobile-drag:raf-delayed-error", {
              guard: GUARD,
              message: String(err && err.message || err),
              stack: String(err && err.stack || ""),
            });
            throw err;
          }
        });
      }, delay);

      state.rafTimers.set(syntheticId, timer);
      return syntheticId;
    };

    window.cancelAnimationFrame = function patchedCancelAnimationFrame(id) {
      if (typeof id === "number" && id < 0 && state.rafTimers.has(id)) {
        window.clearTimeout(state.rafTimers.get(id));
        state.rafTimers.delete(id);
        return;
      }

      nativeCancel(id);
    };

    safeLog("workarea:mobile-drag:raf-patched", {
      guard: GUARD,
      frameMs: CONFIG.lowPowerFrameMs,
    });
  }

  // ---------------------------------------------------------------------------
  // CANVAS / DOM VORBEREITUNG
  // ---------------------------------------------------------------------------

  function prepareExistingCanvases() {
    const nodes = document.querySelectorAll("canvas, .workarea, [data-panel='workarea'], [data-workarea]");
    nodes.forEach(prepareInteractiveNode);
  }

  function observeCanvasMounts() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (!node || node.nodeType !== 1) continue;

          if (matchesInteractiveNode(node)) {
            prepareInteractiveNode(node);
          }

          if (typeof node.querySelectorAll === "function") {
            node
              .querySelectorAll("canvas, .workarea, [data-panel='workarea'], [data-workarea]")
              .forEach(prepareInteractiveNode);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function prepareInteractiveNode(node) {
    if (!node || node.__bpWaMobileDragPreparedV2) return;
    node.__bpWaMobileDragPreparedV2 = true;

    try {
      node.style.touchAction = "none";
      node.style.webkitUserSelect = "none";
      node.style.userSelect = "none";
      node.style.webkitTouchCallout = "none";
      node.style.overscrollBehavior = "contain";
    } catch (_) {
      // style kann bei exotischen Nodes fehlschlagen. Ignorieren.
    }
  }

  // ---------------------------------------------------------------------------
  // PANEL-FLUSH / PROPERTIES-ENTLASTUNG
  // ---------------------------------------------------------------------------

  function schedulePanelFlush(source) {
    clearTimeout(state.panelFlushTimer);

    state.panelFlushTimer = window.setTimeout(() => {
      safeLog("workarea:mobile-drag:panel-flush", {
        guard: GUARD,
        source,
        panelDeferred: state.panelDeferred,
      });

      // Signal für WorkareaPanel, falls später direkt integriert:
      // Dort kann man auf dieses Event hören und Properties/Inspector aktualisieren.
      try {
        window.dispatchEvent(new CustomEvent("workarea:mobile-drag:flush-panels", {
          detail: {
            guard: GUARD,
            version: VERSION,
            source,
            panelDeferred: state.panelDeferred,
          },
        }));
      } catch (_) {
        // CustomEvent kann in sehr alten Browsern Probleme machen. Ignorieren.
      }
    }, CONFIG.panelFlushDelayMs);
  }

  // ---------------------------------------------------------------------------
  // TARGET-ERKENNUNG
  // ---------------------------------------------------------------------------

  function isWorkareaInteractiveTarget(target) {
    if (!target || typeof target.closest !== "function") {
      return false;
    }

    // Erst direkte Canvas-Treffer.
    if (target.tagName && String(target.tagName).toLowerCase() === "canvas") {
      return isProbablyWorkareaCanvas(target);
    }

    // Dann typische Workarea-Container.
    const host = target.closest(
      [
        ".workarea",
        ".workarea-panel",
        ".workarea-viewport",
        ".wa-viewport",
        ".bp-workarea",
        "[data-panel='workarea']",
        "[data-workarea]",
        "[data-workarea-viewport]",
        "#workarea",
      ].join(",")
    );

    if (!host) return false;

    // Keine Buttons/Inputs im Panel als Drag-Fläche behandeln.
    const interactive = target.closest(
      "button, input, select, textarea, a, [role='button'], [contenteditable='true']"
    );

    if (interactive) return false;

    return true;
  }

  function isProbablyWorkareaCanvas(canvas) {
    if (!canvas) return false;

    const parent = typeof canvas.closest === "function"
      ? canvas.closest(
          [
            ".workarea",
            ".workarea-panel",
            ".workarea-viewport",
            ".wa-viewport",
            ".bp-workarea",
            "[data-panel='workarea']",
            "[data-workarea]",
            "[data-workarea-viewport]",
            "#workarea",
          ].join(",")
        )
      : null;

    // Wenn ein Canvas innerhalb Workarea liegt, sicher aktivieren.
    if (parent) return true;

    // Fallback: Bei nur einem sichtbaren Canvas auf Mobile darf der Guard helfen.
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
    if (rect && rect.width >= 120 && rect.height >= 120) return true;

    return false;
  }

  function matchesInteractiveNode(node) {
    if (!node || !node.matches) return false;
    return node.matches("canvas, .workarea, .workarea-panel, .workarea-viewport, .wa-viewport, [data-panel='workarea'], [data-workarea], [data-workarea-viewport], #workarea");
  }

  // ---------------------------------------------------------------------------
  // CSS
  // ---------------------------------------------------------------------------

  function injectCss() {
    if (document.getElementById("bp-wa-mobile-drag-stability-v2-css")) return;

    const style = document.createElement("style");
    style.id = "bp-wa-mobile-drag-stability-v2-css";
    style.textContent = `
      html.${CONFIG.installedClass} canvas,
      html.${CONFIG.installedClass} .workarea,
      html.${CONFIG.installedClass} .workarea-panel,
      html.${CONFIG.installedClass} .workarea-viewport,
      html.${CONFIG.installedClass} .wa-viewport,
      html.${CONFIG.installedClass} [data-panel="workarea"],
      html.${CONFIG.installedClass} [data-workarea],
      html.${CONFIG.installedClass} [data-workarea-viewport] {
        touch-action: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        overscroll-behavior: contain !important;
      }

      html.${CONFIG.htmlClass},
      html.${CONFIG.htmlClass} body {
        overscroll-behavior: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
      }

      /*
       * Während Drag: rechte/untere Zusatzbereiche nicht layouten/painten,
       * soweit Browser es unterstützt. Keine harte display:none, damit das
       * Layout nicht springt.
       */
      html.${CONFIG.htmlClass} .workarea-right,
      html.${CONFIG.htmlClass} .workarea-properties,
      html.${CONFIG.htmlClass} .wa-right,
      html.${CONFIG.htmlClass} .wa-properties,
      html.${CONFIG.htmlClass} [data-workarea-right],
      html.${CONFIG.htmlClass} [data-workarea-properties],
      html.${CONFIG.htmlClass} [data-panel="workarea-properties"] {
        content-visibility: hidden !important;
        contain: layout style paint !important;
        pointer-events: none !important;
      }

      /*
       * Teure Schatten/Transitions während Drag vermeiden.
       */
      html.${CONFIG.htmlClass} .workarea *,
      html.${CONFIG.htmlClass} .workarea-panel *,
      html.${CONFIG.htmlClass} [data-panel="workarea"] * {
        transition: none !important;
        animation-play-state: paused !important;
      }
    `;

    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // HILFSFUNKTIONEN
  // ---------------------------------------------------------------------------

  function preventIfPossible(event) {
    if (!event || typeof event.preventDefault !== "function") return;

    try {
      if (event.cancelable !== false) {
        event.preventDefault();
        state.movePrevented += 1;
      }
    } catch (_) {
      // iOS kann bei passiven Listenern warnen/werfen. Ignorieren.
    }
  }

  function logGlobalInput(type) {
    if (state.globalInputLogs >= CONFIG.maxGlobalInputLogsPerSession) return;
    state.globalInputLogs += 1;

    safeLog("workarea:mobile-drag:global-input", {
      guard: GUARD,
      type,
      active: state.active,
    });
  }

  function describeTarget(target) {
    if (!target) return "null";

    const tag = target.tagName ? String(target.tagName).toLowerCase() : "node";
    const id = target.id ? `#${target.id}` : "";
    const cls = target.className && typeof target.className === "string"
      ? "." + target.className.trim().split(/\s+/).slice(0, 4).join(".")
      : "";

    return `${tag}${id}${cls}`;
  }

  function safeLog(type, detail) {
    const payload = Object.assign({
      guard: GUARD,
      version: VERSION,
    }, detail || {});

    // 1) Projekt-eigener Recorder, falls vorhanden.
    const candidates = [
      window.__baustellenCrashRecorder,
      window.__crashRecorder,
      window.BaustellenCrashRecorder,
      window.CrashRecorder,
    ];

    for (const rec of candidates) {
      try {
        if (rec && typeof rec.record === "function") {
          rec.record(type, payload);
          return;
        }
        if (rec && typeof rec.log === "function") {
          rec.log(type, payload);
          return;
        }
      } catch (_) {
        // Recorder darf den Guard nie kaputt machen.
      }
    }

    // 2) Globale Hilfsfunktion, falls im Projekt vorhanden.
    try {
      if (typeof window.__bpCrashLog === "function") {
        window.__bpCrashLog(type, payload);
        return;
      }
      if (typeof window.__bpCrashRecord === "function") {
        window.__bpCrashRecord(type, payload);
        return;
      }
      if (typeof window.__recordCrashEvent === "function") {
        window.__recordCrashEvent(type, payload);
        return;
      }
    } catch (_) {
      // Ignorieren.
    }

    // 3) CustomEvent für spätere Integration.
    try {
      window.dispatchEvent(new CustomEvent("bp:crashlog", {
        detail: {
          type,
          payload,
        },
      }));
    } catch (_) {
      // Ignorieren.
    }

    // 4) Console nur sparsam; wird von Playwright/Recorder oft mitgelesen.
    try {
      if (window.localStorage && window.localStorage.getItem("bp:verboseDragGuard") === "1") {
        console.debug(`[${GUARD}] ${type}`, payload);
      }
    } catch (_) {
      // Ignorieren.
    }
  }
})();
