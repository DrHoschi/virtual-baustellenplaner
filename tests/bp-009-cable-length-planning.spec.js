import fs from "node:fs";
import assert from "node:assert/strict";

const src = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");

assert.match(src, /const knownMinimumTrayPathM = routes\.reduce\([\s\S]*?_getCableTrayLengthM\(route\)/,
  "BP-009 must derive the known minimum only from referenced tray geometry");
assert.match(src, /manualLengthRaw = String\(cableLine\?\.lengthM[\s\S]*?manualLengthM/,
  "manual cable length must remain the existing CableLine input");
assert.match(src, /manualMinusKnownMinimumM = manualLengthM === null \? null : manualLengthM - knownMinimumTrayPathM/,
  "comparison must be runtime-derived from manual length and known minimum");
assert.match(src, /knownMinimumTrayPathM,[\s\S]*?manualLengthM,[\s\S]*?manualMinusKnownMinimumM,[\s\S]*?hasUndeterminedPortions/,
  "BP-009 derived values must be returned by the runtime assignment summary");
assert.match(src, /Bekannte Trassen-Mindestweglänge:/,
  "UI must identify the derived value as a known minimum tray-path length");
assert.match(src, /Anschluss-\/Übergangsanteile: unbestimmt/,
  "UI must explicitly mark connection and transition portions as undetermined");
assert.match(src, /Manuelle Kabellänge:/,
  "UI must keep the manual cable length visible separately");
assert.match(src, /Differenz zur Mindestweglänge:/,
  "UI may show only a derived informational difference");

const setterStart = src.indexOf("_setCableLineRouteRefsV1(");
const setterEnd = src.indexOf("_makeAssemblyCableLineCandidateV1(", setterStart);
const setter = src.slice(setterStart, setterEnd);
assert.match(setter, /cableLine\.routeRefs = next/,
  "routeRefs remain the only BP-008 assignment persistence");
assert.doesNotMatch(setter, /knownMinimumTrayPathM|manualMinusKnownMinimumM|reserve|predicted/i,
  "BP-009 must not add derived length or reserve persistence");

const candidateStart = src.indexOf("_makeAssemblyCableLineCandidateV1(");
const candidateEnd = src.indexOf("_deriveAssemblyCableListV1(", candidateStart);
const candidate = src.slice(candidateStart, candidateEnd);
assert.match(candidate, /lengthM: previous\?\.lengthM \?\? cfg\.lengthM \?\? ""/,
  "manual cableLine.lengthM authority must remain unchanged");
assert.doesNotMatch(candidate, /knownMinimumTrayPathM|manualMinusKnownMinimumM|connectionDistance|transitionDistance|reserve/i,
  "CableLine persistence must not gain BP-009 derived fields");

assert.match(src, /const trayPathLengthM = routes\.reduce|const knownMinimumTrayPathM = routes\.reduce/,
  "existing BP-008 tray route assignment derivation must remain present");
assert.match(src, /route\.startRef|startRef|_setCableTrayEndpointRef/,
  "BP-006 endpoint binding must remain independent");
assert.match(src, /_getCableTrayMaterialRequirement\(\)/,
  "BP-007 material requirement must remain present");

console.log("BP-009 cable length planning acceptance: PASS");
