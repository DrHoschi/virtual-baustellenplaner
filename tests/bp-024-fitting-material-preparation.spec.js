import { test, expect } from "@playwright/test";

test.describe("BP-024 fitting material preparation contract", () => {
  test("derives piece counts only from valid explicit BP-023 fittings", async ({ page }) => {
    await page.goto("/");
    const source = await page.evaluate(async () => await (await fetch("/ui/panels/WorkareaPanel.base.js")).text());

    const start = source.indexOf("  _getCableTrayFittingMaterialPreparationV1(");
    const end = source.indexOf("\n  _", start + 3);
    const block = source.slice(start, end);

    expect(block).toContain("this._scene?.cableTrayFittings");
    expect(block).toContain("this._validateCableTrayFittingV1(fitting)");
    expect(block).toContain("unresolvedCount += 1");
    expect(block).toContain('unit: "Stk"');
    expect(block).toContain("quantity: counts.get(kind)");
    expect(block).toContain('bend: "Bogen"');
    expect(block).toContain('tee: "T-Stück"');
    expect(block).toContain('reducer: "Reduzierung"');
    expect(block).toContain('connector: "Verbinder"');
    expect(block).not.toContain("Math.atan");
    expect(block).not.toContain("Math.hypot");
    expect(block).not.toContain("widthMm");
    expect(block).not.toContain("trayType");
    expect(block).not.toContain("_persistSceneToStore");
  });

  test("keeps unresolved fittings diagnostic separate from material rows", async ({ page }) => {
    await page.goto("/");
    const source = await page.evaluate(async () => await (await fetch("/ui/panels/WorkareaPanel.base.js")).text());

    const start = source.indexOf("  _getCableTrayFittingMaterialPreparationV1(");
    const end = source.indexOf("\n  _", start + 3);
    const block = source.slice(start, end);
    expect(block).toContain("return { rows, unresolvedCount }");

    const combinedStart = source.indexOf("  _getCombinedCableTrayMaterialOutputRowsV1(");
    const combinedEnd = source.indexOf("\n  _", combinedStart + 3);
    const combinedBlock = source.slice(combinedStart, combinedEnd);
    expect(combinedBlock).toContain("_getCableTrayFittingMaterialPreparationV1().rows");
    expect(combinedBlock).not.toContain("unresolvedCount");
  });

  test("shows only the minimal derived fitting-material status in the tray UI", async ({ page }) => {
    await page.goto("/");
    const source = await page.evaluate(async () => await (await fetch("/ui/panels/WorkareaPanel.base.js")).text());
    expect(source).toContain("wa-tray-fitting-material-state");
    expect(source).toContain("Formteile:");
    expect(source).toContain("ungelöst");
  });
});
