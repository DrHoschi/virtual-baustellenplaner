import assert from "node:assert/strict";
import {
  MATERIAL_CATALOG_SCHEMA,
  MATERIAL_CATALOG_VERSION,
  validateGlobalMaterialCatalogV1
} from "../scripts/global-material-catalog-check.mjs";

function catalog(materials = []) {
  return {
    schema: MATERIAL_CATALOG_SCHEMA,
    version: MATERIAL_CATALOG_VERSION,
    materials
  };
}

function material(overrides = {}) {
  return {
    materialId: "mat.niedax.example.v1",
    manufacturer: "Niedax",
    articleNumber: "EXAMPLE-001",
    name: "Beispielartikel",
    unit: "Stk.",
    ...overrides
  };
}

function expectValid(value, label) {
  assert.deepEqual(validateGlobalMaterialCatalogV1(value), [], label);
}

function expectInvalid(value, pattern, label) {
  const errors = validateGlobalMaterialCatalogV1(value);
  assert.ok(errors.some((entry) => pattern.test(entry)), `${label}: ${errors.join(" | ")}`);
}

expectValid(catalog(), "empty catalog remains valid");
expectValid(catalog([material()]), "complete verified-shaped article is valid");
expectValid(catalog([
  material({ materialId: "mat.a", articleNumber: "A-1", name: "Gleicher Name" }),
  material({ materialId: "mat.b", articleNumber: "B-1", name: "Gleicher Name" })
]), "same display name is not material identity");

for (const field of ["materialId", "manufacturer", "articleNumber", "name", "unit"]) {
  expectInvalid(catalog([material({ [field]: "   " })]), new RegExp(`\\.${field} must not be empty`), `empty ${field} rejected`);
  expectInvalid(catalog([material({ [field]: 123 })]), new RegExp(`\\.${field} must be a string`), `non-string ${field} rejected`);
}

for (const placeholder of ["?", "unknown", "N/A", "TBD"]) {
  expectInvalid(catalog([material({ articleNumber: placeholder })]), /unknown placeholder/, `placeholder ${placeholder} rejected`);
}

expectInvalid(catalog([
  material({ materialId: "mat.same", articleNumber: "A-1" }),
  material({ materialId: "mat.same", articleNumber: "A-2" })
]), /materialId duplicates/, "duplicate materialId rejected");

expectInvalid(catalog([
  material({ materialId: "mat.a", manufacturer: " Niedax ", articleNumber: " ABC-1 " }),
  material({ materialId: "mat.b", manufacturer: "niedax", articleNumber: "abc-1" })
]), /duplicates manufacturer \+ articleNumber/, "normalized manufacturer + articleNumber duplicate rejected");

expectInvalid({ schema: "wrong", version: MATERIAL_CATALOG_VERSION, materials: [] }, /schema must be/, "wrong schema rejected");
expectInvalid({ schema: MATERIAL_CATALOG_SCHEMA, version: MATERIAL_CATALOG_VERSION, materials: {} }, /materials must be an array/, "non-array materials rejected");

console.log("BP-029 global material catalog validation contract PASS");
