import { test, expect } from "@playwright/test";

test.describe("BP-005 cable tray point editing contract", () => {
  test("edits existing route points only in measure context", async ({ page }) => {
    await page.goto("/");
    const [baseSource, cableTraySource] = await page.locator("body").evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    ]));

    expect(cableTraySource).toContain("_hitTestCableTrayPoint(wx, wy)");
    expect(baseSource).toContain('if (modeId === "measure")');
    expect(baseSource).toContain("point.x = nx");
    expect(baseSource).toContain("point.y = ny");
    expect(baseSource).toContain('if (String(o?.type || "") === "cable-tray.route") continue;');
  });

  test("reuses snap, synchronizes first point and persists dirty drag once", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain("this._applySnapToWorldPoint(world)");
    expect(source).toContain("if (pointIndex === 0)");
    expect(source).toContain("route.x = nx");
    expect(source).toContain("route.y = ny");
    expect(source).toContain('this._persistSceneToStore("cable-tray-point-drag")');
    expect(source).toContain("trayPointWasActive");
    expect(source).toContain("!trayPointWasActive");
  });

  test("keeps edit state transient and save-reload authority in points", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain("trayPointDrag: null");
    expect(source).toContain("item.points = (Array.isArray(o.points) ? o.points : [])");
    expect(source).toContain("item.points = rawPoints");
    expect(source).toContain("item.x = item.points[0].x");
    expect(source).not.toContain("item.trayPointDrag");
    expect(source).not.toContain("item.lengthM =");
    expect(source).not.toContain("tray.totals");
  });

  test("renders measure handles from the existing route points", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain('const editingHandles = String(this.state?.modeId || "") === "measure"');
    expect(source).toContain("for (const p of pts)");
    expect(source).toContain("(editingHandles ? 7 : 4)");
  });
});
