import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");

assert.match(src, /_normalizeCableLineRouteDirectionsV1\(routeDirections = \{\}, routeRefs = \[\]\)/,
  "BP-010 must normalize cable-owned route traversal directions");
assert.match(src, /direction === "forward" \|\| direction === "reverse"/,
  "only explicit forward/reverse directions are authoritative");
assert.match(src, /routeDirections: this\._normalizeCableLineRouteDirectionsV1\(/,
  "route directions must survive CableLine regeneration");
assert.match(src, /cableLine\.routeDirections = this\._normalizeCableLineRouteDirectionsV1\(cableLine\.routeDirections, next\)/,
  "route assignment changes must prune directions to assigned route IDs");
assert.match(src, /_setCableLineRouteDirectionV1\([\s\S]*?assemblyprops:cable-route-direction/,
  "direction changes must use the existing Assembly CableLine persistence path");

assert.match(src, /_getCableTrayTraversalEndpointsV1\(route, direction\)/,
  "BP-010 must derive traversal endpoints from existing route geometry");
assert.match(src, /direction === "reverse"[\s\S]*?\{ entry: end, exit: start \}[\s\S]*?\{ entry: start, exit: end \}/,
  "entry/exit must follow the explicit cable-owned traversal direction");
assert.match(src, /fromEndpoints\.exit\.x === toEndpoints\.entry\.x[\s\S]*?fromEndpoints\.exit\.y === toEndpoints\.entry\.y/,
  "only geometrically identical adjacent endpoints are automatically continuous");
assert.match(src, /status: closed \? "continuous" : "undetermined"/,
  "open or unresolved transitions must remain undetermined");
assert.match(src, /lengthM: closed \? 0 : null/,
  "only a closed transition may contribute an authoritative zero transition length");

assert.match(src, /Richtung wählen/);
assert.match(src, /→ vorwärts/);
assert.match(src, /← rückwärts/);
assert.match(src, /Quelle\/Ziel-Anschluss: unbestimmt/,
  "source/target connection portions must remain outside BP-010 geometry authority");

assert.match(src, /const knownMinimumTrayPathM = routes\.reduce\([\s\S]*?_getCableTrayLengthM\(route\)/,
  "BP-009 known minimum tray path derivation must remain intact");
assert.match(src, /lengthM: previous\?\.lengthM \?\? cfg\.lengthM \?\? ""/,
  "manual cable length authority must remain unchanged");
assert.doesNotMatch(src, /transitionDistance|predictedCableLength|automaticCableLength|reserveM/,
  "BP-010 must not persist invented transition, prediction or reserve lengths");

console.log("BP-010 cable route continuity acceptance: PASS");
