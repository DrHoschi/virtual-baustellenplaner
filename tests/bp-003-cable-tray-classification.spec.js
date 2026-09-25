import { test, expect } from "@playwright/test";

test.describe("BP-003 cable tray classification contract", () => {
  test("keeps route class inside the existing cable-tray.route authority", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain('routeClass: "new"');
    expect(source).toContain('routeClass: String(o?.tray?.routeClass || "") === "existing" ? "existing" : "new"');
    expect(source).toContain('routeClass: String(this._cableTrayDraft?.routeClass || "") === "existing" ? "existing" : "new"');
    expect(source).toContain("next.project.workspace.scene.objects = snapshot");
  });

  test("offers new and existing classification without changing the measure authority", async ({ page }) => {
    await page.goto("/");
    const [source, registry] = await page.locator("body").evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/data/tools.registry.json")).text()
    ]));

    expect(registry).toContain('"id": "measure"');
    expect(source).toContain('classSelect.setAttribute("aria-label", "Trassenklasse")');
    expect(source).toContain('opt.textContent = routeClass === "existing" ? "Bestand/Brücke" : "Neu"');
    expect(source).toContain('this._finishCableTrayRoute("class-change")');
  });

  test("derives four class-width totals and does not persist a totals authority", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain("new: { 100: 0, 200: 0 }");
    expect(source).toContain("existing: { 100: 0, 200: 0 }");
    expect(source).toContain("totals[routeClass][widthMm] += lengthM");
    expect(source).not.toContain("item.totals =");
    expect(source).not.toContain("tray.totals");
  });

  test("derives red-new and green-existing presentation from routeClass", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain('ctx.strokeStyle = routeClass === "existing" ? "rgba(35,145,70,0.9)" : "rgba(190,35,35,0.9)"');
    expect(source).toContain('routeClass === "existing" ? "Bestand" : "Neu"');
  });

  test("keeps BP-003 separate from cableLines and later cable planning", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    const start = source.indexOf("_getCableTrayLengthWorld(route)");
    const end = source.indexOf('_makeId(prefix = "obj")', start);
    const implementation = source.slice(start, end);

    expect(implementation).not.toContain("cableLines");
    expect(implementation).not.toContain("fillPercent");
    expect(implementation).not.toContain("bendRadius");
  });
});
