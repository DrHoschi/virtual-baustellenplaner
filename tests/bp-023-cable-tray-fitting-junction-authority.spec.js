import { test, expect } from "@playwright/test";

test.describe("BP-023 fitting junction authority contract", () => {
  test("keeps fittings manual, reference-only, persistent and isolated from route geometry", async ({ page }) => {
    await page.goto("/");
    const [baseSource, cableTraySource] = await page.evaluate(async () => Promise.all([
      (await fetch("/ui/panels/WorkareaPanel.base.js")).text(),
      (await fetch("/ui/workarea/workarea-cable-tray.v1.js")).text()
    ]));

    const addStart = cableTraySource.indexOf("  _addCableTrayFittingDraftConnectionV1(");
    const addEnd = cableTraySource.indexOf("\n  _saveCableTrayFittingDraftV1(", addStart);
    const addBlock = cableTraySource.slice(addStart, addEnd);
    expect(addBlock).toContain('String(route.type || "") !== "cable-tray.route"');
    expect(addBlock).toContain('String(route.id || "") === String(this._cableTrayDraft?.activeRouteId || "")');
    expect(addBlock).toContain("!Array.isArray(route.points) || route.points.length < 2");
    expect(addBlock).toContain("{ routeId: String(route.id), pointIndex: index }");
    expect(addBlock).not.toContain("Math.atan");
    expect(addBlock).not.toContain("Math.hypot");
    expect(addBlock).not.toContain("widthMm");

    const persistStart = baseSource.indexOf("  _persistSceneToStore(");
    const persistEnd = baseSource.indexOf("\n  _", persistStart + 3);
    const persistBlock = baseSource.slice(persistStart, persistEnd);
    expect(persistBlock).toContain("const fittingSnapshot");
    expect(persistBlock).toContain("next.project.workspace.scene.cableTrayFittings = fittingSnapshot");
    expect(persistBlock).toContain('this._requestProjectSaveDebounced(\`scene:\${reason}\`)');

    const loadStart = cableTraySource.indexOf("  _getCableTrayFittingsFromStore(");
    const loadEnd = cableTraySource.indexOf("\n  _", loadStart + 3);
    const loadBlock = cableTraySource.slice(loadStart, loadEnd);
    expect(loadBlock).toContain("app?.project?.workspace?.scene?.cableTrayFittings");
    expect(loadBlock).toContain("this._sanitizeCableTrayFittingV1(fitting)");

    const validateStart = cableTraySource.indexOf("  _validateCableTrayFittingV1(");
    const validateEnd = cableTraySource.indexOf("\n  _", validateStart + 3);
    const validateBlock = cableTraySource.slice(validateStart, validateEnd);
    expect(validateBlock).toContain("this._resolveCableTrayFittingConnectionV1(c)");
    expect(validateBlock).toContain('reason: "Mindestens eine Referenz ist nicht auflösbar"');

    const sanitizeStart = cableTraySource.indexOf("  _sanitizeCableTrayFittingV1(");
    const sanitizeEnd = cableTraySource.indexOf("\n  _", sanitizeStart + 3);
    const sanitizeBlock = cableTraySource.slice(sanitizeStart, sanitizeEnd);
    expect(sanitizeBlock).toContain("this._sanitizeCableTrayFittingConnectionV1(connection)");
    expect(sanitizeBlock).not.toContain("_resolveCableTrayFittingConnectionV1");

    const removeStart = cableTraySource.indexOf("  _removeSelectedCableTrayFittingV1(");
    const removeEnd = cableTraySource.indexOf("\n  _", removeStart + 3);
    const removeBlock = cableTraySource.slice(removeStart, removeEnd);
    expect(removeBlock).toContain("this._scene.cableTrayFittings = next");
    expect(removeBlock).toContain("Trassengeometrie unverändert");
    expect(removeBlock).not.toContain(".points =");
  });

  test("preserves the BP-005 point-drag boundary while fitting selection is active", async ({ page }) => {
    await page.goto("/");
    const source = await page.evaluate(async () => await (await fetch("/ui/panels/WorkareaPanel.base.js")).text());
    expect(source).toContain("this._cableTrayFittingDraft?.active");
    expect(source).toContain("_addCableTrayFittingDraftConnectionV1");
    expect(source).toContain("P.trayPointDrag");
  });
});
