/* ==========================================================================
 * DATEI: /core/workarea-mobile-drag-stability.v2.js
 * VERSION: v2.1.1-bind-real-handlers-bp-log
 * STAND: 2026-05-18
 *
 * PATCH:
 * PATCH_workarea_mobile_drag_stability_v2_1_bind_real_handlers
 *
 * ZWECK:
 * - Mobile/iOS Drag-Stabilisierung für die Workarea.
 * - Bindet sich bewusst an echte WorkareaPanel-Handler.
 * - Reduziert Render-/Panel-/Save-Druck während schneller Touch-Drags.
 *
 * WICHTIG:
 * - Diese Datei ist bewusst defensiv geschrieben.
 * - Wenn die erwarteten Methoden nicht gefunden werden, schreibt sie
 *   eindeutige "patch-miss"-Logs in den Crash Recorder.
 * - Erst wenn im Crashlog "workarea:mobile-drag:pointerdown" und
 *   "workarea:mobile-drag:low-power-enter" erscheinen, wissen wir:
 *   Der Patch greift wirklich in den Drag-Ablauf ein.
 * ========================================================================== */

(() => {
  "use strict";

  const PATCH_NAME = "mobile-drag-stability";
  const PATCH_VERSION = "v2.1.1-bind-real-handlers-bp-log";
  const GUARD = "mobile-drag-stability-v2.1";

  const GLOBAL_KEY = "__BAUSTELLENPLANER_MOBILE_DRAG_STABILITY_V2_1__";

  if (window[GLOBAL_KEY]) {
    safeLog("workarea:mobile-drag-stability:already-installed", {
      version: PATCH_VERSION,
      guard: GUARD,
    });
    return;
  }

  window[GLOBAL_KEY] = {
    installedAt: new Date().toISOString(),
    version: PATCH_VERSION,
  };

  /* ------------------------------------------------------------------------
   * Kleine Hilfsfunktionen
   * --------------------------------------------------------------------- */

  function safeLog(type, detail = {}) {
    try {
      const payload = {
        ...detail,
        guard: GUARD,
      };

      if (typeof window.__bpCrashLog === "function") {
        window.__bpCrashLog(type, payload);
        return;
      }

      if (window.BP_CRASH_RECORDER && typeof window.BP_CRASH_RECORDER.log === "function") {
        window.BP_CRASH_RECORDER.log(type, payload);
        return;
      }

      if (window.BaustellenplanerCrashRecorder?.log) {
        window.BaustellenplanerCrashRecorder.log(type, payload);
        return;
      }

      if (window.__crashRecorder?.log) {
        window.__crashRecorder.log(type, payload);
        return;
      }

      console.log(`[${PATCH_NAME}] ${type}`, payload);
    } catch {
      // Logging darf niemals die App beschädigen.
    }
  }

  function isProbablyMobile() {
    try {
      const ua = String(navigator.userAgent || "");
      const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
      const touch = navigator.maxTouchPoints > 0;
      return /iPhone|iPad|iPod|Android/i.test(ua) || coarse || touch;
    } catch {
      return true;
    }
  }

  function getPanelInfo(instance) {
    try {
      return {
        panel: "workarea",
        mode: instance?._mode || instance?.mode || "unknown",
        objects: Array.isArray(instance?._objects)
          ? instance._objects.length
          : Array.isArray(instance?.objects)
            ? instance.objects.length
            : undefined,
      };
    } catch {
      return {
        panel: "workarea",
      };
    }
  }

  function isDragActive(instance) {
    return Boolean(
      instance?._dragActive ||
      instance?._drag?.active ||
      instance?._dragState?.active ||
      instance?._activeDrag ||
      instance?._dragObjId
    );
  }

  function getDragObjId(instance) {
    return (
      instance?._dragObjId ||
      instance?._drag?.id ||
      instance?._drag?.objId ||
      instance?._dragState?.id ||
      instance?._activeDrag?.id ||
      null
    );
  }

  function setLowPower(instance, active, source) {
    try {
      if (!instance) return;

      if (!instance.__mobileDragStability) {
        instance.__mobileDragStability = {
          lowPower: false,
          pointerId: null,
          moveIn: 0,
          moveRafRuns: 0,
          skippedRenders: 0,
          finalRenderTimer: null,
        };
      }

      const state = instance.__mobileDragStability;

      if (active && !state.lowPower) {
        state.lowPower = true;
        state.moveIn = 0;
        state.moveRafRuns = 0;
        state.skippedRenders = 0;

        safeLog("workarea:mobile-drag:low-power-enter", {
          ...getPanelInfo(instance),
          source,
          dragActive: isDragActive(instance),
          dragObjId: getDragObjId(instance),
        });
      }

      if (!active && state.lowPower) {
        state.lowPower = false;

        safeLog("workarea:mobile-drag:low-power-leave", {
          ...getPanelInfo(instance),
          source,
          dragActive: isDragActive(instance),
          dragObjId: getDragObjId(instance),
          moveIn: state.moveIn,
          moveRafRuns: state.moveRafRuns,
          skippedRenders: state.skippedRenders,
        });
      }
    } catch (err) {
      safeLog("workarea:mobile-drag:low-power-error", {
        message: err?.message || String(err),
      });
    }
  }

  function scheduleFinalRender(instance, source) {
    try {
      const state = instance?.__mobileDragStability;
      if (!state) return;

      if (state.finalRenderTimer) {
        clearTimeout(state.finalRenderTimer);
      }

      state.finalRenderTimer = setTimeout(() => {
        try {
          if (typeof instance._requestRender === "function") {
            instance._requestRender();
          } else if (typeof instance.requestRender === "function") {
            instance.requestRender();
          } else if (typeof instance._render === "function") {
            instance._render();
          } else if (typeof instance.render === "function") {
            instance.render();
          }

          safeLog("workarea:mobile-drag:final-render", {
            ...getPanelInfo(instance),
            source,
            moveIn: state.moveIn,
            moveRafRuns: state.moveRafRuns,
            skippedRenders: state.skippedRenders,
          });
        } catch (err) {
          safeLog("workarea:mobile-drag:final-render-error", {
            ...getPanelInfo(instance),
            message: err?.message || String(err),
          });
        }
      }, 180);
    } catch {
      // Keine harte Abhängigkeit.
    }
  }

  function shouldThrottleRender(instance) {
    const state = instance?.__mobileDragStability;
    return Boolean(state?.lowPower);
  }

  /* ------------------------------------------------------------------------
   * Patch-Helfer für Prototyp-Methoden
   * --------------------------------------------------------------------- */

  function patchMethod(proto, methodName, wrapperFactory) {
    if (!proto || typeof proto[methodName] !== "function") {
      return false;
    }

    const original = proto[methodName];

    if (original.__mobileDragStabilityPatchedV21) {
      return true;
    }

    const wrapped = wrapperFactory(original, methodName);

    wrapped.__mobileDragStabilityPatchedV21 = true;
    wrapped.__mobileDragStabilityOriginal = original;

    proto[methodName] = wrapped;
    return true;
  }

  function findWorkareaPanelConstructor() {
    const candidates = [
      window.WorkareaPanel,
      window.BaustellenplanerWorkareaPanel,
      window.AppWorkareaPanel,
      window.__WorkareaPanel,
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (candidate?.prototype) return candidate;
    }

    return null;
  }

  function findWorkareaPanelPrototype() {
    const ctor = findWorkareaPanelConstructor();

    if (ctor?.prototype) {
      return {
        proto: ctor.prototype,
        source: "global-constructor",
        name: ctor.name || "WorkareaPanel",
      };
    }

    return {
      proto: null,
      source: "not-found",
      name: null,
    };
  }

  /* ------------------------------------------------------------------------
   * Eigentliche Handler-Patches
   * --------------------------------------------------------------------- */

  function installOnPrototype(proto, sourceName) {
    const results = {};

    results.pointerDown =
      patchMethod(proto, "_onViewportPointerDown", (original) => {
        return function patchedPointerDown(ev, ...rest) {
          const info = getPanelInfo(this);

          try {
            if (isProbablyMobile()) {
              if (!this.__mobileDragStability) {
                this.__mobileDragStability = {};
              }

              this.__mobileDragStability.pointerId = ev?.pointerId ?? null;
              this.__mobileDragStability.lastPointerDownAt = performance.now();

              safeLog("workarea:mobile-drag:pointerdown", {
                ...info,
                pointerId: ev?.pointerId ?? null,
                source: "_onViewportPointerDown",
              });
            }
          } catch {
            // Pointerdown darf nie blockiert werden.
          }

          return original.call(this, ev, ...rest);
        };
      }) ||
      patchMethod(proto, "onViewportPointerDown", (original) => {
        return function patchedPointerDownFallback(ev, ...rest) {
          safeLog("workarea:mobile-drag:pointerdown", {
            ...getPanelInfo(this),
            pointerId: ev?.pointerId ?? null,
            source: "onViewportPointerDown",
          });

          return original.call(this, ev, ...rest);
        };
      });

    results.pointerMove =
      patchMethod(proto, "_onViewportPointerMove", (original) => {
        return function patchedPointerMove(ev, ...rest) {
          try {
            if (isProbablyMobile()) {
              if (!this.__mobileDragStability) {
                this.__mobileDragStability = {};
              }

              const state = this.__mobileDragStability;
              state.moveIn = (state.moveIn || 0) + 1;

              const dragActiveBefore = isDragActive(this);

              if (dragActiveBefore || getDragObjId(this)) {
                setLowPower(this, true, "_onViewportPointerMove-before");
              }
            }
          } catch {
            // Move darf nicht blockiert werden.
          }

          const result = original.call(this, ev, ...rest);

          try {
            if (isProbablyMobile()) {
              const dragActiveAfter = isDragActive(this);

              if (dragActiveAfter || getDragObjId(this)) {
                setLowPower(this, true, "_onViewportPointerMove-after");
              }
            }
          } catch {
            // Nichts.
          }

          return result;
        };
      }) ||
      patchMethod(proto, "onViewportPointerMove", (original) => {
        return function patchedPointerMoveFallback(ev, ...rest) {
          if (this.__mobileDragStability) {
            this.__mobileDragStability.moveIn =
              (this.__mobileDragStability.moveIn || 0) + 1;
          }

          setLowPower(this, true, "onViewportPointerMove");

          return original.call(this, ev, ...rest);
        };
      });

    results.pointerUp =
      patchMethod(proto, "_onViewportPointerUp", (original) => {
        return function patchedPointerUp(ev, ...rest) {
          const info = getPanelInfo(this);
          const beforeActive = isDragActive(this);
          const beforeObjId = getDragObjId(this);

          safeLog("workarea:mobile-drag:pointerup-before", {
            ...info,
            pointerId: ev?.pointerId ?? null,
            dragActive: beforeActive,
            dragObjId: beforeObjId,
            source: "_onViewportPointerUp",
          });

          const result = original.call(this, ev, ...rest);

          try {
            const state = this.__mobileDragStability || {};

            safeLog("workarea:mobile-drag:pointerup", {
              ...getPanelInfo(this),
              pointerId: ev?.pointerId ?? null,
              dragActiveBefore: beforeActive,
              dragObjIdBefore: beforeObjId,
              moveIn: state.moveIn || 0,
              moveRafRuns: state.moveRafRuns || 0,
              skippedRenders: state.skippedRenders || 0,
              source: "_onViewportPointerUp",
            });

            setLowPower(this, false, "_onViewportPointerUp");
            scheduleFinalRender(this, "_onViewportPointerUp");
          } catch {
            // Nichts.
          }

          return result;
        };
      }) ||
      patchMethod(proto, "onViewportPointerUp", (original) => {
        return function patchedPointerUpFallback(ev, ...rest) {
          const result = original.call(this, ev, ...rest);

          safeLog("workarea:mobile-drag:pointerup", {
            ...getPanelInfo(this),
            pointerId: ev?.pointerId ?? null,
            source: "onViewportPointerUp",
          });

          setLowPower(this, false, "onViewportPointerUp");
          scheduleFinalRender(this, "onViewportPointerUp");

          return result;
        };
      });

    /* ----------------------------------------------------------------------
     * Render-Drosselung:
     * Während Low-Power-Drag darf nicht jede Bewegung volle UI-Arbeit auslösen.
     * ------------------------------------------------------------------- */

    results.requestRender =
      patchMethod(proto, "_requestRender", (original) => {
        return function patchedRequestRender(...args) {
          const state = this.__mobileDragStability;

          if (shouldThrottleRender(this)) {
            if (!state.renderQueued) {
              state.renderQueued = true;

              requestAnimationFrame(() => {
                state.renderQueued = false;
                state.moveRafRuns = (state.moveRafRuns || 0) + 1;

                try {
                  original.apply(this, args);
                } catch (err) {
                  safeLog("workarea:mobile-drag:raf-render-error", {
                    ...getPanelInfo(this),
                    message: err?.message || String(err),
                  });
                }
              });
            } else {
              state.skippedRenders = (state.skippedRenders || 0) + 1;
            }

            return;
          }

          return original.apply(this, args);
        };
      }) ||
      patchMethod(proto, "requestRender", (original) => {
        return function patchedRequestRenderFallback(...args) {
          const state = this.__mobileDragStability;

          if (shouldThrottleRender(this)) {
            if (!state.renderQueued) {
              state.renderQueued = true;

              requestAnimationFrame(() => {
                state.renderQueued = false;
                state.moveRafRuns = (state.moveRafRuns || 0) + 1;
                original.apply(this, args);
              });
            } else {
              state.skippedRenders = (state.skippedRenders || 0) + 1;
            }

            return;
          }

          return original.apply(this, args);
        };
      });

    /* ----------------------------------------------------------------------
     * Rechte Panel-/Inspector-/Details-Aktualisierung während Drag verzögern.
     * Diese Methodennamen sind bewusst breit gefasst.
     * Wenn sie nicht existieren, wird nichts beschädigt.
     * ------------------------------------------------------------------- */

    const panelUpdateMethods = [
      "_renderRightPanel",
      "_updateRightPanel",
      "_renderSelectionPanel",
      "_updateSelectionPanel",
      "_renderInspector",
      "_updateInspector",
      "_syncSelectionUi",
      "_renderProperties",
      "_updateProperties",
    ];

    let panelPatchCount = 0;

    for (const name of panelUpdateMethods) {
      const patched = patchMethod(proto, name, (original, methodName) => {
        return function patchedPanelUpdate(...args) {
          if (shouldThrottleRender(this)) {
            const state = this.__mobileDragStability;
            state.skippedPanelUpdates = (state.skippedPanelUpdates || 0) + 1;
            state.pendingPanelUpdate = {
              original,
              args,
              methodName,
            };

            safeLog("workarea:mobile-drag:right-panel-deferred", {
              ...getPanelInfo(this),
              methodName,
              dragActive: isDragActive(this),
              dragObjId: getDragObjId(this),
            });

            return;
          }

          return original.apply(this, args);
        };
      });

      if (patched) panelPatchCount += 1;
    }

    results.panelPatchCount = panelPatchCount;

    safeLog("workarea:mobile-drag:prototype-patched", {
      version: PATCH_VERSION,
      source: sourceName,
      methods: results,
    });

    return results;
  }

  /* ------------------------------------------------------------------------
   * Fallback: Wiederholt suchen, falls WorkareaPanel erst später global wird.
   * --------------------------------------------------------------------- */

  function installWithRetry() {
    let attempts = 0;
    const maxAttempts = 80;

    const timer = setInterval(() => {
      attempts += 1;

      const found = findWorkareaPanelPrototype();

      if (found.proto) {
        clearInterval(timer);

        const results = installOnPrototype(found.proto, found.source);

        const anyHandler =
          results.pointerDown || results.pointerMove || results.pointerUp;

        if (!anyHandler) {
          safeLog("workarea:mobile-drag:patch-miss", {
            version: PATCH_VERSION,
            reason: "prototype-found-but-no-handler-methods",
            source: found.source,
            name: found.name,
            availableMethods: Object.getOwnPropertyNames(found.proto).filter(
              (key) => typeof found.proto[key] === "function"
            ),
          });
        }

        return;
      }

      if (attempts === 1 || attempts === 10 || attempts === 30) {
        safeLog("workarea:mobile-drag:waiting-for-workarea-panel", {
          version: PATCH_VERSION,
          attempt: attempts,
        });
      }

      if (attempts >= maxAttempts) {
        clearInterval(timer);

        safeLog("workarea:mobile-drag:patch-miss", {
          version: PATCH_VERSION,
          reason: "WorkareaPanel-constructor-not-found",
          attempts,
          globals: Object.keys(window)
            .filter((key) => /workarea/i.test(key))
            .slice(0, 50),
        });
      }
    }, 250);
  }

  /* ------------------------------------------------------------------------
   * Öffentliche Diagnosefunktion
   * --------------------------------------------------------------------- */

  window.__bpMobileDragStabilityV21 = {
    version: PATCH_VERSION,
    guard: GUARD,
    reinstall: installWithRetry,
  };

  safeLog("workarea:mobile-drag-stability:ready", {
    mode: "module",
    source: "index",
    version: PATCH_VERSION,
    strategy: "bind-real-handlers",
    mobile: isProbablyMobile(),
  });

  installWithRetry();
})();
