/**
 * featureGate.js
 * Zentrale FeatureGate-Logik: DEV-Max vs Release-Editionen
 *
 * Feature-Keys in requires:
 *   - "features.flags.simulation"
 *   - "features.flags.analysis"
 *   - ...
 *
 * Priorität:
 *   1) project.modules.projectSettings.license.features.override === "all_on"  -> alles true
 *   2) appMode === "dev"                                                    -> alles true
 *   3) override === "all_off"                                              -> alles false (optional)
 *   4) sonst project.features.flags[<key>]                                 -> true/false
 */
export function createFeatureGate({ appMode, projectJson }) {
  const override =
    projectJson?.modules?.projectSettings?.license?.features?.override ?? "none";
  const flags = projectJson?.features?.flags ?? {};

  const allOn = override === "all_on" || appMode === "dev";
  const allOff = override === "all_off";

  function can(featureKey) {
    if (!featureKey) return true; // leere requires -> erlaubt
    if (allOn) return true;
    if (allOff) return false;

    // featureKey z.B. "features.flags.simulation"
    const key = featureKey.replace("features.flags.", "");
    return !!flags[key];
  }

  return { can, appMode, override };
}
