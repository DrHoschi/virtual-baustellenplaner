import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");
const routingSource = fs.readFileSync(
  new URL("../ui/workarea/workarea-assembly-cable-routing.v1.js", import.meta.url),
  "utf8"
);
const cableLineSource = fs.readFileSync(
  new URL("../ui/workarea/workarea-assembly-cable-lines.v1.js", import.meta.url),
  "utf8"
);

const methodNames = [
  "_normalizeCableLineRouteRefsV1",
  "_normalizeCableLineRouteDirectionsV1",
  "_getAssemblyCablePointWorldPositionV1",
  "_resolveCableLineEndpointWorldPositionV1",
  "_getDirectDistanceM2dV1",
  "_getCableLineRouteAssignmentV1",
  "_setCableLineRouteRefsV1",
  "_setCableLineRouteDirectionV1"
];

const definitionCount = (source, name) =>
  (source.match(new RegExp("^  (?:async )?" + name + "\\s*\\(", "gm")) || []).length;

test("BP-RF-07 installs the extracted CableLine routing module exactly once after CableLines", () => {
  const moduleImport =
    'im' + 'port { installWorkareaAssemblyCableRoutingModule } from "../workarea/workarea-assembly-cable-routing.v1.js";';
  const cableLineInstall = "installWorkareaAssemblyCableLinesModule(WorkareaPanel);";
  const routingInstall = "installWorkareaAssemblyCableRoutingModule(WorkareaPanel);";

  expect(baseSource.split(moduleImport)).toHaveLength(2);
  expect(baseSource.split(routingInstall)).toHaveLength(2);
  expect(baseSource.indexOf(routingInstall)).toBeGreaterThan(baseSource.indexOf(cableLineInstall));
  expect(routingSource).toContain(
    "export function installWorkareaAssemblyCableRoutingModule(WorkareaPanelClass)"
  );
  expect(routingSource).toContain(
    "Object.getOwnPropertyDescriptors(WorkareaAssemblyCableRoutingModule.prototype)"
  );
  expect(routingSource).toContain("Object.defineProperties(WorkareaPanelClass.prototype, descriptors)");
});

test("BP-RF-07 keeps all eight CableLine routing methods only in the dedicated module", () => {
  for (const methodName of methodNames) {
    expect(definitionCount(routingSource, methodName), methodName).toBe(1);
    expect(definitionCount(baseSource, methodName), methodName).toBe(0);
    expect(definitionCount(cableLineSource, methodName), methodName).toBe(0);
  }
});

test("BP-RF-07 preserves routing, length, reserve, cut and diagnostics authorities", () => {
  expect(cableLineSource).toContain("routeRefs: this._normalizeCableLineRouteRefsV1");
  expect(routingSource).toContain("routeDirections");
  expect(routingSource).toContain("const routes = routeRefs.map((id) => byId.get(id) || null)");
  expect(routingSource).toContain("const knownMinimumTrayPathM = routes.reduce");
  expect(routingSource).toContain("const sourceReserveM = parseReserveM(cableLine?.sourceReserveM)");
  expect(routingSource).toContain("const targetReserveM = parseReserveM(cableLine?.targetReserveM)");
  expect(routingSource).toContain("const cutAllowanceM = parseReserveM(cableLine?.cutAllowanceM)");
  expect(routingSource).toContain("const plannedRequiredLengthM =");
  expect(routingSource).toContain("? knownMinimumTrayPathM + sourceReserveM + targetReserveM");
  expect(routingSource).toContain("const plannedCutLengthM = plannedRequiredLengthM !== null && cutAllowanceM !== null");
  expect(routingSource).toContain("? plannedRequiredLengthM + cutAllowanceM");
  expect(routingSource).toContain("sourceDirectDistanceM = sourceWorld && firstEndpoints");
  expect(routingSource).toContain("targetDirectDistanceM = targetWorld && lastEndpoints");
  expect(routingSource).toContain('this._assemblyPropsPersistScene(sceneObj, "assemblyprops:cable-route-assignment")');
  expect(routingSource).toContain('this._assemblyPropsPersistScene(sceneObj, "assemblyprops:cable-route-direction")');

  expect(routingSource).not.toContain("cableLine.plannedRequiredLengthM =");
  expect(routingSource).not.toContain("cableLine.plannedCutLengthM =");
  expect(routingSource).not.toContain(["tray", "dutyClass"].join("."));
  expect(baseSource).toContain("_getProjectCablePreparationRowsV1()");
  expect(baseSource).toContain("_makeCablePreparationCSVV1(rows = [])");
  expect(baseSource).toContain("_renderCablePreparationListV1()");
});
