import { test, expect } from "@playwright/test";

test.describe("BP-007 cable tray material requirement contract", () => {
  test("derives 3 m purchasing requirement only from new 100/200 tray totals", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
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
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain('String(o?.type || "") !== "cable-tray.route"');
    expect(source).toContain("const lengthM = this._getCableTrayLengthM(o)");
    expect(source).toContain("totals[routeClass][widthMm] += lengthM");
    expect(source).toContain('routeClass: String(this._cableTrayDraft?.routeClass || "") === "existing" ? "existing" : "new"');
    expect(source).toContain("point.x = nx");
    expect(source).toContain("point.y = ny");
    expect(source).toContain("item.startRef = this._sanitizeCableTrayEndpointRef(o?.startRef)");
    expect(source).toContain("item.endRef = this._sanitizeCableTrayEndpointRef(o?.endRef)");

    expect(source).not.toContain("item.requiredStickCount =");
    expect(source).not.toContain("item.purchaseLengthM =");
    expect(source).not.toContain("item.offcutM =");
    expect(source).not.toContain("tray.requiredStickCount");
    expect(source).not.toContain("tray.purchaseLengthM");
    expect(source).not.toContain("tray.offcutM");
  });

  test("extends only the existing tray evaluation presentation and does not use assembly BOM", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain("const material = this._getCableTrayMaterialRequirement()");
    expect(source).toContain("Materialbedarf (Neu)");
    expect(source).toContain("Verschnitt");
    expect(source).not.toContain("buildBomFromAssemblyInstance(");
  });
});
