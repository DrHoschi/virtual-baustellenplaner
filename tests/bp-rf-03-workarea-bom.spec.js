import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(new URL("../ui/workarea/workarea-bom.v1.js", import.meta.url), "utf8");

const methodNames = [
  "_renderBOMPanelFull",
  "_groupBOMRowsByAssemblyV1",
  "_computeBOMRows",
  "_getBOMCurrency",
  "_setBOMCurrency",
  "_getBOMLineMap",
  "_getBOMUnitPrice",
  "_getBOMSKU",
  "_getBOMUOM",
  "_getBOMManufacturer",
  "_getBOMSupplier",
  "_getBOMComment",
  "_setBOMLineField",
  "_setBOMPrice",
  "_makeBOMExportPayload",
  "_makeBOMCSV",
  "_renderBOMPanel"
];

const definitionCount = (source, name) =>
  (source.match(new RegExp("^  (?:async )?" + name + "\\s*\\(", "gm")) || []).length;

test("BP-RF-03 installs the extracted Workarea BOM module exactly once", () => {
  const moduleImport = 'im' + 'port { installWorkareaBomModule } from "../workarea/workarea-bom.v1.js";';

  expect(baseSource.split(moduleImport)).toHaveLength(2);
  expect(baseSource.split("installWorkareaBomModule(WorkareaPanel);")).toHaveLength(2);
  expect(moduleSource).toContain("export function installWorkareaBomModule(WorkareaPanelClass)");
  expect(moduleSource).toContain("Object.getOwnPropertyDescriptors(WorkareaBomModule.prototype)");
  expect(moduleSource).toContain("Object.defineProperties(WorkareaPanelClass.prototype, descriptors)");
});

test("BP-RF-03 keeps all seventeen BOM methods only in the dedicated module", () => {
  for (const methodName of methodNames) {
    expect(definitionCount(moduleSource, methodName), methodName).toBe(1);
    expect(definitionCount(baseSource, methodName), methodName).toBe(0);
  }
});

test("BP-RF-03 preserves BOM authorities and excludes cable-tray material output", () => {
  expect(moduleSource).toContain("project.assets.settings.bom");
  expect(moduleSource).toContain('this.store.update("app"');
  expect(moduleSource).toContain('this.store.update("project"');
  expect(moduleSource).toContain("this._requestProjectSaveDebounced");
  expect(moduleSource).toContain('schema: "baustellenplaner.bom.assemblylab.v1"');
  expect(moduleSource).toContain("this._getSceneObjectsFromStore()");
  expect(moduleSource).toContain("this._getProjectAssetsFromStore()");

  expect(moduleSource).not.toContain("_getCableTrayMaterialOutputRowsV1");
  expect(moduleSource).not.toContain("_getCombinedCableTrayMaterialOutputRowsV1");
  expect(moduleSource).not.toContain("_exportCombinedCableTrayMaterialCSVV1");
  expect(moduleSource).not.toContain("tray.dutyClass");
});
