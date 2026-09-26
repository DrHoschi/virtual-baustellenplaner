import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const file = path.resolve("ui/panels/WorkareaPanel.base.js");
const src = fs.readFileSync(file, "utf8");

assert.match(src, /sourceReserveM: previous\?\.sourceReserveM \?\? cfg\.sourceReserveM \?\? ""/,
  "source reserve must persist as explicit CableLine user authority");
assert.match(src, /targetReserveM: previous\?\.targetReserveM \?\? cfg\.targetReserveM \?\? ""/,
  "target reserve must persist as explicit CableLine user authority");
assert.match(src, /key === "sourceReserveM" \|\| key === "targetReserveM"/,
  "reserve fields must use the existing CableLine persistence seam");
assert.match(src, /parsed !== null && Number\.isFinite\(parsed\) && parsed >= 0 \? parsed : ""/,
  "reserve input must distinguish valid non-negative values from unset or invalid input");

const assignmentStart = src.indexOf("_getCableLineRouteAssignmentV1(cableLine = {}, sceneObj = null)");
const assignmentEnd = src.indexOf("\n  _makeAssemblyCableLineIdV1", assignmentStart);
const assignment = src.slice(assignmentStart, assignmentEnd > assignmentStart ? assignmentEnd : assignmentStart + 12000);
assert.match(assignment, /const sourceReserveM = parseReserveM\(cableLine\?\.sourceReserveM\)/);
assert.match(assignment, /const targetReserveM = parseReserveM\(cableLine\?\.targetReserveM\)/);
assert.match(assignment, /const hasMissingRoutes = routes\.some\(\(route\) => !route\)/);
assert.match(assignment, /const hasUndeterminedDirections = routeRefs\.some/);
assert.match(assignment, /!hasUndeterminedTransitions[\s\S]*?sourceReserveM !== null[\s\S]*?targetReserveM !== null/);
assert.match(assignment, /knownMinimumTrayPathM \+ sourceReserveM \+ targetReserveM/,
  "planned required length must be tray path plus explicit source and target planning shares");
assert.doesNotMatch(assignment, /plannedRequiredLengthM[\s\S]{0,300}(sourceDirectDistanceM|targetDirectDistanceM)/,
  "BP-011 Component-Origin diagnostics must not be added to planned required length");

assert.match(src, /Geplante benötigte Länge: unbestimmt/);
assert.match(src, /Geplante benötigte Länge: \$\{assigned\.plannedRequiredLengthM\.toFixed\(2\)\} m/);
assert.match(src, /Quelle geplant m/);
assert.match(src, /Ziel geplant m/);

const candidateStart = src.indexOf("_makeAssemblyCableLineCandidateV1");
const candidateEnd = src.indexOf("\n  _deriveAssemblyCableListV1", candidateStart);
const candidate = src.slice(candidateStart, candidateEnd > candidateStart ? candidateEnd : candidateStart + 9000);
assert.doesNotMatch(candidate, /plannedRequiredLengthM|knownMinimumTrayPathM|sourceDirectDistanceM|targetDirectDistanceM/,
  "derived BP-009/BP-011/BP-012 values must not become CableLine persistence");

assert.match(src, /lengthM: previous\?\.lengthM \?\? cfg\.lengthM \?\? ""/,
  "manual cableLine.lengthM authority must remain unchanged");
assert.match(src, /status: closed \? "continuous" : "undetermined"/,
  "BP-010 transition authority must remain unchanged");
assert.match(src, /sourceDirectDistanceM = sourceWorld && firstEndpoints/,
  "BP-011 source diagnostic must remain available");
assert.match(src, /targetDirectDistanceM = targetWorld && lastEndpoints/,
  "BP-011 target diagnostic must remain available");

console.log("BP-012 cable required length / reserve contract: PASS");
