import { test, expect } from "@playwright/test";

test.describe("BP-004 practical cable tray evaluation contract", () => {
  test("derives route rows and grouped totals from the existing cable-tray route authority", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain("_getCableTrayEvaluation()");
    expect(source).toContain('String(o?.type || "") !== "cable-tray.route"');
    expect(source).toContain("const lengthM = this._getCableTrayLengthM(o)");
    expect(source).toContain("totals[routeClass][widthMm] += lengthM");
    expect(source).toContain("routes.push({");
    expect(source).toContain("return { routes, totals }");
  });

  test("keeps BP-002 and BP-003 fields authoritative and evaluation derived only", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain("return this._getCableTrayEvaluation().totals");
    expect(source).not.toContain("item.lengthM =");
    expect(source).not.toContain("item.totals =");
    expect(source).not.toContain("tray.totals");
    expect(source).not.toContain("tray.evaluation");
  });

  test("exposes the detail evaluation only inside the existing measure tray controls", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain('if (String(this.state?.modeId || "") === "measure")');
    expect(source).toContain('this._btn("Auswertung", () => this._showCableTrayEvaluation())');
    expect(source).toContain('evaluationBtn.setAttribute("aria-label", "Trassenauswertung anzeigen")');
    expect(source).toContain('"Bestand/Brücke" : "Neu"');
  });

  test("does not add cable planning, EPLAN or 3D authority", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    const start = source.indexOf("_getCableTrayEvaluation()");
    const end = source.indexOf("_startCableTrayRoute(world)", start);
    const implementation = source.slice(start, end);

    expect(implementation).not.toContain("cableLines");
    expect(implementation).not.toContain("fillPercent");
    expect(implementation).not.toContain("bendRadius");
    expect(implementation).not.toContain("eplan");
  });
});
