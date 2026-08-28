import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

/**
 * R1b diagnostic guard (temporary test module)
 *
 * Purpose:
 * - Cancel a stale finalRenderTimer when a new mobile drag starts.
 * - Prevent a delayed final render from firing while a new low-power drag is active.
 *
 * This module intentionally changes no store/save/persistence/data-model behavior.
 * Remove after the R1b diagnosis is complete and the guard is integrated directly
 * into WorkareaPanel.js.
 */

if (!WorkareaPanel.prototype.__r1bStaleFinalRenderGuardInstalled) {
  Object.defineProperty(WorkareaPanel.prototype, "__r1bStaleFinalRenderGuardInstalled", {
    value: true,
    configurable: true
  });

  WorkareaPanel.prototype._enterMobileDragLowPower = function (source, ev = null) {
    const M = this._mobileDrag;
    if (!M || !M.enabled || !this._isMobileDragEnvironment()) return;

    // R1b: a delayed final render from the previous drag must never run inside
    // the next drag.
    if (M.finalRenderTimer) {
      clearTimeout(M.finalRenderTimer);
      M.finalRenderTimer = 0;
    }

    M.moveCount += 1;

    if (M.lowPower) return;

    M.lowPower = true;
    M.pointerId = ev?.pointerId ?? M.pointerId ?? null;
    M.dragObjId = this._vp?.pointer?.dragObjId || null;
    M.enterAt = performance.now();
    M.renderCount = 0;
    M.skippedFrames = 0;
    M.lastRenderAt = 0;

    try {
      this._crashLog("workarea:mobile-drag:low-power-enter", {
        version: M.version,
        source,
        pointerId: M.pointerId,
        dragObjId: M.dragObjId,
        objects: this._scene?.objects?.length || 0
      });
    } catch {}
  };

  WorkareaPanel.prototype._leaveMobileDragLowPower = function (source, ev = null) {
    const M = this._mobileDrag;
    if (!M || !M.lowPower) return;

    const duration = Math.round(performance.now() - (M.enterAt || performance.now()));
    M.lowPower = false;

    try {
      this._crashLog("workarea:mobile-drag:low-power-leave", {
        version: M.version,
        source,
        pointerId: ev?.pointerId ?? M.pointerId ?? null,
        dragObjId: M.dragObjId,
        duration,
        moveCount: M.moveCount,
        renderCount: M.renderCount,
        skippedFrames: M.skippedFrames
      });
    } catch {}

    M.pointerId = null;
    M.dragObjId = null;
    M.moveCount = 0;

    if (M.finalRenderTimer) {
      clearTimeout(M.finalRenderTimer);
      M.finalRenderTimer = 0;
    }

    M.finalRenderTimer = setTimeout(() => {
      M.finalRenderTimer = 0;

      // R1b: if another drag entered low-power before this timer fired, this
      // render belongs to the previous drag and is stale.
      if (M.lowPower) return;

      try {
        this._renderViewport2D(0);
        this._crashLog("workarea:mobile-drag:final-render", {
          version: M.version,
          source
        });
      } catch (e) {
        this._crashLog("workarea:mobile-drag:final-render:error", {
          version: M.version,
          message: e?.message || String(e)
        });
      }
    }, 120);
  };

  console.info("[workarea] R1b stale final-render guard active (diagnostic module)");
}
