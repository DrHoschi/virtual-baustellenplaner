/**
 * Core-Modul (minimal)
 * - Stellt Basisevents bereit
 * - Hält sehr kleine zentrale UI-Infos (activeModule)
 */
import { CoreState } from "./module.state.js";

export function registerCoreModule(registry, manifest) {
  registry.registerModule({
    manifest: (manifest || {
      schema: "baustellenplaner.module.v1",
      key: "core",
      label: "Core",
      menu: { group: "projekt", icon: "icon-project", order: 1 },
      dependencies: []
    }),
    init(ctx) {
      const { bus, store } = ctx;
      store.init("core", CoreState);

      // UI -> Core (aktive Ansicht umschalten)
      bus.on("ui:menu:select", ({ moduleKey }) => {
        store.update("core", (s) => {
          s.ui.activeModule = moduleKey;
        });
        bus.emit("cb:core:activeModuleChanged", { moduleKey });
      });

      // Snapshot request (praktisch für Debug/Inspector später)
      bus.on("req:core:snapshot", () => {
        bus.emit("cb:core:snapshot", store.get("core"));
      });
    }
  });
}
