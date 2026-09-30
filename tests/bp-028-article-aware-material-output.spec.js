import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "ui/workarea/workarea-cable-tray.v1.js"),
  "utf8"
);

function methodBlock(name, nextName) {
  const start = source.indexOf(name);
  const end = source.indexOf(nextName, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("BP-028 article-aware combined material output", () => {
  it("extends the existing combined output instead of creating a second material-output authority", () => {
    const block = methodBlock(
      "_getCombinedCableTrayMaterialOutputRowsV1()",
      "_makeCombinedCableTrayMaterialCSVV1("
    );
    expect(block).toContain("_getCableTrayMaterialOutputRowsV1()");
    expect(block).toContain("_getCableTraySupportMaterialPreparationV1().rows");
    expect(block).toContain("_getCableTrayFittingMaterialPreparationV1().rows");
    expect(block).toContain("materialId:");
    expect(block).toContain("manufacturer:");
    expect(block).toContain("articleNumber:");
    expect(block).not.toContain(".filter(");
  });

  it("uses BP-026 authoritative keys for tray, accessory and fitting identity", () => {
    const block = methodBlock(
      "_getCombinedCableTrayMaterialOutputRowsV1()",
      "_makeCombinedCableTrayMaterialCSVV1("
    );
    expect(block).toContain('mapping?.sourceKind === "tray"');
    expect(block).toContain("mapping?.trayType");
    expect(block).toContain("mapping?.widthMm");
    expect(block).toContain('mapping?.sourceKind === "accessory"');
    expect(block).toContain("mapping?.accessoryKind");
    expect(block).toContain('mapping?.sourceKind === "fitting"');
    expect(block).toContain("mapping?.fittingKind");
  });

  it("resolves support identity only from its existing materialId", () => {
    const block = methodBlock(
      "_getCombinedCableTrayMaterialOutputRowsV1()",
      "_makeCombinedCableTrayMaterialCSVV1("
    );
    expect(block).toContain('typeof row?.materialId === "string"');
    expect(block).toContain("_findGlobalMaterialV1(materialId)");
    expect(block).not.toMatch(/supportType[^\n]*_findGlobalMaterialV1/);
    expect(block).not.toMatch(/row\.name[^\n]*_findGlobalMaterialV1/);
  });

  it("preserves the existing quantity fields without introducing BP-028 quantity calculations", () => {
    const block = methodBlock(
      "_getCombinedCableTrayMaterialOutputRowsV1()",
      "_makeCombinedCableTrayMaterialCSVV1("
    );
    expect(block).toContain("quantity: Number.isFinite(Number(row.purchaseLengthM)) ? Number(row.purchaseLengthM) : null");
    expect(block).toContain("quantity: row.derivedQuantity");
    expect(block).toContain("quantity: row.quantity");
    expect(block).not.toContain("Math.ceil(");
    expect(block).not.toContain("supportCount *");
  });

  it("appends exactly the three article columns after the existing combined CSV columns", () => {
    const block = methodBlock(
      "_makeCombinedCableTrayMaterialCSVV1(rows = [])",
      "async _exportCombinedCableTrayMaterialCSVV1()"
    );
    expect(block).toContain('"Verschnitt_m",\n      "Material_ID",\n      "Hersteller",\n      "Artikelnummer"');
    expect(block).toContain('row?.materialId || ""');
    expect(block).toContain('row?.manufacturer || ""');
    expect(block).toContain('row?.articleNumber || ""');
  });

  it("leaves the simple BP-018 material CSV article-unaware", () => {
    const block = methodBlock(
      "_makeCableTrayMaterialCSVV1(rows = [])",
      "async _exportCableTrayMaterialCSVV1()"
    );
    expect(block).not.toContain("Material_ID");
    expect(block).not.toContain("Hersteller");
    expect(block).not.toContain("Artikelnummer");
  });
});
