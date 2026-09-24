import { test, expect } from "@playwright/test";

test.describe("BP-002 practical cable tray route contract", () => {
  test("keeps tray geometry in the canonical Workarea scene and derives length", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    expect(source).toContain('type: "cable-tray.route"');
    expect(source).toContain("points: [{ x: Number(world.wx), y: Number(world.wy) }]");
    expect(source).toContain("this._getCableTrayLengthWorld(route) / 1000");
    expect(source).toContain("next.project.workspace.scene.objects = snapshot");
    expect(source).toContain('String(o.type || "") === "cable-tray.route"');
    expect(source).toContain("item.points = (Array.isArray(o.points) ? o.points : [])");
    expect(source).toContain("widthMm: Number(o?.tray?.widthMm) === 100 ? 100 : 200");
    expect(source).not.toContain("cableLines[].lengthM");
  });

  test("uses existing measure mode for manual point authoring and grouped totals", async ({ page }) => {
    await page.goto("/");
    const [source, registry] = await page.locator("body").evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/data/tools.registry.json")).text()
    ]));

    expect(registry).toContain('"id": "measure"');
    expect(source).toContain('modeIdNow === "measure"');
    expect(source).toContain("this._appendCableTrayPoint(world)");
    expect(source).toContain("const totals = { 100: 0, 200: 0 }");
    expect(source).toContain('this._persistSceneToStore("cable-tray-point")');
    expect(source).toContain('if (prev === "measure" && modeId !== "measure") this._finishCableTrayRoute("mode-change")');
  });

  test("does not couple BP-002 routes to cableLines or legacy object drag", async ({ page }) => {
    await page.goto("/");
    const source = await page.locator("body").evaluate(async () =>
      await (await fetch("/ui/panels/WorkareaPanel.base.js")).text()
    );

    const trayHelperStart = source.indexOf("_getCableTrayLengthWorld(route)");
    const trayHelperEnd = source.indexOf('_makeId(prefix = "obj")', trayHelperStart);
    const trayImplementation = source.slice(trayHelperStart, trayHelperEnd);

    expect(trayImplementation).not.toContain("cableLines");
    expect(source).toContain('if (String(o?.type || "") === "cable-tray.route") continue;');
  });
});
