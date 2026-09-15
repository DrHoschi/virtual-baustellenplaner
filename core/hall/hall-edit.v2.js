import { deriveLongitudinalAxes, buildStructuralElements, normalizeStoredHallV2 } from "./hall-config.v2.js";
import { isStructuralProfileId } from "../library/structural-profiles.v1.js";

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

export function normalizeHallStructuralEdit(hallIn, changes = {}) {
  const hall = clone(hallIn);
  const columnProfileRef = changes.columnProfileRef ?? hall?.structure?.defaultColumnProfileRef;
  const primaryMemberProfileRef = changes.primaryMemberProfileRef ?? hall?.structure?.defaultPrimaryMemberProfileRef;
  if (!isStructuralProfileId(columnProfileRef) || !isStructuralProfileId(primaryMemberProfileRef)) {
    return { hall, derived: {}, warnings: [], errors: ["Unbekannte Structural-Profile-Referenz."] };
  }
  hall.structure.defaultColumnProfileRef = columnProfileRef;
  hall.structure.defaultPrimaryMemberProfileRef = primaryMemberProfileRef;
  if (typeof changes.columnsEnabled === "boolean") hall.structure.columnsEnabled = changes.columnsEnabled;
  if (typeof changes.primaryBeamsEnabled === "boolean") hall.structure.primaryBeamsEnabled = changes.primaryBeamsEnabled;
  const axes = deriveLongitudinalAxes(hall.dimensions.length, hall.grid.longitudinal.spacing);
  hall.grid.longitudinal.axes = axes;
  const elements = buildStructuralElements({ axes, width: hall.dimensions.width, columnProfileId: columnProfileRef, primaryMemberProfileId: primaryMemberProfileRef });
  hall.structure.columns = elements.columns;
  hall.structure.primaryMembers = elements.primaryMembers;
  return normalizeStoredHallV2(hall);
}

export function commitHallStructuralEdit({ store, bus, changes = {}, reason = "bp-002:hall-structural-edit" } = {}) {
  const hall = store?.get?.("app")?.project?.hall;
  const result = normalizeHallStructuralEdit(hall, changes);
  if (result.errors.length) return { committed: false, ...result };
  store.update("app", (draft) => { if (!draft.project) draft.project = {}; draft.project.hall = result.hall; });
  bus.emit("ui:project:save", { reason });
  bus.emit("req:hall3d:rebuild", { reason });
  return { committed: true, ...result };
}
