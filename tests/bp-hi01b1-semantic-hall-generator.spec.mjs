import assert from "node:assert/strict";

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

class Object3D {
  constructor() {
    this.children = [];
    this.position = new Vec3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
    this.visible = true;
    this.name = "";
  }
  add(child) {
    this.children.push(child);
  }
  remove(child) {
    this.children = this.children.filter((item) => item !== child);
  }
  traverse(fn) {
    fn(this);
    for (const child of this.children) child.traverse(fn);
  }
}

class Group extends Object3D {}
class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}
class BoxGeometry {
  constructor(width, height, depth) {
    this.parameters = { width, height, depth };
  }
}
class MeshStandardMaterial {
  constructor(options = {}) {
    this.options = { ...options };
  }
}

globalThis.THREE = {
  Group,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
};

const {
  HALL_INDUSTRY_GABLE_V1,
  normalizeHallConfig,
} = await import("../core/hall/hall-config.v1.js");
const { ModelFactory } = await import("../modules/hall3d/core/model-factory.js");

function semanticIds(built) {
  return [...built.elementMeshes.keys()].sort();
}

function b1SemanticIds(built) {
  return semanticIds(built).filter((id) => /^(floor:|roof:|wall:)/.test(id));
}

{
  const seed = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
    dimensions: { length: 60, width: 30, eaveHeight: 8 },
    roof: { type: "gable", peakHeight: 10 },
    grid: { longitudinal: { mode: "spacing", spacing: 5 } },
  });
  assert.deepEqual(seed.errors, []);

  const built = await ModelFactory.build({ id: "P-HALL", hall: seed.hall });
  assert.equal(built.group.userData.authority, "app.project.hall");
  assert.deepEqual(b1SemanticIds(built), [
    "floor:0",
    "roof:sideA",
    "roof:sideB",
    "wall:x0",
    "wall:xMax",
    "wall:z0",
    "wall:zMax",
  ]);
  assert.equal(built.elementMeshes.has("hall_main"), false);

  const floor = built.elementMeshes.get("floor:0");
  assert.deepEqual(floor.geometry.parameters, { width: 60, height: 0.12, depth: 30 });
  assert.deepEqual(
    { x: floor.position.x, y: floor.position.y, z: floor.position.z },
    { x: 30, y: -0.06, z: 15 }
  );

  const second = await ModelFactory.build({ id: "P-HALL", hall: seed.hall });
  assert.deepEqual(semanticIds(second), semanticIds(built), "same hall must yield same semantic ids");
}

{
  const seed = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
    dimensions: { length: 40, width: 20, eaveHeight: 7 },
    roof: { type: "flat", peakHeight: null },
    grid: { longitudinal: { mode: "spacing", spacing: 5 } },
    envelope: {
      walls: {
        "wall:x0": { construction: "open", visible: true },
        "wall:z0": { construction: "present", visible: false },
      },
    },
    transform: {
      position: { x: 12, y: 1, z: -4 },
      rotationY: 0.5,
    },
  });
  assert.deepEqual(seed.errors, []);

  const built = await ModelFactory.build({ hall: seed.hall });
  assert.equal(built.elementMeshes.has("wall:x0"), false, "open wall must not create geometry");
  assert.equal(built.elementMeshes.get("wall:z0")?.visible, false, "hidden wall remains semantic but invisible");
  assert.equal(built.elementMeshes.has("roof:main"), true);
  assert.equal(built.elementMeshes.has("roof:sideA"), false);
  assert.deepEqual(
    { x: built.group.position.x, y: built.group.position.y, z: built.group.position.z },
    { x: 12, y: 1, z: -4 }
  );
  assert.equal(built.group.rotation.y, 0.5);
}

{
  const invalid = {
    schema: "baustellenplaner.hall.v1",
    version: 1,
    id: "hall-main",
    dimensions: { length: 0, width: 30, eaveHeight: 8 },
    roof: { type: "gable", peakHeight: 10 },
    grid: { longitudinal: { mode: "spacing", spacing: 5 } },
    envelope: { walls: {} },
    structure: { columnsEnabled: true, primaryBeamsEnabled: true },
    levels: [{ id: "level:0", elevation: 0, floorId: "floor:0" }],
    openings: [],
    partitions: [],
    elementOverrides: {},
    transform: { position: { x: 0, y: 0, z: 0 }, rotationY: 0 },
  };

  await assert.rejects(
    () => ModelFactory.build({ hall: invalid }),
    (error) => error?.code === "HALL_CONFIG_INVALID" && /Hallenlänge/.test(error.message)
  );
}

console.log("[BP-HI01B.1] PASS semantic hall projection foundation");
