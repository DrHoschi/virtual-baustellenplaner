import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");

test("BP-006 persists optional endpoint refs through route sanitize and snapshot", () => {
  assert.match(src, /item\.startRef = this\._sanitizeCableTrayEndpointRef\(o\?\.startRef\)/);
  assert.match(src, /item\.endRef = this\._sanitizeCableTrayEndpointRef\(o\?\.endRef\)/);
  assert.match(src, /const objectId = String\(ref\.objectId \|\| ""\)\.trim\(\)/);
  assert.match(src, /return portId \? \{ objectId, portId \} : \{ objectId \}/);
});

test("BP-006 reuses scene object and optional existing port identities", () => {
  assert.match(src, /this\._findSceneObjectById\(clean\.objectId\)/);
  assert.match(src, /ports\.find\(\(p\) => String\(p\?\.id \|\| ""\) === clean\.portId\)/);
  assert.match(src, /String\(object\.name \|\| object\.autoName \|\| object\.id\)/);
  assert.doesNotMatch(src, /startRef:\s*\{[^}]*name:/s);
  assert.doesNotMatch(src, /endRef:\s*\{[^}]*name:/s);
});

test("BP-006 assignment and clear persist only actual changes", () => {
  assert.match(src, /if \(JSON\.stringify\(prev\) === JSON\.stringify\(next\)\) return false/);
  assert.match(src, /route\[key\] = next/);
  assert.match(src, /this\._persistSceneToStore\(\x60cable-tray-\$\{side\}-binding\x60\)/);
  assert.match(src, /select\.value \? JSON\.parse\(select\.value\) : null/);
});

test("BP-006 binding stays semantic and preserves BP-002 through BP-005 authorities", () => {
  assert.match(src, /item\.points = rawPoints/);
  assert.match(src, /routeClass: String\(o\?\.tray\?\.routeClass/);
  assert.match(src, /_getCableTrayLengthWorld\(route\)/);
  assert.match(src, /_getCableTrayGroupedTotals\(\)/);
  assert.match(src, /_hitTestCableTrayPoint\(wx, wy\)/);
  const setter = src.slice(src.indexOf("_setCableTrayEndpointRef(route"), src.indexOf("_getCableTrayLengthWorld(route)"));
  assert.doesNotMatch(setter, /\.points\s*=|points\.push|points\.splice|\.x\s*=|\.y\s*=/);
});

test("BP-006 endpoint UI is confined to Measure tray context and derives available targets", () => {
  assert.match(src, /if \(String\(this\.state\?\.modeId \|\| ""\) === "measure"\)/);
  assert.match(src, /_getCableTrayBindingObjects\(\)/);
  assert.match(src, /String\(o\.type \|\| ""\) !== "cable-tray\.route"/);
  assert.match(src, /makeBindingSelect\("start"\)/);
  assert.match(src, /makeBindingSelect\("end"\)/);
  assert.match(src, /selectedRouteId = trayPointHit\.route\.id/);
});
