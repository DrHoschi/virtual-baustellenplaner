import { normalizeStoredHall } from "./hall-config.v1.js";
import { HALL_SCHEMA_V2, HALL_VERSION_V2, deriveLongitudinalAxes, buildStructuralElements, normalizeStoredHallV2 } from "./hall-config.v2.js";
import { DEFAULT_COLUMN_PROFILE_ID, DEFAULT_PRIMARY_MEMBER_PROFILE_ID } from "../library/structural-profiles.v1.js";

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

export function migrateHallV1ToV2(hallV1) {
  const source = normalizeStoredHall(hallV1);
  if (source.errors.length) return { migrated: false, hall: hallV1, errors: source.errors, warnings: source.warnings, derived: source.derived };
  const hall = clone(source.hall);
  const axes = deriveLongitudinalAxes(hall.dimensions.length, hall.grid.longitudinal.spacing);
  const elements = buildStructuralElements({ axes, width: hall.dimensions.width, columnProfileId: DEFAULT_COLUMN_PROFILE_ID, primaryMemberProfileId: DEFAULT_PRIMARY_MEMBER_PROFILE_ID });
  hall.schema = HALL_SCHEMA_V2;
  hall.version = HALL_VERSION_V2;
  hall.grid.longitudinal.axes = axes;
  hall.structure = {
    columnsEnabled: hall.structure?.columnsEnabled !== false,
    primaryBeamsEnabled: hall.structure?.primaryBeamsEnabled !== false,
    defaultColumnProfileRef: DEFAULT_COLUMN_PROFILE_ID,
    defaultPrimaryMemberProfileRef: DEFAULT_PRIMARY_MEMBER_PROFILE_ID,
    columns: elements.columns,
    primaryMembers: elements.primaryMembers,
  };
  const result = normalizeStoredHallV2(hall);
  return { migrated: !result.errors.length, ...result };
}

export function normalizeOrMigrateStoredHall(hall) {
  if (hall?.schema === HALL_SCHEMA_V2 || hall?.version === HALL_VERSION_V2) return { migrated: false, ...normalizeStoredHallV2(hall) };
  return migrateHallV1ToV2(hall);
}
