/**
 * modules/hall3d/module.logic.js
 * Version: v1.1.0-bp-hi01b1 (2026-09-09)
 *
 * BP-HI01B.1:
 * - Hall3D owns no independent hall state anymore.
 * - app.project.hall is the product authority.
 * - legacy module.state.js remains only as an unreferenced compatibility artifact.
 */

export function registerHall3DModule(registry, manifest) {
  registry.registerModule({
    manifest: (manifest || {
      schema: "baustellenplaner.module.v1",
      key: "hall3d",
      label: "3D Halle",
      menu: { group: "planung", icon: "icon-cube", order: 20 },
      dependencies: ["core"]
    }),
    init() {
      // Intentionally no store.init("hall3d", ...).
      // The Hall3D projection reads app.project.hall only.
    }
  });
}
