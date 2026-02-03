import { loadLibraries } from "./model-library.js";
import { buildHallFromPreset } from "./procedural-hall.js";

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
      return { group: gltf.scene, elementMeshes: collect(gltf.scene) };
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