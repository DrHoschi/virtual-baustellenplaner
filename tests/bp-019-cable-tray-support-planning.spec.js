import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");
const cableTraySource = fs.readFileSync("ui/workarea/workarea-cable-tray.v1.js", "utf8");

test("BP-019 keeps support spacing route-owned and support quantities derived", () => {
  expect(baseSource).toContain("selectedRoute.tray.supportSpacingM = Number.isFinite(next) && next > 0 ? next : null");
  expect(baseSource).toContain('_persistSceneToStore("cable-tray-support-spacing")');
  expect(cableTraySource).toContain("supportSpacingM: null");
  expect(baseSource).toContain('aria-label", "Stützabstand in Metern"');

  expect(cableTraySource).toContain("_getCableTraySupportPreparationV1()");
  expect(cableTraySource).toContain("const routes = this._getCableTrayEvaluation().routes");
  expect(cableTraySource).toContain('if (route.routeClass !== "new") continue');
  expect(cableTraySource).toContain("Math.max(2, Math.ceil(routeLengthM / supportSpacingM) + 1)");
  expect(cableTraySource).toContain("undeterminedRoutes.push(route)");
  expect(cableTraySource).toContain('const key = `${widthMm}|${trayType}|${supportSpacingM}|${supportType || ""}`;');
  expect(cableTraySource).toContain("group.supportCount += supportCount");
  expect(cableTraySource).toContain("Unterstützungsplanung (Neu)");
  expect(cableTraySource).toContain("Stützabstand unbestimmt");

  const start = cableTraySource.indexOf("_getCableTraySupportPreparationV1()");
  const end = cableTraySource.indexOf("_getSupportMaterialCompositionsV1()", start);
  const block = cableTraySource.slice(start, end);
  expect(block).not.toMatch(/c-?rail|hilti|niedax|console|bracket|threaded|dowel|screw|articleNumber|manufacturer/i);
});
