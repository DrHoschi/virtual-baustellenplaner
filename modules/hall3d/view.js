/**
 * modules/hall3d/view.js
 * Version: v1.1.0-bp-hi01b1 (2026-09-09)
 *
 * BP-HI01B.1 – Authoritative Hall Projection & Semantic Generator Foundation
 * - app.project.hall is the only product hall input
 * - no demo preset fallback
 * - no writes to store.hall3d
 * - no hall editing in this step
 */

import { initScene } from "./core/scene.js";
import { ModelFactory } from "./core/model-factory.js";

export function createHall3DView({ bus, store, rootEl }) {
  let sceneCtx = null;
  let currentGroup = null;
  let elementMeshes = new Map();

  function currentProject() {
    const app = store.get("app") || {};
    return app?.project || null;
  }

  function clearStatusAttributes() {
    try {
      delete rootEl.dataset.hall3dStatus;
      delete rootEl.dataset.hallAuthority;
    } catch (_) { /* ignore */ }
  }

  function showStatus(message, status) {
    rootEl.innerHTML = "";
    const note = document.createElement("div");
    note.textContent = message;
    note.style.padding = "16px";
    note.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    note.style.fontSize = "13px";
    note.style.opacity = ".8";
    rootEl.appendChild(note);
    rootEl.dataset.hall3dStatus = status;
    rootEl.dataset.hallAuthority = "app.project.hall";
  }

  function frameHall(project, built) {
    if (!sceneCtx?.cam || !built?.hall?.dimensions) return;

    const hall = built.hall;
    const { length, width, eaveHeight } = hall.dimensions;
    const top = hall.roof.type === "flat" ? eaveHeight : hall.roof.peakHeight;
    const span = Math.max(length, width, top, 10);
    const offset = hall.transform?.position || { x: 0, y: 0, z: 0 };
    const center = {
      x: (Number(offset.x) || 0) + length / 2,
      y: (Number(offset.y) || 0) + top * 0.45,
      z: (Number(offset.z) || 0) + width / 2,
    };

    sceneCtx.cam.position.set(
      center.x + span * 0.65,
      center.y + span * 0.45,
      center.z + span * 0.65
    );
    sceneCtx.cam.lookAt(center.x, center.y, center.z);
  }

  async function mount() {
    if (sceneCtx) return;

    const project = currentProject();
    if (!project?.hall) {
      showStatus("Für dieses Projekt ist keine Halle konfiguriert.", "no-hall");
      return;
    }

    sceneCtx = initScene({ rootEl });
    sceneCtx.mount();
    rootEl.style.position = "relative";
    rootEl.style.overflow = "hidden";

    try {
      const built = await ModelFactory.build(project);
      if (!built?.group) throw new Error("Hall generator returned no group.");

      sceneCtx.scene.add(built.group);
      currentGroup = built.group;
      elementMeshes = built.elementMeshes || new Map();
      frameHall(project, built);

      rootEl.dataset.hall3dStatus = "ready";
      rootEl.dataset.hallAuthority = "app.project.hall";
      rootEl.dataset.hallElementCount = String(elementMeshes.size);
    } catch (error) {
      try { sceneCtx.unmount(); } catch (_) { /* ignore */ }
      sceneCtx = null;
      currentGroup = null;
      elementMeshes = new Map();
      console.error("[BP-HI01B.1] Hall projection failed", error);
      showStatus(`Halle kann nicht dargestellt werden: ${error?.message || "ungültige Hallendaten"}`, "invalid-hall");
    }
  }

  function unmount() {
    if (sceneCtx) {
      try {
        if (currentGroup) sceneCtx.scene.remove(currentGroup);
        sceneCtx.unmount();
      } catch (_) { /* ignore */ }
    }

    sceneCtx = null;
    currentGroup = null;
    elementMeshes = new Map();
    rootEl.innerHTML = "";
    clearStatusAttributes();
    try { delete rootEl.dataset.hallElementCount; } catch (_) { /* ignore */ }
  }

  // Trigger only. The payload is intentionally ignored: regeneration always
  // reads the current app.project.hall authority.
  bus.on("req:hall3d:rebuild", async () => {
    const core = store.get("core");
    if (core?.ui?.activeModule !== "hall3d") return;
    unmount();
    await mount();
  });

  return { mount, unmount };
}
