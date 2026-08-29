import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

/**
 * R1d diagnostic test: mobile drag render isolation
 *
 * Goal:
 * - Keep pointer handling and object mutation active.
 * - Suppress viewport rendering only while the Workarea mobile drag
 *   low-power mode is active.
 * - Resume normal rendering immediately after the drag ends.
 *
 * This is intentionally temporary and diagnostic. If crashes disappear,
 * the active Canvas/render path is implicated. If crashes continue, the
 * cause is outside _renderViewport2D() itself.
 */

const proto = WorkareaPanel?.prototype;

if (proto && !proto.__r1dMobileDragRenderIsolationInstalled) {
  const originalRender = proto._renderViewport2D;

  proto._renderViewport2D = function r1dRenderViewport2D(...args) {
    try {
      const mobileDrag = this._mobileDrag;
      if (mobileDrag?.enabled && mobileDrag?.lowPower === true) {
        return;
      }
    } catch {
      // Fall through to the original renderer if the diagnostic state cannot
      // be read safely.
    }

    if (typeof originalRender === "function") {
      return originalRender.apply(this, args);
    }
  };

  Object.defineProperty(proto, "__r1dMobileDragRenderIsolationInstalled", {
    value: true,
    configurable: true
  });
}
