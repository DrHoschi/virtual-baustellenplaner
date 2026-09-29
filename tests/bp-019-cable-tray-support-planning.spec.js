import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");

test("BP-019 keeps support spacing route-owned and support quantities derived", () => {
  expect(source).toContain("selectedRoute.tray.supportSpacingM = Number.isFinite(next) && next > 0 ? next : null");
  expect(source).toContain('_persistSceneToStore("cable-tray-support-spacing")');
  expect(source).toContain("supportSpacingM: null");
  expect(source).toContain('aria-label", "Stützabstand in Metern"');

  expect(source).toContain("_getCableTraySupportPreparationV1()");
  expect(source).toContain("const routes = this._getCableTrayEvaluation().routes");
  expect(source).toContain('if (route.routeClass !== "new") continue');
  expect(source).toContain("Math.max(2, Math.ceil(routeLengthM / supportSpacingM) + 1)");
  expect(source).toContain("undeterminedRoutes.push(route)");
  expect(source).toContain('const key = `${widthMm}|${trayType}|${supportSpacingM}|${supportType || ""}`;');
  expect(source).toContain("group.supportCount += supportCount");
  expect(source).toContain("Unterstützungsplanung (Neu)");
  expect(source).toContain("Stützabstand unbestimmt");

  const start = source.indexOf("_getCableTraySupportPreparationV1()");
  const end = source.indexOf("_getSupportMaterialCompositionsV1()", start);
  const block = source.slice(start, end);
  expect(block).not.toMatch(/c-?rail|hilti|niedax|console|bracket|threaded|dowel|screw|articleNumber|manufacturer/i);
});
