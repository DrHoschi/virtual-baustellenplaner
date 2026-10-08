import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");
const cableTraySource = fs.readFileSync("ui/workarea/workarea-cable-tray.v1.js", "utf8");

test("BP-020 keeps support type route-owned and support quantities BP-019-derived", () => {
  expect(cableTraySource).toContain('supportType: null');
  expect(baseSource).toContain('selectedRoute.tray.supportType = next || null');
  expect(baseSource).toContain('_persistSceneToStore("cable-tray-support-type")');
  expect(cableTraySource).toContain('supportType: typeof o?.tray?.supportType === "string" && o.tray.supportType.trim()');
  expect(cableTraySource).toContain('const key = `${widthMm}|${trayType}|${supportSpacingM}|${supportType || ""}`');
  expect(cableTraySource).toContain('Math.max(2, Math.ceil(routeLengthM / supportSpacingM) + 1)');
  expect(cableTraySource).toContain('Stützart ${row.supportType || "unbestimmt"}');
});

test("BP-020 does not turn support classification into mounting hardware or material output", () => {
  const supportStart = cableTraySource.indexOf("  _getCableTraySupportPreparationV1() {");
  const supportEnd = cableTraySource.indexOf("  _getSupportMaterialCompositionsV1() {", supportStart);
  expect(supportStart).toBeGreaterThan(-1);
  expect(supportEnd).toBeGreaterThan(supportStart);

  const supportBlock = cableTraySource.slice(supportStart, supportEnd);
  expect(supportBlock).toContain("supportType");
  expect(supportBlock).not.toMatch(/c-?rail|hilti|niedax|bracket|threaded|dowel|screw|articleNumber|manufacturer/i);

  const materialOutputStart = cableTraySource.indexOf("  _getCableTrayMaterialOutputRowsV1() {", supportEnd);
  const materialEnd = cableTraySource.indexOf("  _getCombinedCableTrayMaterialOutputRowsV1() {", materialOutputStart);
  expect(materialOutputStart).toBeGreaterThan(supportEnd);
  expect(materialEnd).toBeGreaterThan(materialOutputStart);
  const materialBlock = cableTraySource.slice(materialOutputStart, materialEnd);
  expect(materialBlock).not.toContain("supportType");
  expect(materialBlock).not.toContain("supportCount");
});
