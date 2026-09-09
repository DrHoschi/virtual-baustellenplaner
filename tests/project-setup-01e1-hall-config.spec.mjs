#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  HALL_INDUSTRY_GABLE_V1,
  normalizeHallConfig,
  normalizeStoredHall,
} from "../core/hall/hall-config.v1.js";
import { normalizeProject } from "../core/project-normalize.js";

const base = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {});
assert.deepEqual(base.errors, []);
assert.equal(base.hall.schema, "baustellenplaner.hall.v1");
assert.equal(base.hall.id, "hall-main");
assert.equal(base.hall.dimensions.length, 60);
assert.equal(base.hall.dimensions.width, 30);
assert.equal(base.hall.dimensions.eaveHeight, 8);
assert.equal(base.hall.roof.type, "gable");
assert.equal(base.hall.roof.peakHeight, 10);
assert.equal(base.hall.grid.longitudinal.spacing, 5);
assert.equal(base.derived.bayCount, 12);
assert.equal(base.derived.remainderBay, 0);
assert.deepEqual(base.derived.axisPositions, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);

const remainder = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
  dimensions: { length: 62 },
  grid: { longitudinal: { spacing: 5 } },
});
assert.deepEqual(remainder.errors, []);
assert.equal(remainder.derived.fullBays, 12);
assert.equal(remainder.derived.remainderBay, 2);
assert.equal(remainder.derived.bayCount, 13);
assert.equal(remainder.derived.axisPositions.at(-1), 62);
assert.ok(remainder.warnings.some((x) => x.includes("Restfeld 2.00 m")));

const smallRemainder = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
  dimensions: { length: 61 },
  grid: { longitudinal: { spacing: 5 } },
});
assert.ok(smallRemainder.warnings.some((x) => x.includes("deutlich kleiner")));

const badRoof = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
  dimensions: { eaveHeight: 8 },
  roof: { type: "gable", peakHeight: 7 },
});
assert.ok(badRoof.errors.some((x) => x.includes("First-/Hochpunkthöhe")));

const reopened = normalizeStoredHall(base.hall);
assert.deepEqual(reopened.errors, []);
assert.deepEqual(reopened.hall, base.hall);

const project = normalizeProject({
  schema: "baustellenplaner.project.v1",
  id: "P-TEST-HALL",
  name: "Hall Test",
  type: "industriebau",
  modules: ["core", "layout", "hall3d"],
  projectAssets: [],
  hall: base.hall,
});
assert.deepEqual(project.hall, base.hall);

const invalidStoredHall = {
  ...base.hall,
  dimensions: { ...base.hall.dimensions, length: -20 },
};
const invalidProject = normalizeProject({
  id: "P-TEST-INVALID-HALL",
  hall: invalidStoredHall,
});
assert.deepEqual(invalidProject.hall, invalidStoredHall, "invalid stored hall must not be silently replaced by preset defaults");

const oldProject = normalizeProject({ id: "P-TEST-NO-HALL" });
assert.equal(Object.prototype.hasOwnProperty.call(oldProject, "hall"), false, "old projects stay hall-less");

console.log("[project-setup-01e1-hall-config.spec] OK");
