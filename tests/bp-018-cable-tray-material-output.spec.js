import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");
const cableTraySource = fs.readFileSync("ui/workarea/workarea-cable-tray.v1.js", "utf8");

test("BP-018 projects existing tray preparation rows into CSV without new material authority", () => {
  expect(cableTraySource).toContain("_getCableTrayMaterialOutputRowsV1()");
  expect(cableTraySource).toContain("this._getCableTrayMaterialPreparationV1().rows");
  expect(cableTraySource).toContain("this._getCableTrayAccessoryPreparationV1().rows");
  expect(cableTraySource).toContain('category: "Kabelrinne"');
  expect(cableTraySource).toContain('row.kind === "cover" ? "Deckel" : "Trennsteg"');

  expect(cableTraySource).toContain("_makeCableTrayMaterialCSVV1(rows = [])");
  expect(cableTraySource).toContain('"Kategorie"');
  expect(cableTraySource).toContain('"Trassentyp"');
  expect(cableTraySource).toContain('"Breite_mm"');
  expect(cableTraySource).toContain('"Ausfuehrungsklasse"');
  expect(cableTraySource).toContain('"Planlaenge_m"');
  expect(cableTraySource).toContain('"Stangenlaenge_m"');
  expect(cableTraySource).toContain('"Anzahl_Stangen"');
  expect(cableTraySource).toContain('"Einkaufslaenge_m"');
  expect(cableTraySource).toContain('"Verschnitt_m"');

  expect(cableTraySource).toContain("_exportCableTrayMaterialCSVV1()");
  expect(cableTraySource).toContain('this._downloadTextFileV1(fileName, csv, "text/csv;charset=utf-8")');
  expect(cableTraySource).toContain("this._copyToClipboard(csv)");
  expect(baseSource).toContain('this._btn("Material CSV", () => this._exportCableTrayMaterialCSVV1())');

  const outputStart = cableTraySource.indexOf("_getCableTrayMaterialOutputRowsV1()");
  const outputEnd = cableTraySource.indexOf("_getCombinedCableTrayMaterialOutputRowsV1()", outputStart);
  const outputBlock = cableTraySource.slice(outputStart, outputEnd);
  expect(outputBlock).not.toContain("_getCableTrayEvaluation()");
  expect(outputBlock).not.toContain("Math.ceil");
  expect(outputBlock).not.toContain("stickLengthM = 3");
  expect(outputBlock).not.toMatch(/manufacturer|articleNumber|supplier|price|inventory|bom/i);
});
