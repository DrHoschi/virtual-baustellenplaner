import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const baseSource = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");
const cableTraySource = fs.readFileSync(new URL("../ui/workarea/workarea-cable-tray.v1.js", import.meta.url), "utf8");

test("BP-006 persists optional endpoint refs through route sanitize and snapshot", () => {
  assert.match(baseSource, /item\.startRef = this\._sanitizeCableTrayEndpointRef\(o\?\.startRef\)/);
  assert.match(baseSource, /item\.endRef = this\._sanitizeCableTrayEndpointRef\(o\?\.endRef\)/);
  assert.match(cableTraySource, /const objectId = String\(ref\.objectId \|\| ""\)\.trim\(\)/);
  assert.match(cableTraySource, /return portId \? \{ objectId, portId \} : \{ objectId \}/);
});

test("BP-006 reuses scene object and optional existing port identities", () => {
  assert.match(cableTraySource, /this\._findSceneObjectById\(clean\.objectId\)/);
  assert.match(cableTraySource, /ports\.find\(\(p\) => String\(p\?\.id \|\| ""\) === clean\.portId\)/);
  assert.match(cableTraySource, /String\(object\.name \|\| object\.autoName \|\| object\.id\)/);
  assert.doesNotMatch(cableTraySource, /startRef:\s*\{[^}]*name:/s);
  assert.doesNotMatch(cableTraySource, /endRef:\s*\{[^}]*name:/s);
});

test("BP-006 assignment and clear persist only actual changes", () => {
  assert.match(cableTraySource, /if \(JSON\.stringify\(prev\) === JSON\.stringify\(next\)\) return false/);
  assert.match(cableTraySource, /route\[key\] = next/);
  assert.match(cableTraySource, /this\._persistSceneToStore\(\x60cable-tray-\$\{side\}-binding\x60\)/);
  assert.match(baseSource, /select\.value \? JSON\.parse\(select\.value\) : null/);
});

test("BP-006 binding stays semantic and preserves BP-002 through BP-005 authorities", () => {
  assert.match(baseSource, /item\.points = rawPoints/);
  assert.match(baseSource, /routeClass: String\(o\?\.tray\?\.routeClass/);
  assert.match(cableTraySource, /_getCableTrayLengthWorld\(route\)/);
  assert.match(cableTraySource, /_getCableTrayGroupedTotals\(\)/);
  assert.match(cableTraySource, /_hitTestCableTrayPoint\(wx, wy\)/);
  const setter = cableTraySource.slice(
    cableTraySource.indexOf("_setCableTrayEndpointRef(route"),
    cableTraySource.indexOf("_getCableTrayLengthWorld(route)")
  );
  assert.doesNotMatch(setter, /\.points\s*=|points\.push|points\.splice|\.x\s*=|\.y\s*=/);
});

test("BP-006 endpoint UI is confined to Measure tray context and derives available targets", () => {
  assert.match(baseSource, /if \(String\(this\.state\?\.modeId \|\| ""\) === "measure"\)/);
  assert.match(cableTraySource, /_getCableTrayBindingObjects\(\)/);
  assert.match(cableTraySource, /String\(o\.type \|\| ""\) !== "cable-tray\.route"/);
  assert.match(baseSource, /makeBindingSelect\("start"\)/);
  assert.match(baseSource, /makeBindingSelect\("end"\)/);
  assert.match(baseSource, /selectedRouteId = trayPointHit\.route\.id/);
});
