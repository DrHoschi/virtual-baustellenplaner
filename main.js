import { initScene } from "./core/scene.js";
import { ModelFactory } from "./core/model-factory.js";
import { rebuildProfiMarkers } from "./core/markers.js";

const project = {
  id: "demo",
  name: "Stahlträgerhalle Demo",
  model: {
    kind: "procedural",
    presetId: "hall_demo_v1",
    overrides: {}
  },
  issues: [],
  tasks: []
};

const { scene } = initScene();

ModelFactory.build(project).then(({ group, elementMeshes }) => {
  scene.add(group);
  rebuildProfiMarkers(scene, project, elementMeshes);
});