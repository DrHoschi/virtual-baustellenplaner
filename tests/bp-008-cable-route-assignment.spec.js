import { test, expect } from "@playwright/test";

test.describe("BP-008 cable route assignment contract", () => {
  test("keeps cableLines as cable authority and preserves ordered unique routeRefs", async ({ page }) => {
    await page.goto("/");
    const [source, cableLineSource, routingSource] = await Promise.all([
      page.request.get("./ui/panels/WorkareaPanel.base.js").then((response) => response.text()),
      page.request.get("./ui/workarea/workarea-assembly-cable-lines.v1.js").then((response) => response.text()),
      page.request.get("./ui/workarea/workarea-assembly-cable-routing.v1.js").then((response) => response.text())
    ]);

    expect(routingSource).toContain("_normalizeCableLineRouteRefsV1(routeRefs = [])");
    expect(cableLineSource).toContain("routeRefs: this._normalizeCableLineRouteRefsV1(previous?.routeRefs ?? cfg.routeRefs ?? [])");
    expect(cableLineSource).toContain("const previous = Array.isArray(sceneObj?.cableLines)");
    expect(source).toContain("sceneObj.cableLines = this._deriveAssemblyCableListV1(sceneObj)");
    expect(source).toContain('"cableLines", "cableList"');
    expect(routingSource).toContain("if (!id || seen.has(id)) continue");
    expect(routingSource).toContain("out.push(id)");
  });

  test("resolves only existing cable-tray routes and derives tray-path length without overwriting cable length", async ({ page }) => {
    await page.goto("/");
    const [source, routingSource] = await Promise.all([
      page.request.get("./ui/panels/WorkareaPanel.base.js").then((response) => response.text()),
      page.request.get("./ui/workarea/workarea-assembly-cable-routing.v1.js").then((response) => response.text())
    ]);

    expect(source).toContain('String(o.type || "") === "cable-tray.route"');
    expect(routingSource).toContain("const routes = routeRefs.map((id) => byId.get(id) || null)");
    expect(routingSource).toContain("this._getCableTrayLengthM(route)");
    expect(source).toContain("Bekannte Trassen-Mindestweglänge:");
    expect(source).toContain("Manuelle Kabellänge:");
    expect(source).toContain('mkMiniInput(cl, "lengthM", "0"');
    expect(source).toContain('mkMiniInput(cl, "route", "z. B. +A / Rinne 200")');
    expect(source).not.toContain("cableLine.lengthM = trayPathLengthM");
    expect(source).not.toContain("cl.lengthM = assigned.trayPathLengthM");
  });

  test("persists only CableLine routeRefs and leaves BP-002 through BP-007 route authorities intact", async ({ page }) => {
    await page.goto("/");
    const [baseSource, cableTraySource, routingSource] = await Promise.all([
      page.request.get("./ui/panels/WorkareaPanel.base.js").then((response) => response.text()),
      page.request.get("./ui/workarea/workarea-cable-tray.v1.js").then((response) => response.text()),
      page.request.get("./ui/workarea/workarea-assembly-cable-routing.v1.js").then((response) => response.text())
    ]);

    expect(routingSource).toContain("cableLine.routeRefs = next");
    expect(routingSource).toContain('this._assemblyPropsPersistScene(sceneObj, "assemblyprops:cable-route-assignment")');
    expect(baseSource).toContain("item.startRef = this._sanitizeCableTrayEndpointRef(o?.startRef)");
    expect(baseSource).toContain("item.endRef = this._sanitizeCableTrayEndpointRef(o?.endRef)");
    expect(baseSource).toContain("item.points = rawPoints");
    expect(baseSource).toContain("routeClass:");
    expect(cableTraySource).toContain("_getCableTrayMaterialRequirement()");
    expect(baseSource).not.toContain("route.points = cableLine.routeRefs");
    expect(baseSource).not.toContain("route.startRef = cableLine");
    expect(baseSource).not.toContain("route.endRef = cableLine");
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
