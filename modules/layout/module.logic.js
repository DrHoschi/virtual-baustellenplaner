/**
 * Layout-Modul (Referenz)
 * - Zeigt, wie Module über Bus/Store arbeiten (UI-entkoppelt)
 */
import { LayoutState } from "./module.state.js";

export function registerLayoutModule(registry, manifest) {
  registry.registerModule({
    manifest: (manifest || {
      schema: "baustellenplaner.module.v1",
      key: "layout",
      label: "Baustellenlayout",
      menu: { group: "planung", icon: "icon-grid", order: 10 },
      dependencies: ["core"]
    }),
    init(ctx) {
      const { bus, store } = ctx;
      store.init("layout", LayoutState);

      bus.on("req:layout:snapshot", () => {
        bus.emit("cb:layout:snapshot", store.get("layout"));
      });

      bus.on("req:layout:addArea", (area) => {
        store.update("layout", (s) => {
          s.areas.push(area);
        });
        bus.emit("cb:layout:changed", { kind: "areas" });
      });
    }
  });
}
