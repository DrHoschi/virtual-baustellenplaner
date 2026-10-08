/**
 * UI-MIG-05H.2R-G.4 – Canvas Debug Overlay Removal Guard
 *
 * Scope:
 * - unterdrueckt ausschliesslich die bekannten Workarea-Diagnosezeilen,
 *   die per CanvasRenderingContext2D.fillText gezeichnet werden
 * - nur im Planning-Viewport
 * - keine Aenderung an Workarea-Geometrie, Canvas-Groesse, ResizeObserver,
 *   RAF, Renderloop-Timing, Pointer-/Drag-/Pan-/Zoom-Logik oder Persistenz
 */

const DEBUG_PREFIXES = Object.freeze([
  "Viewport Step 4 (Pan/Zoom/Grid + HitTest + Drag)",
  "Mode: ",
  "Grid: ",
  "Zoom: ",
  "Size: ",
  "dt: "
]);

const originalFillText = CanvasRenderingContext2D.prototype.fillText;

CanvasRenderingContext2D.prototype.fillText = function bpPlanningDebugOverlayGuard(text, x, y, maxWidth) {
  const canvas = this?.canvas;
  const host = canvas?.closest?.('.wa-viewport-host[data-bp-planning-region="viewport"]');
  const inPlanning = !!host && document.body?.classList?.contains("bp-planning-workspace-active");
  const value = String(text ?? "");

  if (inPlanning && DEBUG_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return;
  }

  if (arguments.length >= 4) {
    return originalFillText.call(this, text, x, y, maxWidth);
  }
  return originalFillText.call(this, text, x, y);
};
