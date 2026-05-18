/*
 * DATEI: /core/workarea-mobile-drag-stability.v2.js
 * VERSION: v2.3.0-disabled-stub
 * STAND: 2026-05-18
 *
 * WICHTIG:
 * Die Mobile-Drag-Stability ist ab Patch v2.3 direkt in
 * /ui/panels/WorkareaPanel.js integriert.
 *
 * Diese Datei bleibt absichtlich als NO-OP/STUB bestehen, damit ältere
 * gecachte index.html-Versionen oder alte Script-Tags nicht wieder den
 * externen Prototype-Patch aktivieren.
 */

(function mobileDragStabilityDisabledStub() {
  const VERSION = "v2.3.0-disabled-stub-direct-workarea-only";
  const safeLog = (name, detail = {}) => {
    try {
      if (typeof window !== "undefined" && typeof window.__bpCrashLog === "function") {
        window.__bpCrashLog(name, detail);
      }
    } catch (_) {}
  };

  try {
    window.__bpMobileDragStabilityExternalDisabled = true;
  } catch (_) {}

  safeLog("workarea:mobile-drag-stability:external-disabled", {
    mode: "module",
    source: "core/workarea-mobile-drag-stability.v2.js",
    version: VERSION,
    reason: "direct-integration-in-WorkareaPanel"
  });
})();
