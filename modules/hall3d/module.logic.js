/**
 * modules/hall3d/module.logic.js
 * Version: v1.0.0 (2026-02-04)
 *
 * Modul-Registrierung (Blueprint-kompatibel)
 */

import { Hall3DState } from "./module.state.js";

export function registerHall3DModule(registry) {
  registry.registerModule({
    manifest: {
      schema: "baustellenplaner.module.v1",
      key: "hall3d",
      label: "3D Halle",
      menu: { group: "planung", icon: "icon-cube", order: 20 },
      dependencies: ["core"]
    },
    init(ctx) {
      const { store } = ctx;
      store.init("hall3d", Hall3DState);
    }
  });
}
