import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");

test("BP-020 keeps support type route-owned and support quantities BP-019-derived", () => {
  expect(source).toContain('supportType: null');
  expect(source).toContain('selectedRoute.tray.supportType = next || null');
  expect(source).toContain('_persistSceneToStore("cable-tray-support-type")');
  expect(source).toContain('supportType: typeof o?.tray?.supportType === "string" && o.tray.supportType.trim()');
  expect(source).toContain('const key = `${widthMm}|${trayType}|${supportSpacingM}|${supportType || ""}`');
  expect(source).toContain('Math.max(2, Math.ceil(routeLengthM / supportSpacingM) + 1)');
  expect(source).toContain('Stützart ${row.supportType || "unbestimmt"}');
});

test("BP-020 does not turn support classification into mounting hardware or material output", () => {
  const supportStart = source.indexOf("_getCableTraySupportPreparationV1()");
  const materialOutputStart = source.indexOf("_getCableTrayMaterialOutputRowsV1()", supportStart);
  expect(supportStart).toBeGreaterThan(-1);
  expect(materialOutputStart).toBeGreaterThan(supportStart);

  const supportBlock = source.slice(supportStart, materialOutputStart);
  expect(supportBlock).toContain("supportType");
  expect(supportBlock).not.toMatch(/c-?rail|hilti|niedax|bracket|threaded|dowel|screw|articleNumber|manufacturer/i);

  const materialEnd = source.indexOf("_makeCableTrayMaterialCSVV1", materialOutputStart);
  const materialBlock = source.slice(materialOutputStart, materialEnd);
  expect(materialBlock).not.toContain("supportType");
  expect(materialBlock).not.toContain("supportCount");
});
