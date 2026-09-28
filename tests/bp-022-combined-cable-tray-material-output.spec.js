import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");

test("BP-022 combines existing BP-018 and BP-021 derived rows without new material authority", () => {
  expect(source).toContain("_getCombinedCableTrayMaterialOutputRowsV1()");
  expect(source).toContain("const trayRows = this._getCableTrayMaterialOutputRowsV1()");
  expect(source).toContain("const supportRows = this._getCableTraySupportMaterialPreparationV1().rows");
  expect(source).toContain('category: "Unterstützungsmaterial"');
  expect(source).toContain("quantity: row.derivedQuantity");
  expect(source).toContain("supportType: row.supportType");

  const start = source.indexOf("_getCombinedCableTrayMaterialOutputRowsV1()");
  const end = source.indexOf("_makeCombinedCableTrayMaterialCSVV1", start);
  const block = source.slice(start, end);
  expect(block).not.toContain("_getCableTrayEvaluation()");
  expect(block).not.toContain("Math.ceil");
  expect(block).not.toContain("supportMaterialCompositions");
  expect(block).not.toMatch(/manufacturer|articleNumber|supplier|price|inventory|assembly\.instance\.bom/i);
});

test("BP-022 exports neutral combined CSV and preserves BP-018 output", () => {
  expect(source).toContain("_makeCombinedCableTrayMaterialCSVV1(rows = [])");
  for (const header of [
    '"Kategorie"', '"Bezeichnung"', '"Einheit"', '"Menge"', '"Stützart"',
    '"Trassentyp"', '"Breite_mm"', '"Planlaenge_m"', '"Stangenlaenge_m"',
    '"Anzahl_Stangen"', '"Einkaufslaenge_m"', '"Verschnitt_m"'
  ]) expect(source).toContain(header);

  expect(source).toContain("trayType: null");
  expect(source).toContain("widthMm: null");
  expect(source).toContain("plannedLengthM: null");
  expect(source).toContain("stickLengthM: null");
  expect(source).toContain("requiredStickCount: null");
  expect(source).toContain("purchaseLengthM: null");
  expect(source).toContain("offcutM: null");

  expect(source).toContain("_exportCombinedCableTrayMaterialCSVV1()");
  expect(source).toContain('this._btn("Gesamtmaterial CSV", () => this._exportCombinedCableTrayMaterialCSVV1())');
  expect(source).toContain('this._btn("Material CSV", () => this._exportCableTrayMaterialCSVV1())');
  expect(source).toContain("_getCableTrayMaterialOutputRowsV1()");
  expect(source).toContain("_makeCableTrayMaterialCSVV1(rows = [])");
});
