import { test, expect } from "@playwright/test";

test.describe("BP-027 practical material assignment UI contract", () => {
  test("keeps article assignment on BP-026 and BP-021 authorities without quantity ownership", async ({ page }) => {
    await page.goto("/");
    const [baseSource, cableTraySource] = await page.locator("body").evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    ]));

    expect(cableTraySource).toContain("_openCableTrayMaterialAssignmentV1()");
    expect(cableTraySource).toContain("_renderCableTrayMaterialAssignmentV1()");
    expect(baseSource).toContain('this._btn("Materialzuordnung", () => this._openCableTrayMaterialAssignmentV1())');
    expect(baseSource).toContain('this._btn("Material", () => this._openCableTrayMaterialAssignmentV1())');
    expect(cableTraySource).toContain("_getCableTrayMaterialAssignmentRowsV1()");
    expect(cableTraySource).toContain("dutyClass: row.dutyClass");
    expect(cableTraySource).toContain("_cableTrayMappingDutyClassMatchesV1(mapping, row.dutyClass)");

    expect(cableTraySource).toContain("_setProjectMaterialMappingV1(keyValue, materialIdValue)");
    expect(cableTraySource).toContain("next.project.materialMappings = rows");
    expect(cableTraySource).toContain('_requestProjectSaveDebounced("material-assignment")');

    expect(cableTraySource).toContain("_setSupportMaterialComponentMaterialIdV1(supportTypeValue, componentIndexValue, materialIdValue)");
    expect(cableTraySource).toContain("components[componentIndex] = { ...components[componentIndex], materialId: materialId || null }");

    const mappingStart = cableTraySource.indexOf("_setProjectMaterialMappingV1(keyValue, materialIdValue)");
    const mappingEnd = cableTraySource.indexOf("_setSupportMaterialComponentMaterialIdV1(", mappingStart);
    const mappingBlock = cableTraySource.slice(mappingStart, mappingEnd);
    expect(mappingBlock).not.toMatch(/purchaseLengthM|requiredStickCount|supportCount|derivedQuantity/);

    const supportStart = cableTraySource.indexOf("_setSupportMaterialComponentMaterialIdV1(supportTypeValue, componentIndexValue, materialIdValue)");
    const supportEnd = cableTraySource.indexOf("_getCableTrayMaterialAssignmentRowsV1()", supportStart);
    const supportBlock = cableTraySource.slice(supportStart, supportEnd);
    expect(supportBlock).not.toContain("components.push");
    expect(supportBlock).not.toMatch(/quantityPerSupport\s*=|supportCount\s*=|derivedQuantity\s*=/);

    expect(cableTraySource).toContain("Keine Materialartikel im globalen Katalog vorhanden.");
    expect(cableTraySource).toContain('none.textContent = "Nicht zugeordnet"');
    expect(cableTraySource).toContain("this._globalMaterialCatalogV1?.materials");
    expect(cableTraySource).not.toContain("Niedax · 123");
    expect(cableTraySource).not.toContain("Hilti · 123");
  });

  test("keeps the assignment dialog responsive without horizontal table dependency", async ({ page }) => {
    await page.goto("/");
    const css = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/css/ui-workarea.css")).text()
    );

    expect(css).toContain(".wa-material-assignment-row");
    expect(css).toContain("grid-template-columns: minmax(180px, .8fr) minmax(280px, 1.2fr)");
    expect(css).toMatch(/@media \(max-width: 820px\)[\s\S]*\.wa-material-assignment-row[\s\S]*grid-template-columns:\s*1fr/);
    expect(css).toContain(".wa-material-assignment-select");
    expect(css).toContain("width: 100%");
  });
});
