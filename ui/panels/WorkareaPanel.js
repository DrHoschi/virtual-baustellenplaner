import { WorkareaPanel as WorkareaPanelBase } from "./WorkareaPanel.base.js";

export class WorkareaPanel extends WorkareaPanelBase {
  /**
   * R2F-05 – Grid Geometry Correction
   *
   * The base mobile resize guard intentionally suppresses Safari height noise.
   * A real orientation/layout change must still resize the canvas backing store
   * immediately, otherwise CSS can stretch the previous buffer and turn the
   * square planning grid (and rendered objects) rectangular.
   *
   * Keep the existing v3 guard as the authority for all other resize cases.
   */
  _shouldDeferOrIgnoreViewportResize(nextSize, reason = "resize", opts = {}) {
    try {
      const G = this._mobileResizeGuard;
      const last = G?.lastApplied || {};
      const prevW = Number(last.w || 0);
      const prevH = Number(last.h || 0);
      const nextW = Number(nextSize?.w || 0);
      const nextH = Number(nextSize?.h || 0);

      if (
        G?.enabled &&
        prevW > 0 &&
        prevH > 0 &&
        nextW > 0 &&
        nextH > 0 &&
        this._isMobileResizeGuardEnvironment?.()
      ) {
        const widthChanged = Math.abs(nextW - prevW) > 1;
        const prevOrientation = prevW > prevH ? "landscape" : prevH > prevW ? "portrait" : "square";
        const nextOrientation = nextW > nextH ? "landscape" : nextH > nextW ? "portrait" : "square";
        const orientationChanged = prevOrientation !== nextOrientation;

        const prevAspect = prevW / prevH;
        const nextAspect = nextW / nextH;
        const aspectDelta = Math.abs(nextAspect - prevAspect);
        const materialAspectChange = widthChanged && aspectDelta >= 0.12;

        if (orientationChanged || materialAspectChange) {
          try {
            this._crashLog?.("workarea:viewport:resize:orientation-sync", {
              version: "R2F-05",
              reason,
              prevW,
              prevH,
              nextW,
              nextH,
              prevOrientation,
              nextOrientation,
              aspectDelta
            });
          } catch {}

          return {
            action: "apply",
            why: orientationChanged
              ? "mobile-orientation-change"
              : "mobile-material-aspect-change"
          };
        }
      }
    } catch {}

    return super._shouldDeferOrIgnoreViewportResize(nextSize, reason, opts);
  }

  getPlanningHallContext() {
    try {
      const app = this.store?.get?.("app") || {};
      const hall = app?.project?.hall;
      if (!hall || typeof hall !== "object") return null;

      const dimensions = hall?.dimensions && typeof hall.dimensions === "object" ? hall.dimensions : {};
      const finiteOrNull = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      };

      return Object.freeze({
        authority: "app.project.hall",
        hallId: hall?.id || hall?.presetRef?.id || null,
        length: finiteOrNull(dimensions.length),
        width: finiteOrNull(dimensions.width),
        eaveHeight: finiteOrNull(dimensions.eaveHeight),
        roofType: hall?.roof?.type || null
      });
    } catch {
      return null;
    }
  }
}
