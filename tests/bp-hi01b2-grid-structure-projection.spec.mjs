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

function idsWithPrefix(built, prefix) {
  return [...built.elementMeshes.keys()].filter((id) => id.startsWith(prefix)).sort();
}

function almostEqual(actual, expected, eps = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`);
}

{
  const seed = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
    dimensions: { length: 20, width: 10, eaveHeight: 6 },
    roof: { type: "gable", peakHeight: 8 },
    grid: { longitudinal: { mode: "spacing", spacing: 5 } },
  });
  assert.deepEqual(seed.errors, []);
  assert.deepEqual(seed.derived.axisPositions, [0, 5, 10, 15, 20]);

  const built = await ModelFactory.build({ hall: seed.hall });
  assert.deepEqual(built.derived.axisPositions, [0, 5, 10, 15, 20]);
  assert.deepEqual(built.group.userData.derived.axisPositions, [0, 5, 10, 15, 20]);

  const columnIds = idsWithPrefix(built, "column:");
  const beamIds = idsWithPrefix(built, "beam:frame:");
  assert.equal(columnIds.length, 10, "two columns per longitudinal axis");
  assert.equal(beamIds.length, 10, "gable frame has two primary roof beams per longitudinal axis");
  assert.ok(columnIds.includes("column:x00:z0"));
  assert.ok(columnIds.includes("column:x04:zMax"));
  assert.ok(beamIds.includes("beam:frame:x00:sideA"));
  assert.ok(beamIds.includes("beam:frame:x04:sideB"));

  const column = built.elementMeshes.get("column:x01:z0");
  assert.deepEqual(column.geometry.parameters, { width: 0.2, height: 6, depth: 0.2 });
  assert.deepEqual(
    { x: column.position.x, y: column.position.y, z: column.position.z },
    { x: 5, y: 3, z: 0 }
  );
  assert.equal(column.userData.axisIndex, 1);
  assert.equal(column.userData.axisX, 5);
  assert.equal(column.userData.authority, "app.project.hall");
  assert.equal(column.userData.projectionOnly, true);

  const beam = built.elementMeshes.get("beam:frame:x01:sideA");
  assert.deepEqual(
    { width: beam.geometry.parameters.width, height: beam.geometry.parameters.height },
    { width: 0.18, height: 0.18 }
  );
  almostEqual(beam.geometry.parameters.depth, Math.hypot(5, 2));
  assert.deepEqual(
    { x: beam.position.x, y: beam.position.y, z: beam.position.z },
    { x: 5, y: 7, z: 2.5 }
  );
  almostEqual(beam.rotation.x, -Math.atan2(2, 5));

  const second = await ModelFactory.build({ hall: seed.hall });
  assert.deepEqual(idsWithPrefix(second, "column:"), columnIds, "column ids must be deterministic");
  assert.deepEqual(idsWithPrefix(second, "beam:frame:"), beamIds, "frame ids must be deterministic");
}

{
  const seed = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
    dimensions: { length: 12, width: 10, eaveHeight: 6 },
    roof: { type: "flat", peakHeight: null },
    grid: { longitudinal: { mode: "spacing", spacing: 5 } },
  });
  assert.deepEqual(seed.errors, []);
  assert.deepEqual(seed.derived.axisPositions, [0, 5, 10, 12]);

  const built = await ModelFactory.build({ hall: seed.hall });
  assert.equal(idsWithPrefix(built, "column:").length, 8);
  assert.equal(idsWithPrefix(built, "beam:frame:").length, 4);
  assert.equal(built.elementMeshes.get("column:x03:zMax")?.userData.axisX, 12);
  assert.equal(built.elementMeshes.get("beam:frame:x03:main")?.userData.axisX, 12);
  assert.equal(built.elementMeshes.has("column:x04:z0"), false, "no synthetic extra axis may be generated");
}

{
  const columnsOff = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
    dimensions: { length: 10, width: 8, eaveHeight: 5 },
    roof: { type: "mono", peakHeight: 7 },
    grid: { longitudinal: { mode: "spacing", spacing: 5 } },
    structure: { columnsEnabled: false, primaryBeamsEnabled: true },
  });
  assert.deepEqual(columnsOff.errors, []);

  const built = await ModelFactory.build({ hall: columnsOff.hall });
  assert.equal(idsWithPrefix(built, "column:").length, 0);
  assert.equal(idsWithPrefix(built, "beam:frame:").length, 3);
  assert.ok(built.elementMeshes.has("beam:frame:x00:main"));
  assert.equal(built.elementMeshes.has("beam:frame:x00:sideA"), false);
  almostEqual(built.elementMeshes.get("beam:frame:x00:main").rotation.x, -Math.atan2(2, 8));
}

{
  const beamsOff = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
    dimensions: { length: 10, width: 8, eaveHeight: 5 },
    roof: { type: "gable", peakHeight: 7 },
    grid: { longitudinal: { mode: "spacing", spacing: 5 } },
    structure: { columnsEnabled: true, primaryBeamsEnabled: false },
  });
  assert.deepEqual(beamsOff.errors, []);

  const built = await ModelFactory.build({ hall: beamsOff.hall });
  assert.equal(idsWithPrefix(built, "column:").length, 6);
  assert.equal(idsWithPrefix(built, "beam:frame:").length, 0);
}

console.log("[BP-HI01B.2] PASS grid / columns / primary frames projection");
