/**
 * Baustellenplaner – FeatureGate (minimal, aber robust)
 * Datei: core/feature-gate.js
 * Version: v1.0.0 (2026-02-08)
 *
 * Ziel:
 * - Ein zentraler Schalter für Features (dev/release, overrides, flags)
 * - Absichtlich klein gehalten: CI + Browser-safe
 *
 * Nutzung (typisch):
 *   import { createFeatureGate } from "./feature-gate.js";
 *   const gate = createFeatureGate({ mode: "dev", flags: { assetLab:true }});
 *   if (gate.isEnabled("assetLab")) { ... }
 */

export function createFeatureGate(opts = {}) {
  const mode = opts.mode || "dev"; // "dev" | "release"
  const flags = { ...(opts.flags || {}) };
  const overrides = { ...(opts.overrides || {}) };

  function normalizeKey(key) {
    return String(key || "").trim();
  }

  function getFlag(key) {
    key = normalizeKey(key);
    if (!key) return undefined;
    if (Object.prototype.hasOwnProperty.call(overrides, key)) return !!overrides[key];
    if (Object.prototype.hasOwnProperty.call(flags, key)) return !!flags[key];
    return undefined;
  }

  return {
    mode,
    flags,
    overrides,

    /** true/false, default abhängig von mode (dev=true, release=false) */
    isEnabled(key) {
      const v = getFlag(key);
      if (typeof v === "boolean") return v;
      return mode !== "release";
    },

    /** erzwingt Flag zur Laufzeit (z.B. Debug) */
    set(key, value) {
      overrides[normalizeKey(key)] = !!value;
    },

    /** Snapshot für Debug/Inspector */
    snapshot() {
      return { mode, flags: { ...flags }, overrides: { ...overrides } };
    }
  };
}

// Optional: default export (manche Loader mögen das)
export default { createFeatureGate };
