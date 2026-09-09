import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  HALL_INDUSTRY_GABLE_V1,
  normalizeHallConfig,
} = await import("../core/hall/hall-config.v1.js");
const {
  HALL_EDIT_WALL_IDS,
  normalizeHallEdit,
  commitHallEdit,
} = await import("../core/hall/hall-edit.v1.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeHall() {
  const seed = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {
    dimensions: { length: 60, width: 30, eaveHeight: 8 },
    roof: { type: "gable", peakHeight: 10 },
    grid: { longitudinal: { mode: "spacing", spacing: 5 } },
  });
  assert.deepEqual(seed.errors, []);
  const hall = clone(seed.hall);
  hall.openings = [{ id: "opening:0001", kind: "gate", hostWallId: "wall:x0", width: 4, height: 4 }];
  hall.partitions = [{ id: "partition:0001", levelId: "level:0", start: { x: 4, z: 5 }, end: { x: 8, z: 5 }, height: 3 }];
  return hall;
}

{
  const hall = makeHall();
  const originalOpenings = clone(hall.openings);
  const originalPartitions = clone(hall.partitions);
  const originalStructure = clone(hall.structure);
  const originalTransform = clone(hall.transform);

  const edited = normalizeHallEdit(hall, {
    dimensions: { length: 72, width: 36, eaveHeight: 9 },
    roof: { type: "gable", peakHeight: 12 },
    grid: { longitudinal: { spacing: 6 } },
    envelope: {
      walls: {
        "wall:x0": { construction: "open", visible: true },
        "wall:z0": { construction: "present", visible: false },
      },
    },
    // Must be ignored: B.3 may not edit structure in this contract.
    structure: { columnsEnabled: false, primaryBeamsEnabled: false },
  });

  assert.deepEqual(edited.errors, []);
  assert.deepEqual(edited.hall.dimensions, { length: 72, width: 36, eaveHeight: 9 });
  assert.deepEqual(edited.hall.roof, { type: "gable", peakHeight: 12 });
  assert.equal(edited.hall.grid.longitudinal.spacing, 6);
  assert.deepEqual(edited.derived.axisPositions, [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72]);
  assert.deepEqual(edited.hall.envelope.walls["wall:x0"], { construction: "open", visible: false });
  assert.deepEqual(edited.hall.envelope.walls["wall:z0"], { construction: "present", visible: false });
  assert.deepEqual(edited.hall.openings, originalOpenings);
  assert.deepEqual(edited.hall.partitions, originalPartitions);
  assert.deepEqual(edited.hall.structure, originalStructure);
  assert.deepEqual(edited.hall.transform, originalTransform);
}

{
  const hall = makeHall();
  const flat = normalizeHallEdit(hall, { roof: { type: "flat", peakHeight: null } });
  assert.deepEqual(flat.errors, []);
  assert.deepEqual(flat.hall.roof, { type: "flat", peakHeight: null });

  const backToGable = normalizeHallEdit(flat.hall, {
    roof: { type: "gable", peakHeight: 11 },
  });
  assert.deepEqual(backToGable.errors, []);
  assert.deepEqual(backToGable.hall.roof, { type: "gable", peakHeight: 11 });
}

{
  const hall = makeHall();
  const invalid = normalizeHallEdit(hall, {
    dimensions: { eaveHeight: 12 },
    roof: { type: "gable", peakHeight: 10 },
  });
  assert.ok(invalid.errors.some((message) => /First-\/Hochpunkthöhe/.test(message)));
}

{
  const eventOrder = [];
  let app = { project: { id: "P-B3", hall: makeHall() } };

  const store = {
    get(slice) {
      if (slice === "hall3d") throw new Error("B.3 must not read store.hall3d");
      assert.equal(slice, "app");
      return app;
    },
    update(slice, mutator) {
      if (slice === "hall3d") throw new Error("B.3 must not write store.hall3d");
      assert.equal(slice, "app");
      eventOrder.push("store:update:app");
      const draft = clone(app);
      mutator(draft);
      app = draft;
    },
  };

  const bus = {
    emit(name, payload) {
      eventOrder.push(`bus:${name}`);
      assert.equal(payload.reason, "test:b3-commit");
    },
  };

  const result = commitHallEdit({
    store,
    bus,
    reason: "test:b3-commit",
    changes: {
      dimensions: { length: 66 },
      grid: { longitudinal: { spacing: 6 } },
      envelope: {
        walls: Object.fromEntries(HALL_EDIT_WALL_IDS.map((id) => [id, { construction: "present", visible: true }])),
      },
    },
  });

  assert.equal(result.committed, true);
  assert.equal(app.project.hall.dimensions.length, 66);
  assert.equal(app.project.hall.grid.longitudinal.spacing, 6);
  assert.deepEqual(eventOrder, [
    "store:update:app",
    "bus:ui:project:save",
    "bus:req:hall3d:rebuild",
  ]);

  eventOrder.length = 0;
  const beforeInvalid = clone(app.project.hall);
  const rejected = commitHallEdit({
    store,
    bus,
    reason: "test:b3-commit",
    changes: { dimensions: { length: 0 } },
  });
  assert.equal(rejected.committed, false);
  assert.deepEqual(app.project.hall, beforeInvalid, "invalid edit must not mutate authority");
  assert.deepEqual(eventOrder, [], "invalid edit must not persist or rebuild");
}

{
  const editSource = await readFile(new URL("../core/hall/hall-edit.v1.js", import.meta.url), "utf8");
  const viewSource = await readFile(new URL("../modules/hall3d/view.js", import.meta.url), "utf8");

  assert.match(viewSource, /commitHallEdit/);
  assert.match(viewSource, /Halle bearbeiten/);
  assert.match(viewSource, /Halle übernehmen/);
  assert.doesNotMatch(editSource, /store\.get\(["']hall3d["']\)/);
  assert.doesNotMatch(editSource, /store\.update\(["']hall3d["']/);
  assert.doesNotMatch(viewSource, /store\.get\(["']hall3d["']\)/);
  assert.doesNotMatch(viewSource, /store\.update\(["']hall3d["']/);
}

console.log("[BP-HI01B.3] PASS rapid hall edit binding");
