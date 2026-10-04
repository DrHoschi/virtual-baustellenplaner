import { test, expect } from "@playwright/test";

test("BP-014 project cable preparation keeps existing cable authority and derived-state boundaries", async ({ page }) => {
  await page.goto("./");

  const [source, routingSource] = await page.locator("body").evaluate(async () => Promise.all([
    (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
    (await fetch("/ui/workarea/workarea-assembly-cable-routing.v1.js")).text()
  ]));

  expect(source).toContain("_getProjectCablePreparationRowsV1()");
  expect(source).toContain('String(sceneObj?.type || "") !== "assembly.instance"');
  expect(source).toContain("Array.isArray(sceneObj?.cableLines) ? sceneObj.cableLines : []");
  expect(source).toContain("if (!cableLine || cableLine.enabled === false) continue;");
  expect(source).toContain("assignment: this._getCableLineRouteAssignmentV1(cableLine, sceneObj)");
  expect(source).toContain("_renderCablePreparationListV1()");
  expect(source).toContain('"Kabelvorbereitung"');
  expect(source).toContain('"Zuschnitt unbestimmt"');
  expect(source).toContain("assignment.plannedCutLengthM.toFixed(2)");

  // BP-014 is a runtime projection only: no second cable/cut-list authority.
  expect(source).not.toContain("sceneObj.cutList");
  expect(source).not.toContain("sceneObj.preparationLines");
  expect(source).not.toContain("cableLine.plannedCutLengthM =");
  expect(source).not.toContain("cableLine.plannedRequiredLengthM =");
  expect(routingSource).not.toContain("cableLine.plannedCutLengthM =");
  expect(routingSource).not.toContain("cableLine.plannedRequiredLengthM =");

  // Existing Assembly cable-list JSON export remains its established schema.
  expect(source).toContain('schema: "baustellenplaner.assemblylab.cablelist.export.v1"');
  expect(source).toContain("cableLines: sceneObj.cableLines || []");

  // BP-013 derivation remains the single calculation authority.
  expect(routingSource).toContain("const plannedCutLengthM = plannedRequiredLengthM !== null && cutAllowanceM !== null");
  expect(routingSource).toContain("? plannedRequiredLengthM + cutAllowanceM");
});
