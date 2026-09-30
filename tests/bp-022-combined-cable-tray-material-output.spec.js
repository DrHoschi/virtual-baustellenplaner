import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");
const cableTraySource = fs.readFileSync("ui/workarea/workarea-cable-tray.v1.js", "utf8");

test("BP-022 combines existing BP-018 and BP-021 derived rows without new material authority", () => {
  expect(cableTraySource).toContain("_getCombinedCableTrayMaterialOutputRowsV1()");
  expect(cableTraySource).toContain("const trayRows = this._getCableTrayMaterialOutputRowsV1()");
  expect(cableTraySource).toContain("const supportRows = this._getCableTraySupportMaterialPreparationV1().rows");
  expect(cableTraySource).toContain('category: "Unterstützungsmaterial"');
  expect(cableTraySource).toContain("quantity: row.derivedQuantity");
  expect(cableTraySource).toContain("supportType: row.supportType");

  const start = cableTraySource.indexOf("_getCombinedCableTrayMaterialOutputRowsV1()");
  const end = cableTraySource.indexOf("_makeCombinedCableTrayMaterialCSVV1", start);
  const block = cableTraySource.slice(start, end);
  expect(block).not.toContain("_getCableTrayEvaluation()");
  expect(block).not.toContain("Math.ceil");
  expect(block).not.toContain("supportMaterialCompositions");
  expect(block).not.toMatch(/manufacturer|articleNumber|supplier|price|inventory|assembly\.instance\.bom/i);
});

test("BP-022 exports neutral combined CSV and preserves BP-018 output", () => {
  expect(cableTraySource).toContain("_makeCombinedCableTrayMaterialCSVV1(rows = [])");
  for (const header of [
    '"Kategorie"', '"Bezeichnung"', '"Einheit"', '"Menge"', '"Stützart"',
    '"Trassentyp"', '"Breite_mm"', '"Planlaenge_m"', '"Stangenlaenge_m"',
    '"Anzahl_Stangen"', '"Einkaufslaenge_m"', '"Verschnitt_m"'
  ]) expect(cableTraySource).toContain(header);

  expect(cableTraySource).toContain("trayType: null");
  expect(cableTraySource).toContain("widthMm: null");
  expect(cableTraySource).toContain("plannedLengthM: null");
  expect(cableTraySource).toContain("stickLengthM: null");
  expect(cableTraySource).toContain("requiredStickCount: null");
  expect(cableTraySource).toContain("purchaseLengthM: null");
  expect(cableTraySource).toContain("offcutM: null");

  expect(cableTraySource).toContain("_exportCombinedCableTrayMaterialCSVV1()");
  expect(baseSource).toContain('this._btn("Gesamtmaterial CSV", () => this._exportCombinedCableTrayMaterialCSVV1())');
  expect(baseSource).toContain('this._btn("Material CSV", () => this._exportCableTrayMaterialCSVV1())');
  expect(cableTraySource).toContain("_getCableTrayMaterialOutputRowsV1()");
  expect(cableTraySource).toContain("_makeCableTrayMaterialCSVV1(rows = [])");
});
