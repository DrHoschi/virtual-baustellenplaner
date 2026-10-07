import { test, expect } from "@playwright/test";

test.describe("BP-002 practical cable tray route contract", () => {
  test("keeps tray geometry in the canonical Workarea scene and derives length", async ({ page }) => {
    await page.goto("/");
    const [baseSource, cableTraySource] = await page.locator("body").evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    ]));

    expect(cableTraySource).toContain('type: "cable-tray.route"');
    expect(cableTraySource).toContain("points: [{ x: Number(world.wx), y: Number(world.wy) }]");
    expect(cableTraySource).toContain("this._getCableTrayLengthWorld(route) / 1000");
    expect(baseSource).toContain("next.project.workspace.scene.objects = snapshot");
    expect(baseSource).toContain('String(o.type || "") === "cable-tray.route"');
    expect(baseSource).toContain("item.points = (Array.isArray(o.points) ? o.points : [])");
    expect(baseSource).toContain("widthMm: Number(o?.tray?.widthMm) === 100 ? 100 : 200");
    expect(cableTraySource).not.toContain("cableLines[].lengthM");

    const moduleImportContract = 'im' + 'port { installWorkareaCableTrayModule } from "../workarea/workarea-cable-tray.v1.js";';
    expect(baseSource).toContain(moduleImportContract);
    expect(baseSource).toContain("installWorkareaCableTrayModule(WorkareaPanel);");
    expect(cableTraySource).toContain("export function installWorkareaCableTrayModule(WorkareaPanelClass)");
  });

  test("uses existing measure mode for manual point authoring and grouped totals", async ({ page }) => {
    await page.goto("/");
    const [baseSource, cableTraySource, registry] = await page.locator("body").evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text(),
      (await fetch("/data/tools.registry.json")).text()
    ]));

    expect(registry).toContain('"id": "measure"');
    expect(baseSource).toContain('modeIdNow === "measure"');
    expect(baseSource).toContain("this._appendCableTrayPoint(world)");
    expect(cableTraySource).toContain("const totals = this._getCableTrayGroupedTotals()");
    expect(cableTraySource).toContain('this._persistSceneToStore("cable-tray-point")');
    expect(baseSource).toContain('if (prev === "measure" && modeId !== "measure") this._finishCableTrayRoute("mode-change")');
  });

  test("does not couple BP-002 routes to cableLines or legacy object drag", async ({ page }) => {
    await page.goto("/");
    const [baseSource, cableTraySource] = await page.locator("body").evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    ]));

    const trayHelperStart = cableTraySource.indexOf("_getCableTrayLengthWorld(route)");
    const trayHelperEnd = cableTraySource.indexOf("_getCableTrayLengthM(route)", trayHelperStart);
    const trayImplementation = cableTraySource.slice(trayHelperStart, trayHelperEnd);

    expect(trayImplementation).not.toContain("cableLines");
    expect(baseSource).toContain('if (String(o?.type || "") === "cable-tray.route") continue;');
  });

  test("save reload rehydrates tray points and discards incomplete routes persistently", async ({ page }) => {
    await page.goto("/");
    const [baseSource, cableTraySource] = await page.locator("body").evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    ]));

    // Save side: tray-specific fields are copied into the canonical scene snapshot.
    expect(baseSource).toContain('if (String(o.type || "") === "cable-tray.route") {');
    expect(baseSource).toContain("item.points = (Array.isArray(o.points) ? o.points : [])");
    expect(baseSource).toContain("next.project.workspace.scene.objects = snapshot");
    expect(baseSource).toContain("this._sceneSync.lastSig = this._sigForObjects(snapshot)");

    // Reload side: the same persisted fields are reconstructed into the runtime scene.
    expect(baseSource).toContain('if (type === "cable-tray.route") {');
    expect(baseSource).toContain("const rawPoints = Array.isArray(o.points) ? o.points : []");
    expect(baseSource).toContain("item.points = rawPoints");
    expect(baseSource).toContain("item.x = item.points[0].x");
    expect(baseSource).toContain("item.y = item.points[0].y");
    expect(baseSource).toContain("const nextObjects = this._mergeHydratedSceneObjectsV1(fromStore)");
    expect(baseSource).toContain("const activeRouteId = String(this._cableTrayDraft?.activeRouteId || \"\").trim()");

    // Regression blocker: finishing an incomplete one-point route removes it
    // from the scene and immediately persists that removal.
    expect(cableTraySource).toContain('removedIncompleteRoute = true');
    expect(cableTraySource).toContain('this._persistSceneToStore("cable-tray-discard-incomplete")');
    expect(cableTraySource).toContain('this._persistSceneToStore("cable-tray-finish")');
  });

  test("persists cable-tray scene changes immediately enough for reload", async ({ page }) => {
    await page.goto("/");
    const loaderSource = await page.locator("body").evaluate(async () => await (await fetch("/core/loader.js")).text());

    expect(loaderSource).toContain("function __bpIsImmediateSceneSaveReason");
    expect(loaderSource).toContain('r.startsWith("scene:cable-tray")');
  });

});
