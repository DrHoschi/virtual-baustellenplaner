import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");

test("BP-021 keeps support material composition project-owned and totals derived", () => {
  expect(source).toContain("_getSupportMaterialCompositionsV1()");
  expect(source).toContain("app?.project?.supportMaterialCompositions");
  expect(source).toContain("next.project.supportMaterialCompositions = compositions");
  expect(source).toContain('_requestProjectSaveDebounced("support-material-composition")');

  expect(source).toContain("_getCableTraySupportMaterialPreparationV1()");
  expect(source).toContain("const supportRows = this._getCableTraySupportPreparationV1().rows");
  expect(source).toContain("derivedQuantity: supportRow.supportCount * quantityPerSupport");
  expect(source).toContain('reason: "support-type-undetermined"');
  expect(source).toContain('reason: "composition-undetermined"');
});

test("BP-021 does not create a route copy, assembly BOM authority, or BP-018 support output", () => {
  const start = source.indexOf("_getSupportMaterialCompositionsV1()");
  const outputStart = source.indexOf("_getCableTrayMaterialOutputRowsV1()", start);
  expect(start).toBeGreaterThan(-1);
  expect(outputStart).toBeGreaterThan(start);

  const bp021Block = source.slice(start, outputStart);
  expect(bp021Block).toContain("supportMaterialCompositions");
  expect(bp021Block).not.toContain("assembly.instance.bom");
  expect(bp021Block).not.toContain("selectedRoute.tray.supportMaterial");
  expect(bp021Block).not.toMatch(/manufacturer|articleNumber|hilti|niedax/i);

  const materialEnd = source.indexOf("_makeCableTrayMaterialCSVV1", outputStart);
  const materialBlock = source.slice(outputStart, materialEnd);
  expect(materialBlock).not.toContain("supportMaterialCompositions");
  expect(materialBlock).not.toContain("derivedQuantity");
});
