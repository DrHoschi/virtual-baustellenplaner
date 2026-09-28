import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");
const catalog = JSON.parse(fs.readFileSync("data/global-material-catalog.v1.json", "utf8"));

test("BP-026 introduces a separate global material identity authority", () => {
  expect(catalog.schema).toBe("baustellenplaner.globalMaterialCatalog.v1");
  expect(Array.isArray(catalog.materials)).toBeTruthy();
  expect(source).toContain("_loadGlobalMaterialCatalogV1()");
  expect(source).toContain('fetch("data/global-material-catalog.v1.json"');
  expect(source).toContain("_getProjectMaterialMappingsV1()");
  expect(source).toContain("app?.project?.materialMappings");
});

test("BP-026 resolves identity after existing quantity authorities without recalculation", () => {
  const start = source.indexOf("_getCableTrayMaterialIdentityResolutionV1()");
  const end = source.indexOf("\n  _", start + 3);
  const block = source.slice(start, end);
  expect(block).toContain("_getCableTrayMaterialPreparationV1().rows");
  expect(block).toContain("_getCableTrayAccessoryPreparationV1().rows");
  expect(block).toContain("_getCableTraySupportMaterialPreparationV1().rows");
  expect(block).toContain("_getCableTrayFittingMaterialPreparationV1().rows");
  expect(block).toContain("materialId");
  expect(block).toContain("unresolved");
  expect(block).not.toContain("Math.ceil");
  expect(block).not.toContain("Math.hypot");
  expect(block).not.toContain("_getCableTrayEvaluation");
});

test("BP-026 keeps support quantity authority in BP-021 and only carries optional materialId", () => {
  expect(source).toContain("materialId: materialId || null");
  expect(source).toContain("derivedQuantity: supportRow.supportCount * quantityPerSupport");
  expect(source).not.toContain("resolutionStatus");
});

test("BP-026 does not redefine existing asset catalog or global asset library", () => {
  const technicalCatalog = fs.readFileSync("data/assets.catalog.v1.json", "utf8");
  const assetLibrary = fs.readFileSync("data/global-asset-library.v1.json", "utf8");
  expect(technicalCatalog).not.toContain("globalMaterialCatalog");
  expect(assetLibrary).not.toContain("globalMaterialCatalog");
});
