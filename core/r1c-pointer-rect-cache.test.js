import { WorkareaPanel } from "../ui/panels/WorkareaPanel.js";

/**
 * R1c diagnostic test: pointer rect cache
 *
 * Goal:
 * - Avoid host.getBoundingClientRect() on every pointermove during one gesture.
 * - Refresh the rect exactly at the start of a new gesture (active pointers === 0).
 * - Reuse that rect for all pointer moves / second touch pointer of the same gesture.
 * - Do not change scene data, save flow, persistence, drag positioning math or render cadence.
 *
 * This is intentionally isolated and temporary. If the iPhone crash remains,
 * remove this module again and continue with the next measured candidate.
 */

const proto = WorkareaPanel?.prototype;

if (proto && !proto.__r1cPointerRectCacheInstalled) {
  const original = proto._viewportClientToCanvasPx;

  proto._viewportClientToCanvasPx = function r1cViewportClientToCanvasPx(ev) {
    try {
      const host = this._vp?.host;
      const dpr = this._vp?.dpr || 1;
      if (!host || typeof host.getBoundingClientRect !== "function") {
        return typeof original === "function" ? original.call(this, ev) : { x: 0, y: 0 };
      }

      const activeCount = Number(this._vp?.pointer?.active?.size || 0);
      let cache = this._r1cPointerRectCache;

      // PointerDown of a new gesture reaches this method before the pointer is
      // inserted into P.active. Therefore activeCount === 0 is the clean and
      // deterministic refresh point for the next drag/pan/pinch gesture.
      if (!cache || cache.host !== host || activeCount === 0) {
        const r = host.getBoundingClientRect();
        cache = {
          host,
          left: Number(r.left || 0),
          top: Number(r.top || 0),
          width: Number(r.width || 0),
          height: Number(r.height || 0),
          capturedAt: performance.now()
        };
        this._r1cPointerRectCache = cache;
      }

      return {
        x: (Number(ev?.clientX || 0) - cache.left) * dpr,
        y: (Number(ev?.clientY || 0) - cache.top) * dpr
      };
    } catch {
      return typeof original === "function" ? original.call(this, ev) : { x: 0, y: 0 };
    }
  };

  Object.defineProperty(proto, "__r1cPointerRectCacheInstalled", {
    value: true,
    configurable: true
  });
}
