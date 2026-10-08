/**
 * Core-Modul (minimal)
 * - Stellt Basisevents bereit
 * - Hält sehr kleine zentrale UI-Infos (activeModule)
 *
 * v1.0.1 (2026-02-24):
 * - Spiegelt auch Activate-Requests in core.ui.activeModule (Debug/Inspector freundlich)
 *   ACHTUNG: Das echte Umschalten macht der Loader via switchView (core/loader.js).
 */
import { CoreState } from "./module.state.js";

export function registerCoreModule(registry, manifest) {
  registry.registerModule({
    manifest:
      manifest ||
      ({
        schema: "baustellenplaner.module.v1",
        key: "core",
        label: "Core",
        menu: { group: "projekt", icon: "icon-project", order: 1 },
        dependencies: []
      }),
    init(ctx) {
      const { bus, store } = ctx;
      store.init("core", CoreState);

      // UI -> Core (aktive Ansicht umschalten) (Debug-State)
      bus.on("ui:menu:select", ({ moduleKey } = {}) => {
        store.update("core", (s) => {
          s.ui.activeModule = moduleKey;
        });
        bus.emit("cb:core:activeModuleChanged", { moduleKey });
      });

      // v1.0.1: Activate-Requests ebenfalls spiegeln (Debug)
      function mirrorActivate(msg = {}) {
        const panelId = msg?.moduleId || msg?.moduleKey || msg?.panelId || msg?.panel || msg?.id || "";
        if (!panelId) return;
        store.update("core", (s) => {
          s.ui.activeModule = String(panelId);
        });
        bus.emit("cb:core:activeModuleChanged", { moduleKey: String(panelId), reason: "activate-request" });
      }

      bus.on("req:ui:module:activate", mirrorActivate);
      bus.on("req:ui:activeModule:set", mirrorActivate);
      bus.on("req:panel:activate", mirrorActivate);

      // Snapshot request (praktisch für Debug/Inspector später)
      bus.on("req:core:snapshot", () => {
        bus.emit("cb:core:snapshot", store.get("core"));
      });
    }
  });
}
