import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");

test("BP-025 projects BP-024 fitting rows directly into combined material output", () => {
  const start = source.indexOf("  _getCombinedCableTrayMaterialOutputRowsV1(");
  const end = source.indexOf("\n  _", start + 3);
  const block = source.slice(start, end);

  expect(block).toContain("const fittingRows = this._getCableTrayFittingMaterialPreparationV1().rows");
  expect(block).toContain('category: "Formteil"');
  expect(block).toContain("name: row.name");
  expect(block).toContain("unit: row.unit");
  expect(block).toContain("quantity: row.quantity");

  for (const field of [
    "supportType", "trayType", "widthMm", "plannedLengthM",
    "stickLengthM", "requiredStickCount", "purchaseLengthM", "offcutM"
  ]) expect(block).toContain(`${field}: null`);
});

test("BP-025 never recounts BP-023 fittings or infers material from geometry", () => {
  const start = source.indexOf("  _getCombinedCableTrayMaterialOutputRowsV1(");
  const end = source.indexOf("\n  _", start + 3);
  const block = source.slice(start, end);

  expect(block).not.toContain("cableTrayFittings");
  expect(block).not.toContain("_validateCableTrayFittingV1");
  expect(block).not.toContain("unresolvedCount");
  expect(block).not.toContain("points");
  expect(block).not.toContain("Math.atan");
  expect(block).not.toContain("Math.hypot");
});

test("BP-025 reuses existing Gesamtmaterial CSV and leaves BP-018 Material CSV separate", () => {
  expect(source).toContain("_makeCombinedCableTrayMaterialCSVV1(rows = [])");
  expect(source).toContain("_exportCombinedCableTrayMaterialCSVV1()");
  expect(source).toContain('this._btn("Gesamtmaterial CSV", () => this._exportCombinedCableTrayMaterialCSVV1())');
  expect(source).toContain("_getCableTrayMaterialOutputRowsV1()");
  expect(source).toContain("_makeCableTrayMaterialCSVV1(rows = [])");

  const csvStart = source.indexOf("  _makeCombinedCableTrayMaterialCSVV1(");
  const csvEnd = source.indexOf("\n  _", csvStart + 3);
  const csvBlock = source.slice(csvStart, csvEnd);
  expect(csvBlock).not.toContain("_getCableTrayFittingMaterialPreparationV1");
  expect(csvBlock).not.toContain("cableTrayFittings");
});
