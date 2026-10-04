import fs from "node:fs";
import assert from "node:assert/strict";

const baseSource = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");
const routingSource = fs.readFileSync(new URL("../ui/workarea/workarea-assembly-cable-routing.v1.js", import.meta.url), "utf8");
const cableTraySource = fs.readFileSync(new URL("../ui/workarea/workarea-cable-tray.v1.js", import.meta.url), "utf8");
const cableLineSource = fs.readFileSync(new URL("../ui/workarea/workarea-assembly-cable-lines.v1.js", import.meta.url), "utf8");

assert.match(routingSource, /_normalizeCableLineRouteDirectionsV1\(routeDirections = \{\}, routeRefs = \[\]\)/,
  "BP-010 must normalize cable-owned route traversal directions");
assert.match(routingSource, /direction === "forward" \|\| direction === "reverse"/,
  "only explicit forward/reverse directions are authoritative");
assert.match(cableLineSource, /routeDirections: this\._normalizeCableLineRouteDirectionsV1\(/,
  "route directions must survive CableLine regeneration");
assert.match(routingSource, /cableLine\.routeDirections = this\._normalizeCableLineRouteDirectionsV1\(cableLine\.routeDirections, next\)/,
  "route assignment changes must prune directions to assigned route IDs");
assert.match(routingSource, /_setCableLineRouteDirectionV1\([\s\S]*?assemblyprops:cable-route-direction/,
  "direction changes must use the existing Assembly CableLine persistence path");

assert.match(cableTraySource, /_getCableTrayTraversalEndpointsV1\(route, direction\)/,
  "BP-010 must derive traversal endpoints from existing route geometry");
assert.match(cableTraySource, /direction === "reverse"[\s\S]*?\{ entry: end, exit: start \}[\s\S]*?\{ entry: start, exit: end \}/,
  "entry/exit must follow the explicit cable-owned traversal direction");
assert.match(routingSource, /fromEndpoints\.exit\.x === toEndpoints\.entry\.x[\s\S]*?fromEndpoints\.exit\.y === toEndpoints\.entry\.y/,
  "only geometrically identical adjacent endpoints are automatically continuous");
assert.match(routingSource, /status: closed \? "continuous" : "undetermined"/,
  "open or unresolved transitions must remain undetermined");
assert.match(routingSource, /lengthM: closed \? 0 : null/,
  "only a closed transition may contribute an authoritative zero transition length");

assert.match(baseSource, /Richtung wählen/);
assert.match(baseSource, /→ vorwärts/);
assert.match(baseSource, /← rückwärts/);
assert.match(baseSource, /Quelle → Trasse: unbestimmt[\s\S]*?Trasse → Ziel: unbestimmt/,
  "source/target connection portions must remain outside BP-010 geometry authority");

assert.match(routingSource, /const knownMinimumTrayPathM = routes\.reduce\([\s\S]*?_getCableTrayLengthM\(route\)/,
  "BP-009 known minimum tray path derivation must remain intact");
assert.match(cableLineSource, /lengthM: previous\?\.lengthM \?\? cfg\.lengthM \?\? ""/,
  "manual cable length authority must remain unchanged");
for (const source of [baseSource, routingSource, cableTraySource, cableLineSource]) {
  assert.doesNotMatch(source, /transitionDistance|predictedCableLength|automaticCableLength/,
    "BP-010 must not invent transition or automatic cable lengths");
}

console.log("BP-010 cable route continuity acceptance: PASS");
