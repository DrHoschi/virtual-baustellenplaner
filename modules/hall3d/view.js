/**
 * modules/hall3d/view.js
 * Version: v1.0.0 (2026-02-04)
 *
 * View-Controller:
 * - Erzeugt/entsorgt die Three.js Szene sauber beim Tab-Wechsel
 * - Baut (procedural) die Demo-Halle anhand Preset
 *
 * Hinweis:
 * - THREE wird global über index.html geladen (Script-Tag).
 */

import { initScene } from "./core/scene.js";
import { ModelFactory } from "./core/model-factory.js";
import { rebuildProfiMarkers } from "./core/markers.js";

export function createHall3DView({ bus, store, rootEl }) {
  let sceneCtx = null;
  let elementMeshes = null;

  async function mount() {
    if (sceneCtx) return; // schon gemountet
    sceneCtx = initScene({ rootEl });
    sceneCtx.mount();

    // Projekt/State aus Store
    const st = store.get("hall3d");
    const project = {
      id: "demo",
      name: "Stahlträgerhalle Demo",
      model: {
        kind: "procedural",
        presetId: st?.presetId || "hall_demo_v1",
        overrides: st?.overrides || {}
      },
      issues: [],
      tasks: []
    };

    // Halle bauen
    const built = await ModelFactory.build(project);
    if (built?.group) sceneCtx.scene.add(built.group);
    elementMeshes = built?.elementMeshes || [];
    rebuildProfiMarkers(sceneCtx.scene, project, elementMeshes);
  }

  function unmount() {
    if (!sceneCtx) return;
    try {
      sceneCtx.unmount();
    } finally {
      sceneCtx = null;
      elementMeshes = null;
      rootEl.innerHTML = "";
    }
  }

  // Optional: Rebuild Event
  bus.on("req:hall3d:rebuild", async (payload = {}) => {
    // Nur reagieren, wenn Ansicht aktiv ist (ansonsten sparen wir Ressourcen)
    const core = store.get("core");
    if (core?.ui?.activeModule !== "hall3d") return;

    store.update("hall3d", (s) => {
      if (payload.presetId) s.presetId = payload.presetId;
      if (payload.overrides) s.overrides = payload.overrides;
      s.lastBuildTs = Date.now();
    });

    // Soft-Rebuild: unmount/mount
    unmount();
    await mount();
  });

  return { mount, unmount };
}
