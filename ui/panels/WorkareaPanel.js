import { WorkareaPanel as WorkareaPanelBase } from "./WorkareaPanel.base.js";

export class WorkareaPanel extends WorkareaPanelBase {
  getPlanningHallContext() {
    try {
      const app = this.store?.get?.("app") || {};
      const hall = app?.project?.hall;
      if (!hall || typeof hall !== "object") return null;

      const dimensions = hall?.dimensions && typeof hall.dimensions === "object" ? hall.dimensions : {};
      const finiteOrNull = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      };

      return Object.freeze({
        authority: "app.project.hall",
        hallId: hall?.id || hall?.presetRef?.id || null,
        length: finiteOrNull(dimensions.length),
        width: finiteOrNull(dimensions.width),
        eaveHeight: finiteOrNull(dimensions.eaveHeight),
        roofType: hall?.roof?.type || null
      });
    } catch {
      return null;
    }
  }
}
