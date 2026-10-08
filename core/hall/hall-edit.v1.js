import { normalizeStoredHall } from "./hall-config.v1.js";

export const HALL_EDIT_WALL_IDS = Object.freeze([
  "wall:x0",
  "wall:xMax",
  "wall:z0",
  "wall:zMax",
]);

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (!isObject(value)) return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = clonePlain(item);
  return out;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function applyWhitelistedChanges(hallIn, changes = {}) {
  const next = clonePlain(hallIn);
  const patch = isObject(changes) ? changes : {};

  if (isObject(patch.dimensions)) {
    next.dimensions = isObject(next.dimensions) ? next.dimensions : {};
    for (const key of ["length", "width", "eaveHeight"]) {
      if (hasOwn(patch.dimensions, key)) next.dimensions[key] = patch.dimensions[key];
    }
  }

  if (isObject(patch.roof)) {
    next.roof = isObject(next.roof) ? next.roof : {};
    if (hasOwn(patch.roof, "type")) next.roof.type = patch.roof.type;
    if (hasOwn(patch.roof, "peakHeight")) next.roof.peakHeight = patch.roof.peakHeight;
  }

  if (isObject(patch.grid?.longitudinal) && hasOwn(patch.grid.longitudinal, "spacing")) {
    next.grid = isObject(next.grid) ? next.grid : {};
    next.grid.longitudinal = isObject(next.grid.longitudinal) ? next.grid.longitudinal : {};
    next.grid.longitudinal.spacing = patch.grid.longitudinal.spacing;
  }

  if (isObject(patch.envelope?.walls)) {
    next.envelope = isObject(next.envelope) ? next.envelope : {};
    next.envelope.walls = isObject(next.envelope.walls) ? next.envelope.walls : {};

    for (const wallId of HALL_EDIT_WALL_IDS) {
      const wallPatch = patch.envelope.walls[wallId];
      if (!isObject(wallPatch)) continue;

      const currentWall = isObject(next.envelope.walls[wallId])
        ? next.envelope.walls[wallId]
        : { construction: "present", visible: true };

      next.envelope.walls[wallId] = { ...currentWall };
      if (hasOwn(wallPatch, "construction")) {
        next.envelope.walls[wallId].construction = wallPatch.construction;
      }
      if (hasOwn(wallPatch, "visible")) {
        next.envelope.walls[wallId].visible = wallPatch.visible;
      }
    }
  }

  return next;
}

/**
 * BP-HI01B.3 pure edit boundary.
 * Only the rapid-hall fields above may be changed. Existing project data such
 * as openings, partitions, levels, structure, transform and presetRef is kept
 * and then validated through the stored-hall normalizer (no preset reapply).
 */
export function normalizeHallEdit(hallIn, changes = {}) {
  if (!isObject(hallIn)) {
    return {
      hall: hallIn,
      derived: {},
      warnings: [],
      errors: ["Projekt enthält keine bearbeitbare Hallenkonfiguration."],
    };
  }

  return normalizeStoredHall(applyWhitelistedChanges(hallIn, changes));
}

/**
 * Authoritative product commit path:
 * normalize -> app.project.hall -> central Persistor event -> regeneration.
 *
 * The central loader handles ui:project:save synchronously via
 * persistor.saveNow(). This module never reads or writes store.hall3d.
 */
export function commitHallEdit({ store, bus, changes = {}, reason = "bp-hi01b3:hall-edit" } = {}) {
  if (!store?.get || !store?.update || !bus?.emit) {
    return {
      committed: false,
      hall: null,
      derived: {},
      warnings: [],
      errors: ["Hall Edit Binding benötigt Store und Event-Bus."],
    };
  }

  const app = store.get("app");
  const currentHall = app?.project?.hall;
  const result = normalizeHallEdit(currentHall, changes);

  if (result.errors.length) {
    return { committed: false, ...result };
  }

  store.update("app", (draft) => {
    if (!draft.project) draft.project = {};
    draft.project.hall = result.hall;
  });

  bus.emit("ui:project:save", { reason });
  bus.emit("req:hall3d:rebuild", { reason });

  return { committed: true, ...result };
}
