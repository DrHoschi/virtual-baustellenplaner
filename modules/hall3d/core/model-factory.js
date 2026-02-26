import { loadLibraries } from "./model-library.js";
import { buildHallFromPreset } from "./procedural-hall.js";
import {
  loadParamPack,
  mergeParams,
  applyParamPack,
  computeMetrics
} from "./param-engine.js";

export const ModelFactory = {
  async build(project) {
    const libs = await loadLibraries();
    const cfg = project.model;

    if (cfg.kind === "procedural") {
      const preset = libs.presets.presets.find(p => p.id === cfg.presetId);
      const group = buildHallFromPreset(preset, cfg.overrides);
      return { group, elementMeshes: collect(group) };
    }

    if (cfg.kind === "glb") {
      const entry = libs.models.models.find(m => m.id === cfg.modelId);
      const loader = new THREE.GLTFLoader();
      const gltf = await loader.loadAsync(entry.url);

      // ------------------------------------------------------------
      // Param Engine (v1):
      // - optional entry.paramPackUrl (JSON) liefert defaults + apply rules + BOM
      // - project.model.params (overrides) werden gemerged
      // - applyParamPack() wendet die Regeln VISUELL am 3D Modell an
      // - computeMetrics() liefert Stückliste/Kosten/Metadaten für spätere Auswertungen
      // ------------------------------------------------------------
      let paramPack = null;
      let params = cfg.params || {};
      if (entry?.paramPackUrl) {
        paramPack = await loadParamPack(entry.paramPackUrl);
        params = mergeParams(paramPack?.defaults || {}, cfg.params || {});
        applyParamPack(gltf.scene, paramPack, params);
      }

      const metrics = paramPack ? computeMetrics(paramPack, params) : null;

      return {
        group: gltf.scene,
        elementMeshes: collect(gltf.scene),
        paramPack,
        params,
        metrics
      };
    }
  }
};

function collect(root) {
  const map = new Map();
  root.traverse(o => {
    if (o.userData?.elementId) map.set(o.userData.elementId, o);
  });
  return map;
}