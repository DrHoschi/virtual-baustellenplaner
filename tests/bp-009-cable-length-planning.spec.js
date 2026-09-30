import fs from "node:fs";
import assert from "node:assert/strict";

const baseSource = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");
const cableTraySource = fs.readFileSync(new URL("../ui/workarea/workarea-cable-tray.v1.js", import.meta.url), "utf8");

assert.match(baseSource, /const knownMinimumTrayPathM = routes\.reduce\([\s\S]*?_getCableTrayLengthM\(route\)/,
  "BP-009 must derive the known minimum only from referenced tray geometry");
assert.match(baseSource, /manualLengthRaw = String\(cableLine\?\.lengthM[\s\S]*?manualLengthM/,
  "manual cable length must remain the existing CableLine input");
assert.match(baseSource, /manualMinusKnownMinimumM = manualLengthM === null \? null : manualLengthM - knownMinimumTrayPathM/,
  "comparison must be runtime-derived from manual length and known minimum");
assert.match(baseSource, /knownMinimumTrayPathM,[\s\S]*?manualLengthM,[\s\S]*?manualMinusKnownMinimumM,[\s\S]*?hasUndeterminedPortions/,
  "BP-009 derived values must be returned by the runtime assignment summary");
assert.match(baseSource, /Bekannte Trassen-Mindestweglänge:/,
  "UI must identify the derived value as a known minimum tray-path length");
assert.match(baseSource, /Übergänge:[\s\S]*?unbestimmt/,
  "UI must explicitly mark unresolved transition portions as undetermined");
assert.match(baseSource, /Quelle → Trasse: unbestimmt[\s\S]*?Trasse → Ziel: unbestimmt/,
  "UI must explicitly mark unresolved connection portions as undetermined");
assert.match(baseSource, /Manuelle Kabellänge:/,
  "UI must keep the manual cable length visible separately");
assert.match(baseSource, /Differenz zur Mindestweglänge:/,
  "UI may show only a derived informational difference");

const setterStart = baseSource.indexOf("_setCableLineRouteRefsV1(");
const setterEnd = baseSource.indexOf("_makeAssemblyCableLineCandidateV1(", setterStart);
const setter = baseSource.slice(setterStart, setterEnd);
assert.match(setter, /cableLine\.routeRefs = next/,
  "routeRefs remain the only BP-008 assignment persistence");
assert.doesNotMatch(setter, /knownMinimumTrayPathM|manualMinusKnownMinimumM|predicted/i,
  "BP-009 must not persist its derived or predicted length values");

const candidateStart = baseSource.indexOf("_makeAssemblyCableLineCandidateV1(");
const candidateEnd = baseSource.indexOf("_deriveAssemblyCableListV1(", candidateStart);
const candidate = baseSource.slice(candidateStart, candidateEnd);
assert.match(candidate, /lengthM: previous\?\.lengthM \?\? cfg\.lengthM \?\? ""/,
  "manual cableLine.lengthM authority must remain unchanged");
assert.doesNotMatch(candidate, /knownMinimumTrayPathM|manualMinusKnownMinimumM|connectionDistance|transitionDistance/i,
  "CableLine persistence must not gain BP-009 derived fields");

assert.match(baseSource, /const trayPathLengthM = routes\.reduce|const knownMinimumTrayPathM = routes\.reduce/,
  "existing BP-008 tray route assignment derivation must remain present");
assert.match(cableTraySource, /_setCableTrayEndpointRef\(route, side, ref\)/,
  "BP-006 endpoint binding must remain independent");
assert.match(cableTraySource, /_getCableTrayMaterialRequirement\(\)/,
  "BP-007 material requirement must remain present");

console.log("BP-009 cable length planning acceptance: PASS");
