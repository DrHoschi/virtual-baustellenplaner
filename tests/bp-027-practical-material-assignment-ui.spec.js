import { test, expect } from "@playwright/test";

test.describe("BP-027 practical material assignment UI contract", () => {
  test("keeps article assignment on BP-026 and BP-021 authorities without quantity ownership", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain("_openCableTrayMaterialAssignmentV1()");
    expect(source).toContain("_renderCableTrayMaterialAssignmentV1()");
    expect(source).toContain('this._btn("Materialzuordnung", () => this._openCableTrayMaterialAssignmentV1())');
    expect(source).toContain('this._btn("Material", () => this._openCableTrayMaterialAssignmentV1())');
    expect(source).toContain("_getCableTrayMaterialAssignmentRowsV1()");

    expect(source).toContain("_setProjectMaterialMappingV1(keyValue, materialIdValue)");
    expect(source).toContain("next.project.materialMappings = rows");
    expect(source).toContain('_requestProjectSaveDebounced("material-assignment")');

    expect(source).toContain("_setSupportMaterialComponentMaterialIdV1(supportTypeValue, componentIndexValue, materialIdValue)");
    expect(source).toContain("components[componentIndex] = { ...components[componentIndex], materialId: materialId || null }");

    const mappingStart = source.indexOf("_setProjectMaterialMappingV1(keyValue, materialIdValue)");
    const mappingEnd = source.indexOf("_setSupportMaterialComponentMaterialIdV1(", mappingStart);
    const mappingBlock = source.slice(mappingStart, mappingEnd);
    expect(mappingBlock).not.toMatch(/purchaseLengthM|requiredStickCount|supportCount|derivedQuantity/);

    const supportStart = source.indexOf("_setSupportMaterialComponentMaterialIdV1(supportTypeValue, componentIndexValue, materialIdValue)");
    const supportEnd = source.indexOf("_getCableTrayMaterialAssignmentRowsV1()", supportStart);
    const supportBlock = source.slice(supportStart, supportEnd);
    expect(supportBlock).not.toContain("components.push");
    expect(supportBlock).not.toMatch(/quantityPerSupport\s*=|supportCount\s*=|derivedQuantity\s*=/);

    expect(source).toContain("Keine Materialartikel im globalen Katalog vorhanden.");
    expect(source).toContain('none.textContent = "Nicht zugeordnet"');
    expect(source).toContain("this._globalMaterialCatalogV1?.materials");
    expect(source).not.toContain("Niedax · 123");
    expect(source).not.toContain("Hilti · 123");
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
