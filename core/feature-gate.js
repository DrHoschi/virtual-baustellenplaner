/**
 * Shim: feature-gate.js -> featureGate.js
 * Version: v1.0.0 (2026-02-08)
 *
 * Hintergrund:
 * - Einige Stände importieren "./feature-gate.js" (kebab-case),
 *   im Repo liegt aber "featureGate.js" (camelCase).
 */
export * from "./featureGate.js";
