import { test, expect } from "@playwright/test";

test("BP-015 practical cable preparation output reuses BP-014 authority and existing delivery helpers", async ({ page }) => {
  await page.goto("./");

  const source = await page.locator("body").evaluate(async () =>
    await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
  );

  expect(source).toContain("_makeCablePreparationCSVV1(rows = [])");
  expect(source).toContain("const rows = this._getProjectCablePreparationRowsV1();");
  expect(source).toContain("const cl = row?.cableLine || {};");
  expect(source).toContain("const assignment = row?.assignment || {};");
  expect(source).toContain('lengthValue(assignment.plannedRequiredLengthM, "Bedarf unbestimmt")');
  expect(source).toContain('lengthValue(assignment.plannedCutLengthM, "Zuschnitt unbestimmt")');
  expect(source).toContain('this._btn("Export CSV"');
  expect(source).toContain('this._downloadTextFileV1(fileName, csv, "text/csv;charset=utf-8")');
  expect(source).toContain("const copied = await this._copyToClipboard(csv);");

  expect(source).not.toContain("sceneObj.cutList");
  expect(source).not.toContain("sceneObj.preparationOutput");
  expect(source).not.toContain("cableLine.plannedCutLengthM =");
  expect(source).not.toContain("cableLine.plannedRequiredLengthM =");

  expect(source).toContain('schema: "baustellenplaner.assemblylab.cablelist.export.v1"');
  expect(source).toContain("cableLines: sceneObj.cableLines || []");
});
