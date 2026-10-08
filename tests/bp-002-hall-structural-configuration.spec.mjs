import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeHallConfig, HALL_INDUSTRY_GABLE_V1 } from "../core/hall/hall-config.v1.js";
import { migrateHallV1ToV2, normalizeOrMigrateStoredHall } from "../core/hall/hall-migrate-v1-v2.js";
import { normalizeHallStructuralEdit } from "../core/hall/hall-edit.v2.js";
import { DEFAULT_COLUMN_PROFILE_ID, DEFAULT_PRIMARY_MEMBER_PROFILE_ID, getStructuralProfile } from "../core/library/structural-profiles.v1.js";

const v1 = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, {}).hall;
const migrated = migrateHallV1ToV2(v1);
assert.equal(migrated.migrated, true);
assert.deepEqual(migrated.errors, []);
assert.equal(migrated.hall.schema, "baustellenplaner.hall.v2");
assert.equal(migrated.hall.version, 2);
assert.equal(migrated.hall.id, v1.id);
assert.deepEqual(migrated.hall.dimensions, v1.dimensions);
assert.deepEqual(migrated.hall.roof, v1.roof);
assert.deepEqual(migrated.hall.envelope, v1.envelope);
assert.ok(migrated.hall.grid.longitudinal.axes.length > 1);
assert.equal(migrated.hall.structure.columns[0].id, "column:x00:z0");
assert.equal(migrated.hall.structure.columns[0].profileRef, DEFAULT_COLUMN_PROFILE_ID);
assert.equal(migrated.hall.structure.primaryMembers[0].profileRef, DEFAULT_PRIMARY_MEMBER_PROFILE_ID);
assert.ok(getStructuralProfile(DEFAULT_COLUMN_PROFILE_ID));
assert.ok(getStructuralProfile(DEFAULT_PRIMARY_MEMBER_PROFILE_ID));

const reopened = normalizeOrMigrateStoredHall(migrated.hall);
assert.equal(reopened.migrated, false);
assert.deepEqual(reopened.errors, []);
assert.deepEqual(reopened.hall, migrated.hall);

const originalAxes = new Map(migrated.hall.grid.longitudinal.axes.map((axis) => [axis.position, axis.id]));
const originalColumns = new Map(migrated.hall.structure.columns.map((element) => [`${element.axisId}:${element.side}`, element.id]));
const originalMembers = new Map(migrated.hall.structure.primaryMembers.map((element) => [element.axisId, element.id]));

const profileOnly = normalizeHallStructuralEdit(migrated.hall, { columnProfileRef: "profile:rhs:200x200x8" });
assert.deepEqual(profileOnly.errors, []);
assert.deepEqual(profileOnly.hall.grid.longitudinal.axes.map(({ id, position }) => ({ id, position })), migrated.hall.grid.longitudinal.axes.map(({ id, position }) => ({ id, position })));

const changed = normalizeHallStructuralEdit(migrated.hall, { columnProfileRef: "profile:rhs:200x200x8", grid: { longitudinal: { spacing: 6 } } });
assert.deepEqual(changed.errors, []);
assert.equal(changed.hall.structure.defaultColumnProfileRef, "profile:rhs:200x200x8");
assert.equal(changed.hall.structure.columns[0].profileRef, "profile:rhs:200x200x8");
assert.equal(changed.hall.grid.longitudinal.spacing, 6);
assert.equal(changed.hall.grid.longitudinal.axes.at(-1).position, changed.hall.dimensions.length);

for (const axis of changed.hall.grid.longitudinal.axes) {
  if (!originalAxes.has(axis.position)) continue;
  assert.equal(axis.id, originalAxes.get(axis.position), `Achse bei ${axis.position} m muss ihre stabile ID behalten.`);
  for (const side of ["z0", "zMax"]) {
    const column = changed.hall.structure.columns.find((element) => element.axisId === axis.id && element.side === side);
    assert.equal(column?.id, originalColumns.get(`${axis.id}:${side}`), `Stütze ${axis.id}:${side} muss ihre stabile ID behalten.`);
  }
  const member = changed.hall.structure.primaryMembers.find((element) => element.axisId === axis.id);
  assert.equal(member?.id, originalMembers.get(axis.id), `Hauptträger ${axis.id} muss seine stabile ID behalten.`);
}

const originalIdPositions = new Map(migrated.hall.grid.longitudinal.axes.map((axis) => [axis.id, axis.position]));
for (const axis of changed.hall.grid.longitudinal.axes) {
  if (originalIdPositions.has(axis.id)) assert.equal(axis.position, originalIdPositions.get(axis.id), `Achsen-ID ${axis.id} darf nicht auf eine andere Position recycelt werden.`);
}

const changedAgain = normalizeHallStructuralEdit(changed.hall, { grid: { longitudinal: { spacing: 5 } } });
assert.deepEqual(changedAgain.errors, []);
const history = new Map([...migrated.hall.grid.longitudinal.axes, ...changed.hall.grid.longitudinal.axes].map((axis) => [axis.id, axis.position]));
for (const axis of changedAgain.hall.grid.longitudinal.axes) {
  if (history.has(axis.id)) assert.equal(axis.position, history.get(axis.id), `Achsen-ID ${axis.id} darf auch bei Folge-Edits nicht recycelt werden.`);
}
assert.ok(Number.isInteger(changedAgain.hall.grid.longitudinal.identitySequence));

const combinedRapidEdit = normalizeHallStructuralEdit(migrated.hall, {
  dimensions: { length: 66, width: 32, eaveHeight: 9 },
  roof: { type: "gable", peakHeight: 12 },
  grid: { longitudinal: { spacing: 6 } },
  envelope: { walls: { "wall:x0": { construction: "open", visible: false } } },
  columnProfileRef: "profile:rhs:200x200x8",
  primaryMemberProfileRef: "profile:hea:200",
});
assert.deepEqual(combinedRapidEdit.errors, []);
assert.equal(combinedRapidEdit.hall.schema, "baustellenplaner.hall.v2");
assert.deepEqual(combinedRapidEdit.hall.dimensions, { length: 66, width: 32, eaveHeight: 9 });
assert.equal(combinedRapidEdit.hall.grid.longitudinal.spacing, 6);
assert.equal(combinedRapidEdit.hall.envelope.walls["wall:x0"].construction, "open");
assert.equal(combinedRapidEdit.hall.structure.defaultColumnProfileRef, "profile:rhs:200x200x8");
assert.equal(combinedRapidEdit.hall.structure.defaultPrimaryMemberProfileRef, "profile:hea:200");

const viewSource = await readFile(new URL("../modules/hall3d/view.js", import.meta.url), "utf8");
assert.match(viewSource, /commitHallStructuralEdit\(\{store,bus,reason:"bp-002:rapid-hall-edit"/);
assert.doesNotMatch(viewSource, /commitHallEdit\(/, "Hall3D V2 submit must not route through the V1 edit normalizer");

const invalid = normalizeHallStructuralEdit(migrated.hall, { columnProfileRef: "profile:not-real" });
assert.ok(invalid.errors.length > 0);
console.log("BP-002 hall structural configuration domain regression PASS");
