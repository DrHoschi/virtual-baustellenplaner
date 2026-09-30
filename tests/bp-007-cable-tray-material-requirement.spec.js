import { test, expect } from "@playwright/test";

test.describe("BP-007 cable tray material requirement contract", () => {
  test("derives 3 m purchasing requirement only from new 100/200 tray totals", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    );

    expect(source).toContain("_getCableTrayMaterialRequirement()");
    expect(source).toContain("const totals = this._getCableTrayGroupedTotals()");
    expect(source).toContain("const stickLengthM = 3");
    expect(source).toContain("const plannedLengthM = Number(totals?.new?.[widthMm] || 0)");
    expect(source).toContain("const requiredStickCount = Math.ceil(plannedLengthM / stickLengthM)");
    expect(source).toContain("const purchaseLengthM = requiredStickCount * stickLengthM");
    expect(source).toContain("const offcutM = purchaseLengthM - plannedLengthM");
    expect(source).toContain("rows: [makeRow(100), makeRow(200)]");
    expect(source).not.toContain("totals?.existing?.[widthMm]");
  });

  test("keeps material values derived and preserves BP-002 through BP-006 authorities", async ({ page }) => {
    await page.goto("/");
    const [baseSource, cableTraySource] = await page.locator("body").evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    ]));

    expect(cableTraySource).toContain('String(o?.type || "") !== "cable-tray.route"');
    expect(cableTraySource).toContain("const lengthM = this._getCableTrayLengthM(o)");
    expect(cableTraySource).toContain("totals[routeClass][widthMm] += lengthM");
    expect(cableTraySource).toContain('routeClass: String(this._cableTrayDraft?.routeClass || "") === "existing" ? "existing" : "new"');
    expect(baseSource).toContain("point.x = nx");
    expect(baseSource).toContain("point.y = ny");
    expect(baseSource).toContain("item.startRef = this._sanitizeCableTrayEndpointRef(o?.startRef)");
    expect(baseSource).toContain("item.endRef = this._sanitizeCableTrayEndpointRef(o?.endRef)");

    expect(cableTraySource).not.toContain("item.requiredStickCount =");
    expect(cableTraySource).not.toContain("item.purchaseLengthM =");
    expect(cableTraySource).not.toContain("item.offcutM =");
    expect(cableTraySource).not.toContain("tray.requiredStickCount");
    expect(cableTraySource).not.toContain("tray.purchaseLengthM");
    expect(cableTraySource).not.toContain("tray.offcutM");
  });

  test("extends only the existing tray evaluation presentation and does not use assembly BOM", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    );

    expect(source).toContain("const material = this._getCableTrayMaterialPreparationV1()");
    expect(source).toContain("Materialbedarf (Neu)");
    expect(source).toContain("Verschnitt");
    expect(source).not.toContain("buildBomFromAssemblyInstance(");
  });
});
