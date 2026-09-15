import assert from "node:assert/strict";
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

const changed = normalizeHallStructuralEdit(migrated.hall, { columnProfileRef: "profile:rhs:200x200x8", grid: { longitudinal: { spacing: 6 } } });
assert.deepEqual(changed.errors, []);
assert.equal(changed.hall.structure.defaultColumnProfileRef, "profile:rhs:200x200x8");
assert.equal(changed.hall.structure.columns[0].profileRef, "profile:rhs:200x200x8");
assert.equal(changed.hall.grid.longitudinal.spacing, 6);
assert.equal(changed.hall.grid.longitudinal.axes.at(-1).position, changed.hall.dimensions.length);

const invalid = normalizeHallStructuralEdit(migrated.hall, { columnProfileRef: "profile:not-real" });
assert.ok(invalid.errors.length > 0);
console.log("BP-002 hall structural configuration domain regression PASS");
