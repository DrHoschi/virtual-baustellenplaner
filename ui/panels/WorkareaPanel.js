import { WorkareaPanel as WorkareaPanelBase } from "./WorkareaPanel.base.js";

export class WorkareaPanel extends WorkareaPanelBase {
  /**
   * R2F-05 V3 – Grid Geometry Correction
   *
   * Normal Safari mobile height noise stays under the base v3 resize guard.
   * A real orientationchange opens a short transition. Resize activity during
   * that transition only postpones a quiet-period final sync. Once quiet, the
   * then-current host geometry is allowed through exactly once and the
   * transition is closed immediately.
   */
  _wireLayoutDiagnostics() {
    if (this._onWindowResizeForLayoutDiag) return;

    const scheduleOrientationFinalSync = () => {
      try {
        const T = this._r2f05OrientationTransition;
        if (!T?.active) return;

        if (T.quietTimer) clearTimeout(T.quietTimer);
        T.quietTimer = setTimeout(() => {
          T.quietTimer = 0;
          if (!T.active) return;

          const now = performance.now();
          if (now > Number(T.expiresAt || 0)) {
            T.active = false;
            return;
          }

          T.allowStabilizedFinalSync = true;
          this._resizeViewportCanvas("orientationchange:stabilized-final", {
            finalSync: true
          });
          T.allowStabilizedFinalSync = false;
          T.active = false;

          try {
            this._crashLog?.("workarea:viewport:orientation-transition:complete", {
              version: "R2F-05-v3"
            });
          } catch {}
        }, 360);
      } catch {}
    };

    const schedule = (reason) => {
      try {
        const T = this._r2f05OrientationTransition;
        if (T?.active) scheduleOrientationFinalSync();

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
        const old = this._r2f05OrientationTransition;
        if (old?.quietTimer) clearTimeout(old.quietTimer);

        const now = performance.now();
        this._r2f05OrientationTransition = {
          active: true,
          startedAt: now,
          expiresAt: now + 3000,
          quietTimer: 0,
          allowStabilizedFinalSync: false
        };

        this._crashLog?.("workarea:viewport:orientation-transition:start", {
          version: "R2F-05-v3"
        });
      } catch {}

      schedule("orientationchange");
    };

    try {
      window.addEventListener("resize", this._onWindowResizeForLayoutDiag, { passive: true });
      window.addEventListener("orientationchange", this._onWindowOrientationChangeForLayoutDiag, { passive: true });
    } catch {}
  }

  _requestViewportCanvasResize(reason = "resize-request", opts = {}) {
    try {
      if (this._r2f05OrientationTransition?.active) {
        const T = this._r2f05OrientationTransition;
        if (T.quietTimer) clearTimeout(T.quietTimer);
        T.quietTimer = setTimeout(() => {
          T.quietTimer = 0;
          if (!T.active) return;

          const now = performance.now();
          if (now > Number(T.expiresAt || 0)) {
            T.active = false;
            return;
          }

          T.allowStabilizedFinalSync = true;
          this._resizeViewportCanvas("orientationchange:stabilized-final", {
            finalSync: true
          });
          T.allowStabilizedFinalSync = false;
          T.active = false;

          try {
            this._crashLog?.("workarea:viewport:orientation-transition:complete", {
              version: "R2F-05-v3"
            });
          } catch {}
        }, 360);
      }
    } catch {}

    return super._requestViewportCanvasResize(reason, opts);
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
        const T = this._r2f05OrientationTransition;
        const now = performance.now();

        if (T?.active && now > Number(T.expiresAt || 0)) {
          if (T.quietTimer) clearTimeout(T.quietTimer);
          T.quietTimer = 0;
          T.active = false;
          T.allowStabilizedFinalSync = false;
        }

        if (
          T?.active &&
          T.allowStabilizedFinalSync &&
          String(reason || "").includes("orientationchange:stabilized-final")
        ) {
          try {
            this._crashLog?.("workarea:viewport:resize:orientation-stabilized-final-sync", {
              version: "R2F-05-v3",
              reason,
              prevW,
              prevH,
              nextW,
              nextH
            });
          } catch {}

          return { action: "apply", why: "mobile-orientation-stabilized-final-sync" };
        }

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
              version: "R2F-05-v3",
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
