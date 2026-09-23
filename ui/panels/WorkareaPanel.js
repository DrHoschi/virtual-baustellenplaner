import { WorkareaPanel as WorkareaPanelBase } from "./WorkareaPanel.base.js";

export class WorkareaPanel extends WorkareaPanelBase {
  /**
   * R2F-05 V2 – Grid Geometry Correction
   *
   * Keep the base Safari resize guard authoritative for normal mobile height
   * noise. A real orientation change opens a short transition window so the
   * final host height can still reach the canvas after the first intermediate
   * orientation resize has already been applied.
   */
  _wireLayoutDiagnostics() {
    if (this._onWindowResizeForLayoutDiag) return;

    const schedule = (reason) => {
      try {
        if (this._layoutDiag?.timer) clearTimeout(this._layoutDiag.timer);

        if (this._layoutDiag) {
          this._layoutDiag.timer = setTimeout(() => {
            if (this._layoutDiag) this._layoutDiag.timer = 0;
            this._refreshWorkareaLayoutDiagnostics(reason, { renderTopbar: true });
            this._requestViewportCanvasResize(reason);
          }, 180);
        }
      } catch {}
    };

    this._onWindowResizeForLayoutDiag = () => schedule("window-resize");
    this._onWindowOrientationChangeForLayoutDiag = () => {
      try {
        const now = performance.now();
        this._r2f05OrientationTransition = {
          active: true,
          startedAt: now,
          expiresAt: now + 2600,
          finalHeightSyncApplied: false
        };
        this._crashLog?.("workarea:viewport:orientation-transition:start", {
          version: "R2F-05-v2"
        });
      } catch {}
      schedule("orientationchange");
    };

    try {
      window.addEventListener("resize", this._onWindowResizeForLayoutDiag, { passive: true });
      window.addEventListener("orientationchange", this._onWindowOrientationChangeForLayoutDiag, { passive: true });
    } catch {}
  }

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
        const sameDpr = Math.abs(Number(nextSize?.dpr || 1) - Number(last.dpr || 1)) < 0.01;
        const heightChanged = Math.abs(nextH - prevH) > 0;
        const prevOrientation = prevW > prevH ? "landscape" : prevH > prevW ? "portrait" : "square";
        const nextOrientation = nextW > nextH ? "landscape" : nextH > nextW ? "portrait" : "square";
        const orientationChanged = prevOrientation !== nextOrientation;

        const prevAspect = prevW / prevH;
        const nextAspect = nextW / nextH;
        const aspectDelta = Math.abs(nextAspect - prevAspect);
        const materialAspectChange = widthChanged && aspectDelta >= 0.12;

        const T = this._r2f05OrientationTransition;
        const now = performance.now();
        if (T?.active && now > Number(T.expiresAt || 0)) {
          T.active = false;
        }

        if (orientationChanged || materialAspectChange) {
          if (T?.active) T.expiresAt = now + 2600;

          try {
            this._crashLog?.("workarea:viewport:resize:orientation-sync", {
              version: "R2F-05-v2",
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

        const transitionFinalHeightSync =
          !!T?.active &&
          !T.finalHeightSyncApplied &&
          !widthChanged &&
          sameDpr &&
          heightChanged;

        if (transitionFinalHeightSync) {
          T.finalHeightSyncApplied = true;
          T.active = false;

          try {
            this._crashLog?.("workarea:viewport:resize:orientation-final-sync", {
              version: "R2F-05-v2",
              reason,
              prevW,
              prevH,
              nextW,
              nextH
            });
          } catch {}

          return { action: "apply", why: "mobile-orientation-final-height-sync" };
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
