import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");

assert.match(src, /_getAssemblyCablePointWorldPositionV1\(sceneObj = \{\}, cablePoint = null\)/,
  "BP-011 must derive CablePoint world position at runtime");
assert.match(src, /String\(sceneObj\?\.type \|\| ""\) !== "assembly\.instance"/,
  "world-space derivation must require an assembly.instance authority");
assert.match(src, /find\(\(item\) => item && String\(item\.id \|\| ""\) === componentId\)/,
  "CablePoint componentId must resolve to an existing assembly component");
assert.match(src, /assemblyX \+ localX \* cos - localY \* sin/,
  "world X must use the existing assembly translate/rotate semantics");
assert.match(src, /assemblyY \+ localX \* sin \+ localY \* cos/,
  "world Y must use the existing assembly translate/rotate semantics");
assert.match(src, /authority: "component-origin"/,
  "derived endpoint authority must explicitly remain component-origin");

assert.match(src, /_resolveCableLineEndpointWorldPositionV1\(sceneObj = \{\}, cablePointId = ""\)/,
  "CableLine endpoints must resolve through CablePoint IDs");
assert.match(src, /String\(item\.id \|\| ""\) === id/,
  "source/target resolution must match the explicit CablePoint ID");
assert.match(src, /return cablePoint \? this\._getAssemblyCablePointWorldPositionV1\(sceneObj, cablePoint\) : null/,
  "missing CablePoint authority must remain unresolved");

assert.match(src, /_getDirectDistanceM2dV1\(fromPoint, toPoint\)/,
  "BP-011 must keep direct 2D distance as runtime-derived state");
assert.match(src, /Math\.hypot\([\s\S]*?\) \/ 1000/,
  "direct Workarea distance must convert millimetres to metres");
assert.match(src, /sourceDirectDistanceM = sourceWorld && firstEndpoints[\s\S]*?firstEndpoints\.entry/,
  "source distance must terminate at the BP-010 first-route entry");
assert.match(src, /targetDirectDistanceM = targetWorld && lastEndpoints[\s\S]*?lastEndpoints\.exit/,
  "target distance must originate at the BP-010 last-route exit");
assert.match(src, /sourceDirectDistanceM,[\s\S]*?targetDirectDistanceM,[\s\S]*?sourceTargetAuthority/,
  "BP-011 derived values must stay in the runtime assignment summary");

assert.match(src, /Quelle → Trasse:[\s\S]*?direkt \(Component-Origin\)/,
  "UI must identify source distance as direct Component-Origin geometry");
assert.match(src, /Trasse → Ziel:[\s\S]*?direkt \(Component-Origin\)/,
  "UI must identify target distance as direct Component-Origin geometry");
assert.match(src, /Quelle → Trasse: unbestimmt/,
  "UI must preserve unresolved source geometry");
assert.match(src, /Trasse → Ziel: unbestimmt/,
  "UI must preserve unresolved target geometry");

const candidateStart = src.indexOf("_makeAssemblyCableLineCandidateV1(");
const candidateEnd = src.indexOf("_deriveAssemblyCableListV1(", candidateStart);
const candidate = src.slice(candidateStart, candidateEnd);
assert.match(candidate, /lengthM: previous\?\.lengthM \?\? cfg\.lengthM \?\? ""/,
  "manual CableLine length authority must remain unchanged");
assert.doesNotMatch(candidate, /sourceWorld|targetWorld|sourceDirectDistanceM|targetDirectDistanceM|sourceTargetAuthority/,
  "BP-011 derived world-space data must not be persisted on CableLine");

assert.match(src, /item\.points = rawPoints/,
  "cable-tray route point authority must remain unchanged");
assert.match(src, /item\.startRef = this\._sanitizeCableTrayEndpointRef/,
  "BP-006 startRef authority must remain unchanged");
assert.match(src, /routeRefs: this\._normalizeCableLineRouteRefsV1/,
  "BP-008 routeRefs authority must remain unchanged");
assert.match(src, /routeDirections: this\._normalizeCableLineRouteDirectionsV1/,
  "BP-010 routeDirections authority must remain unchanged");

console.log("BP-011 source target world-space acceptance: PASS");
