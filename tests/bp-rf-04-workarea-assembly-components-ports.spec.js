import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(
  new URL("../ui/workarea/workarea-assembly-components-ports.v1.js", import.meta.url),
  "utf8"
);

const methodNames = [
  "_getAssemblyComponentRolesV1",
  "_getAssemblyRoleLabelV1",
  "_inferAssemblyComponentRoleV1",
  "_getAssemblyPortTemplatesV1",
  "_makeAssemblyComponentPortsV1",
  "_normalizeAssemblyComponentPortsV1",
  "_normalizeAssemblyComponentsWithPortsV1",
  "_flattenAssemblyPortsV1",
  "_formatAssemblyPortSummaryV1"
];

const definitionCount = (source, name) =>
  (source.match(new RegExp("^  (?:async )?" + name + "\\s*\\(", "gm")) || []).length;

test("BP-RF-04 installs the extracted Assembly components/ports module exactly once", () => {
  const moduleImport =
    'im' + 'port { installWorkareaAssemblyComponentsPortsModule } from "../workarea/workarea-assembly-components-ports.v1.js";';

  expect(baseSource.split(moduleImport)).toHaveLength(2);
  expect(baseSource.split("installWorkareaAssemblyComponentsPortsModule(WorkareaPanel);")).toHaveLength(2);
  expect(moduleSource).toContain(
    "export function installWorkareaAssemblyComponentsPortsModule(WorkareaPanelClass)"
  );
  expect(moduleSource).toContain(
    "Object.getOwnPropertyDescriptors(WorkareaAssemblyComponentsPortsModule.prototype)"
  );
  expect(moduleSource).toContain("Object.defineProperties(WorkareaPanelClass.prototype, descriptors)");
});

test("BP-RF-04 keeps all nine Assembly component/port methods only in the dedicated module", () => {
  for (const methodName of methodNames) {
    expect(definitionCount(moduleSource, methodName), methodName).toBe(1);
    expect(definitionCount(baseSource, methodName), methodName).toBe(0);
  }
});

test("BP-RF-04 preserves the existing domain boundaries", () => {
  expect(moduleSource).toContain('schema: "baustellenplaner.assemblylab.port.v1"');
  expect(moduleSource).toContain("this._assemblyLabClone(cmp, cmp)");

  expect(moduleSource).not.toContain("_persistAssemblyLabToStore");
  expect(moduleSource).not.toContain("_assemblyPropsPersistScene");
  expect(moduleSource).not.toContain("_persistSceneToStore");
  expect(moduleSource).not.toContain("_deriveAssemblyCablePointsV1");
  expect(moduleSource).not.toContain("_deriveAssemblyCableListV1");
  expect(moduleSource).not.toContain("_ensureAssemblyEplanV1");
  expect(moduleSource).not.toContain("_computeBOMRows");
  expect(moduleSource).not.toContain("cable-tray.route");
  expect(moduleSource).not.toContain("tray.dutyClass");
});
