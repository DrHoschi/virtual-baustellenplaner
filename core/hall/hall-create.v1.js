import {
  HALL_INDUSTRY_GABLE_V1,
  normalizeHallConfig,
} from "./hall-config.v1.js";

/**
 * PROJECT-UI-04A – Existing Project Hall Creation Entry
 * Pure creation commit boundary for an already-open project with no hall.
 *
 * Authority remains app.project.hall.
 * This module has no DOM, Three.js or project-wizard responsibility.
 */
export function commitHallCreate({
  store,
  bus,
  input = {},
  reason = "project-ui-04a:create-hall",
} = {}) {
  if (!store?.get || !store?.update || !bus?.emit) {
    return {
      committed: false,
      hall: null,
      derived: {},
      warnings: [],
      errors: ["Hall Creation benötigt Store und Event-Bus."],
    };
  }

  const app = store.get("app") || {};
  if (!app?.project) {
    return {
      committed: false,
      hall: null,
      derived: {},
      warnings: [],
      errors: ["Kein geöffnetes Projekt vorhanden."],
    };
  }

  if (app.project.hall) {
    return {
      committed: false,
      hall: app.project.hall,
      derived: {},
      warnings: [],
      errors: ["Für dieses Projekt ist bereits eine Halle konfiguriert."],
    };
  }

  const result = normalizeHallConfig(HALL_INDUSTRY_GABLE_V1, input);
  if (result.errors.length) {
    return { committed: false, ...result };
  }

  store.update("app", (draft) => {
    if (!draft.project) return;
    if (draft.project.hall) return;
    draft.project.hall = result.hall;
  });

  const committedHall = store.get("app")?.project?.hall;
  if (!committedHall) {
    return {
      committed: false,
      ...result,
      errors: ["Halle konnte dem geöffneten Projekt nicht zugeordnet werden."],
    };
  }

  bus.emit("ui:project:save", { reason });
  bus.emit("req:hall3d:rebuild", { reason });

  return { committed: true, ...result };
}
