import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(
  new URL("../ui/workarea/workarea-assembly-cable-lines.v1.js", import.meta.url),
  "utf8"
);

const methodNames = [
  "_getAssemblyCableLineTypesV1",
  "_getAssemblyCableLineTypeLabelV1",
  "_getAssemblyCableLineTypeHintV1",
  "_labelAssemblyCablePointV1",
  "_makeAssemblyCableLineIdV1",
  "_makeAssemblyCableLineCandidateV1",
  "_deriveAssemblyCableListV1",
  "_formatAssemblyCableListSummaryV1",
  "_getAssemblyCableLineStatusOptionsV1",
  "_getAssemblyCableLineStatusLabelV1"
];

const definitionCount = (source, name) =>
  (source.match(new RegExp("^  (?:async )?" + name + "\\s*\\(", "gm")) || []).length;

test("BP-RF-06 installs the extracted Assembly CableLine core module exactly once and after CablePoints", () => {
  const moduleImport =
    'im' + 'port { installWorkareaAssemblyCableLinesModule } from "../workarea/workarea-assembly-cable-lines.v1.js";';
  const cablePointInstall = "installWorkareaAssemblyCablePointsModule(WorkareaPanel);";
  const cableLineInstall = "installWorkareaAssemblyCableLinesModule(WorkareaPanel);";

  expect(baseSource.split(moduleImport)).toHaveLength(2);
  expect(baseSource.split(cableLineInstall)).toHaveLength(2);
  expect(baseSource.indexOf(cableLineInstall)).toBeGreaterThan(baseSource.indexOf(cablePointInstall));
  expect(moduleSource).toContain(
    "export function installWorkareaAssemblyCableLinesModule(WorkareaPanelClass)"
  );
  expect(moduleSource).toContain(
    "Object.getOwnPropertyDescriptors(WorkareaAssemblyCableLinesModule.prototype)"
  );
  expect(moduleSource).toContain("Object.defineProperties(WorkareaPanelClass.prototype, descriptors)");
});

test("BP-RF-06 keeps all ten Assembly CableLine core methods only in the dedicated module", () => {
  for (const methodName of methodNames) {
    expect(definitionCount(moduleSource, methodName), methodName).toBe(1);
    expect(definitionCount(baseSource, methodName), methodName).toBe(0);
  }
});

test("BP-RF-06 preserves CableLine authorities and leaves routing, diagnostics, persistence and output in the base", () => {
  expect(moduleSource).toContain('schema: "baustellenplaner.assemblylab.cableline.v1"');
  expect(moduleSource).toContain("Array.isArray(sceneObj?.cableLines)");
  expect(moduleSource).toContain("Array.isArray(sceneObj?.cableList) ? sceneObj.cableList : []");
  expect(moduleSource).toContain("this._deriveAssemblyCablePointsV1(sceneObj)");
  expect(moduleSource).toContain("this._normalizeCableLineRouteRefsV1");
  expect(moduleSource).toContain("this._normalizeCableLineRouteDirectionsV1");
  expect(moduleSource).toContain("this._defaultCableLineEplanV1(sceneObj, cfg, sourceCp, targetCp)");

  expect(moduleSource).not.toContain("_getCableLineRouteAssignmentV1");
  expect(moduleSource).not.toContain("_getAssemblyCablePointWorldPositionV1");
  expect(moduleSource).not.toContain("_assemblyPropsPersistScene");
  expect(moduleSource).not.toContain("_persistSceneToStore");
  expect(moduleSource).not.toContain("plannedRequiredLengthM");
  expect(moduleSource).not.toContain("plannedCutLengthM");
  expect(moduleSource).not.toContain("sourceDirectDistanceM");
  expect(moduleSource).not.toContain("targetDirectDistanceM");
  expect(moduleSource).not.toContain(["tray", "dutyClass"].join("."));

  expect(baseSource).toContain("_getCableLineRouteAssignmentV1(cableLine = {}, sceneObj = null)");
  expect(baseSource).toContain("_getAssemblyCablePointWorldPositionV1(sceneObj = {}, cablePoint = null)");
  expect(baseSource).toContain("_ensureAssemblyCableLinesV1(sceneObj = {})");
  expect(baseSource).toContain("_setAssemblyCableLineFieldV1(sceneObj = {}, lineId, field, value)");
  expect(baseSource).toContain("_getProjectCablePreparationRowsV1()");
  expect(baseSource).toContain("_makeCablePreparationCSVV1(rows = [])");
  expect(baseSource).toContain("_renderCablePreparationListV1()");
});
