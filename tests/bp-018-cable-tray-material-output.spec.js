import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");

test("BP-018 projects existing tray preparation rows into CSV without new material authority", () => {
  expect(source).toContain("_getCableTrayMaterialOutputRowsV1()");
  expect(source).toContain("this._getCableTrayMaterialPreparationV1().rows");
  expect(source).toContain("this._getCableTrayAccessoryPreparationV1().rows");
  expect(source).toContain('category: "Kabelrinne"');
  expect(source).toContain('row.kind === "cover" ? "Deckel" : "Trennsteg"');

  expect(source).toContain("_makeCableTrayMaterialCSVV1(rows = [])");
  expect(source).toContain('"Kategorie"');
  expect(source).toContain('"Trassentyp"');
  expect(source).toContain('"Breite_mm"');
  expect(source).toContain('"Planlaenge_m"');
  expect(source).toContain('"Stangenlaenge_m"');
  expect(source).toContain('"Anzahl_Stangen"');
  expect(source).toContain('"Einkaufslaenge_m"');
  expect(source).toContain('"Verschnitt_m"');

  expect(source).toContain("_exportCableTrayMaterialCSVV1()");
  expect(source).toContain('this._downloadTextFileV1(fileName, csv, "text/csv;charset=utf-8")');
  expect(source).toContain("this._copyToClipboard(csv)");
  expect(source).toContain('this._btn("Material CSV", () => this._exportCableTrayMaterialCSVV1())');

  const outputStart = source.indexOf("_getCableTrayMaterialOutputRowsV1()");
  const outputEnd = source.indexOf("_showCableTrayEvaluation()", outputStart);
  const outputBlock = source.slice(outputStart, outputEnd);
  expect(outputBlock).not.toContain("_getCableTrayEvaluation()");
  expect(outputBlock).not.toContain("Math.ceil");
  expect(outputBlock).not.toContain("stickLengthM = 3");
  expect(outputBlock).not.toMatch(/manufacturer|articleNumber|supplier|price|inventory|bom/i);
});
