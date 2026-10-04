import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(
  new URL("../ui/workarea/workarea-assembly-cable-points.v1.js", import.meta.url),
  "utf8"
);

const methodNames = [
  "_getAssemblyCablePointTypesV1",
  "_getAssemblyCablePointTypeLabelV1",
  "_inferAssemblyCablePointTypeFromPortV1",
  "_makeAssemblyCablePointIdV1",
  "_makeAssemblyCablePointFromPortV1",
  "_deriveAssemblyCablePointsV1",
  "_formatAssemblyCablePointSummaryV1"
];

const definitionCount = (source, name) =>
  (source.match(new RegExp("^  (?:async )?" + name + "\\s*\\(", "gm")) || []).length;

test("BP-RF-05 installs the extracted Assembly CablePoint module exactly once", () => {
  const moduleImport =
    'im' + 'port { installWorkareaAssemblyCablePointsModule } from "../workarea/workarea-assembly-cable-points.v1.js";';

  expect(baseSource.split(moduleImport)).toHaveLength(2);
  expect(baseSource.split("installWorkareaAssemblyCablePointsModule(WorkareaPanel);")).toHaveLength(2);
  expect(moduleSource).toContain(
    "export function installWorkareaAssemblyCablePointsModule(WorkareaPanelClass)"
  );
  expect(moduleSource).toContain(
    "Object.getOwnPropertyDescriptors(WorkareaAssemblyCablePointsModule.prototype)"
  );
  expect(moduleSource).toContain("Object.defineProperties(WorkareaPanelClass.prototype, descriptors)");
});

test("BP-RF-05 keeps all seven Assembly CablePoint methods only in the dedicated module", () => {
  for (const methodName of methodNames) {
    expect(definitionCount(moduleSource, methodName), methodName).toBe(1);
    expect(definitionCount(baseSource, methodName), methodName).toBe(0);
  }
});

test("BP-RF-05 preserves the existing CablePoint domain boundaries", () => {
  expect(moduleSource).toContain('schema: "baustellenplaner.assemblylab.cablepoint.v1"');
  expect(moduleSource).toContain("this._flattenAssemblyPortsV1(sceneObj?.components || [])");
  expect(moduleSource).toContain("this._getAssemblyRoleLabelV1(port?.role || \"component\")");
  expect(moduleSource).toContain("Array.isArray(sceneObj?.cablepoints) ? sceneObj.cablepoints : []");

  expect(moduleSource).not.toContain("_persistAssemblyLabToStore");
  expect(moduleSource).not.toContain("_assemblyPropsPersistScene");
  expect(moduleSource).not.toContain("_persistSceneToStore");
  expect(moduleSource).not.toContain("_deriveAssemblyCableListV1");
  expect(moduleSource).not.toContain("_getAssemblyCablePointWorldPositionV1");
  expect(moduleSource).not.toContain("_ensureAssemblyEplanV1");
  expect(moduleSource).not.toContain("_computeBOMRows");
  expect(moduleSource).not.toContain("cable-tray.route");
  expect(moduleSource).not.toContain(["tray", "dutyClass"].join("."));

  expect(baseSource).toContain("_deriveAssemblyCableListV1(sceneObj = {})");
  expect(baseSource).toContain("_getAssemblyCablePointWorldPositionV1(sceneObj = {}, cablePoint = null)");
});
