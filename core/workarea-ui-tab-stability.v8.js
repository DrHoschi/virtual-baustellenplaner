/**
 * core/workarea-ui-tab-stability.v8.js
 * DEPRECATED SHIM – deaktiviert durch PATCH_workarea_hardcut_save_input_v1
 *
 * Alte Version:
 * - patchte _persistWorkareaUiToStore
 * - loggte workarea:unmount:trace:v8
 * - installierte sich delayed mehrfach
 *
 * Neuer Stand:
 * - Keine delayed Installation.
 * - Keine zusätzliche Unmount-Trace-Schicht.
 * - UI-Tab/Mode-Persist bleibt Aufgabe von WorkareaPanel bzw. später
 *   einem sauberen WorkareaUiStateManager.
 */
try {
  window.BP_CRASH_RECORDER?.log?.("workarea:ui-tab-stability:v8-deprecated-shim", {
    guard: "workarea-hardcut-save-input-v1"
  });
} catch {}
export {};
