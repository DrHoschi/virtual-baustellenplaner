import assert from "node:assert/strict";
import fs from "node:fs";

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
    Object.defineProperty(this, "position", {
      value: new Vec3(),
      writable: false,
      configurable: false,
      enumerable: true,
    });
    Object.defineProperty(this, "rotation", {
      value: { x: 0, y: 0, z: 0 },
      writable: false,
      configurable: false,
      enumerable: true,
    });
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

globalThis.THREE = { Group, Mesh, BoxGeometry, MeshStandardMaterial };

const {
  HALL_INDUSTRY_GABLE_V1,
  normalizeHallConfig,
} = await import("../core/hall/hall-config.v1.js");
const { buildHallFromProjectHall } = await import("../modules/hall3d/core/procedural-hall.js");

const normalized = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
  dimensions: { length: 20, width: 10, eaveHeight: 6 },
  roof: { type: "gable", peakHeight: 8 },
  grid: { longitudinal: { mode: "spacing", spacing: 5 } },
  transform: {
    position: { x: 2, y: 1, z: -3 },
    rotationY: 0.35,
  },
});

assert.deepEqual(normalized.errors, []);

const built = buildHallFromProjectHall(normalized.hall, normalized.derived);
assert.equal(built.rotation.y, 0.35, "group rotation axis must be mutated without replacing rotation object");
assert.deepEqual(
  { x: built.position.x, y: built.position.y, z: built.position.z },
  { x: 2, y: 1, z: -3 }
);

const roof = built.children.find((item) => item.userData?.elementId === "roof:sideA");
assert.ok(roof, "gable roof sideA must exist");
assert.notEqual(roof.rotation.x, 0, "roof pitch must still be applied through the existing rotation object");

const source = fs.readFileSync(new URL("../modules/hall3d/core/procedural-hall.js", import.meta.url), "utf8");
assert.doesNotMatch(
  source,
  /\b(?:mesh|group)\.rotation\s*=/,
  "Three Object3D rotation property must never be replaced"
);

console.log("[BP-HI01B.3R-R5] PASS Three.js readonly transform compatibility");
