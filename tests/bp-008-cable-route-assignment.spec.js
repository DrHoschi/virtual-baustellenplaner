import { test, expect } from "@playwright/test";

test.describe("BP-008 cable route assignment contract", () => {
  test("keeps cableLines as cable authority and preserves ordered unique routeRefs", async ({ page }) => {
    await page.goto("/");
    const source = await (await page.request.get("./ui/panels/WorkareaPanel.base.js")).text();

    expect(source).toContain("_normalizeCableLineRouteRefsV1(routeRefs = [])");
    expect(source).toContain("routeRefs: this._normalizeCableLineRouteRefsV1(previous?.routeRefs ?? cfg.routeRefs ?? [])");
    expect(source).toContain("const previous = Array.isArray(sceneObj?.cableLines)");
    expect(source).toContain("sceneObj.cableLines = this._deriveAssemblyCableListV1(sceneObj)");
    expect(source).toContain('"cableLines", "cableList"');
    expect(source).toContain("if (!id || seen.has(id)) continue");
    expect(source).toContain("out.push(id)");
  });

  test("resolves only existing cable-tray routes and derives tray-path length without overwriting cable length", async ({ page }) => {
    await page.goto("/");
    const source = await (await page.request.get("./ui/panels/WorkareaPanel.base.js")).text();

    expect(source).toContain('String(o.type || "") === "cable-tray.route"');
    expect(source).toContain("const routes = routeRefs.map((id) => byId.get(id) || null)");
    expect(source).toContain("this._getCableTrayLengthM(route)");
    expect(source).toContain("Trassenweg (abgeleitet)");
    expect(source).toContain("Kabellänge bleibt manuell");
    expect(source).toContain('mkMiniInput(cl, "lengthM", "0"');
    expect(source).toContain('mkMiniInput(cl, "route", "z. B. +A / Rinne 200")');
    expect(source).not.toContain("cableLine.lengthM = trayPathLengthM");
    expect(source).not.toContain("cl.lengthM = assigned.trayPathLengthM");
  });

  test("persists only CableLine routeRefs and leaves BP-002 through BP-007 route authorities intact", async ({ page }) => {
    await page.goto("/");
    const source = await (await page.request.get("./ui/panels/WorkareaPanel.base.js")).text();

    expect(source).toContain("cableLine.routeRefs = next");
    expect(source).toContain('this._assemblyPropsPersistScene(sceneObj, "assemblyprops:cable-route-assignment")');
    expect(source).toContain("item.startRef = this._sanitizeCableTrayEndpointRef(o?.startRef)");
    expect(source).toContain("item.endRef = this._sanitizeCableTrayEndpointRef(o?.endRef)");
    expect(source).toContain("item.points = rawPoints");
    expect(source).toContain("routeClass:");
    expect(source).toContain("_getCableTrayMaterialRequirement()");
    expect(source).not.toContain("route.points = cableLine.routeRefs");
    expect(source).not.toContain("route.startRef = cableLine");
    expect(source).not.toContain("route.endRef = cableLine");
  });

  test("supports shared route use and reports missing references without inventing replacement route data", async ({ page }) => {
    await page.goto("/");
    const source = await (await page.request.get("./ui/panels/WorkareaPanel.base.js")).text();

    expect(source).toContain("check.checked = assigned.routeRefs.includes(routeId)");
    expect(source).toContain("const next = check.checked");
    expect(source).toContain("? [...current, routeId]");
    expect(source).toContain("Fehlende Trassenreferenz:");
    expect(source).not.toContain("new CableLine");
    expect(source).not.toContain("globalCable");
  });
});
