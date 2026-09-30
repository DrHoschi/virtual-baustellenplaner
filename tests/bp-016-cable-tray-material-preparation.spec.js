import { test, expect } from "@playwright/test";

test.describe("BP-016 practical cable tray material preparation contract", () => {
  test("groups new tray material by existing width and trayType using BP-004 route rows", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    );

    expect(source).toContain("trayType: String(o?.tray?.trayType || \"cable-tray\")");
    expect(source).toContain("_getCableTrayMaterialPreparationV1()");
    expect(source).toContain("const routes = this._getCableTrayEvaluation().routes");
    expect(source).toContain('if (route.routeClass !== "new") continue');
    expect(source).toContain("const key = `${widthMm}|${trayType}`");
    expect(source).toContain("groups.get(key).plannedLengthM += Number(route.lengthM || 0)");
  });

  test("preserves BP-007 3 m purchasing semantics without a second persistent material authority", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    );

    expect(source).toContain("const stickLengthM = 3");
    expect(source).toContain("Math.ceil(row.plannedLengthM / stickLengthM)");
    expect(source).toContain("const purchaseLengthM = requiredStickCount * stickLengthM");
    expect(source).toContain("const offcutM = purchaseLengthM - row.plannedLengthM");
    expect(source).not.toContain("tray.materialPreparation");
    expect(source).not.toContain("item.materialPreparation");
  });

  test("reuses the existing tray evaluation UI and does not introduce BOM or article authority", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    );

    expect(source).toContain("const material = this._getCableTrayMaterialPreparationV1()");
    expect(source).toContain("Materialbedarf (Neu)");
    expect(source).toContain("row.trayType");
    expect(source).not.toContain("tray.articleNo");
    expect(source).not.toContain("tray.manufacturer");
    expect(source).not.toContain("buildBomFromAssemblyInstance(");
  });
});
