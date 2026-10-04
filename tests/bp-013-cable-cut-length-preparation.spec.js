import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const file = path.resolve("ui/panels/WorkareaPanel.base.js");
const src = fs.readFileSync(file, "utf8");

assert.match(src, /cutAllowanceM: previous\?\.cutAllowanceM \?\? cfg\.cutAllowanceM \?\? ""/,
  "cut allowance must persist as explicit CableLine user authority");
assert.match(src, /key === "sourceReserveM" \|\| key === "targetReserveM" \|\| key === "cutAllowanceM"/,
  "cut allowance must use the existing non-negative CableLine persistence seam");
assert.match(src, /parsed !== null && Number\.isFinite\(parsed\) && parsed >= 0 \? parsed : ""/,
  "cut allowance input must distinguish valid non-negative values from unset or invalid input");

const assignmentStart = src.indexOf("_getCableLineRouteAssignmentV1(cableLine = {}, sceneObj = null)");
const assignmentEnd = src.indexOf("\n  _setCableLineRouteRefsV1", assignmentStart);
const assignment = src.slice(assignmentStart, assignmentEnd > assignmentStart ? assignmentEnd : assignmentStart + 14000);

assert.match(assignment, /const cutAllowanceM = parseReserveM\(cableLine\?\.cutAllowanceM\)/,
  "cut allowance must normalize through the existing non-negative planning-value parser");
assert.match(assignment, /const plannedCutLengthM = plannedRequiredLengthM !== null && cutAllowanceM !== null[\s\S]*?plannedRequiredLengthM \+ cutAllowanceM[\s\S]*?: null/,
  "planned cut length must exist only from BP-012 required length plus explicit cut allowance");
const plannedCutStart = assignment.indexOf("const plannedCutLengthM =");
const plannedCutEnd = assignment.indexOf("const sourceWorld =", plannedCutStart);
assert.ok(plannedCutStart >= 0 && plannedCutEnd > plannedCutStart,
  "planned cut length formula block must remain identifiable");
const plannedCutFormula = assignment.slice(plannedCutStart, plannedCutEnd);
assert.doesNotMatch(plannedCutFormula, /Math\.ceil|Math\.round|Math\.floor|allowancePercent|sourceDirectDistanceM|targetDirectDistanceM/,
  "BP-013 must not add automatic rounding, percentages, or BP-011 diagnostic geometry");
assert.match(assignment, /cutAllowanceM,[\s\S]*?plannedRequiredLengthM,[\s\S]*?plannedCutLengthM/,
  "BP-013 values must be exposed only through the runtime assignment summary");

assert.match(src, /Zuschnitt \+ m/,
  "UI must expose the explicit manual cut allowance");
assert.match(src, /Geplanter Zuschnitt: unbestimmt/);
assert.match(src, /Geplanter Zuschnitt: \$\{assigned\.plannedCutLengthM\.toFixed\(2\)\} m/);

const candidateStart = src.indexOf("_makeAssemblyCableLineCandidateV1");
const candidateEnd = src.indexOf("\n  _deriveAssemblyCableListV1", candidateStart);
const candidate = src.slice(candidateStart, candidateEnd > candidateStart ? candidateEnd : candidateStart + 9000);
assert.doesNotMatch(candidate, /plannedCutLengthM|plannedRequiredLengthM|knownMinimumTrayPathM|sourceDirectDistanceM|targetDirectDistanceM/,
  "derived BP-009/BP-011/BP-012/BP-013 values must not become CableLine persistence");

assert.match(src, /lengthM: previous\?\.lengthM \?\? cfg\.lengthM \?\? ""/,
  "manual cableLine.lengthM authority must remain unchanged");
assert.match(src, /knownMinimumTrayPathM \+ sourceReserveM \+ targetReserveM/,
  "BP-012 planned required length formula must remain unchanged");
assert.match(src, /status: closed \? "continuous" : "undetermined"/,
  "BP-010 transition authority must remain unchanged");
assert.match(src, /sourceDirectDistanceM = sourceWorld && firstEndpoints/,
  "BP-011 source diagnostic must remain available");
assert.match(src, /targetDirectDistanceM = targetWorld && lastEndpoints/,
  "BP-011 target diagnostic must remain available");
assert.doesNotMatch(src, /cutAllowancePercent|allowancePercent|drumLength|spoolLength|remainingDrum|remainingSpool/,
  "BP-013 must not introduce percentage allowance or drum/spool material logic");

console.log("BP-013 cable cut length preparation contract: PASS");
