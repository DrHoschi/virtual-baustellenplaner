import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");
const cableTraySource = fs.readFileSync("ui/workarea/workarea-cable-tray.v1.js", "utf8");

test.describe("BP-031 cable tray duty requirement contract", () => {
  test("keeps dutyClass route-owned with a standard legacy default", () => {
    expect(baseSource).toContain('dutyClass: "standard"');
    expect(baseSource).toContain('wa-tray-duty-class-select');
    expect(baseSource).toContain('selectedRoute.tray.dutyClass = selectedDutyClassSelect.value === "heavy" ? "heavy" : "standard"');
    expect(baseSource).toContain('this._persistSceneToStore("cable-tray-duty-class")');
    expect(baseSource).toContain('dutyClass: String(o?.tray?.dutyClass || "") === "heavy" ? "heavy" : "standard"');
    expect(baseSource).toContain('aria-label", "Ausführungsklasse"');
  });

  test("projects dutyClass through route evaluation and creation", () => {
    expect(cableTraySource).toContain("_normalizeCableTrayDutyClassV1(value = \"\")");
    expect(cableTraySource).toContain('return String(value || "") === "heavy" ? "heavy" : "standard"');
    expect(cableTraySource).toContain("const dutyClass = this._normalizeCableTrayDutyClassV1(o?.tray?.dutyClass)");
    expect(cableTraySource).toContain("dutyClass,");
    expect(cableTraySource).toContain("const dutyClass = this._normalizeCableTrayDutyClassV1(this._cableTrayDraft?.dutyClass)");
  });

  test("splits tray and accessory material requirements by dutyClass only where articles may differ", () => {
    expect(cableTraySource).toContain("const key = `${widthMm}|${trayType}|${dutyClass}`");
    expect(cableTraySource).toContain("if (!groups.has(key)) groups.set(key, { widthMm, trayType, dutyClass, plannedLengthM: 0 })");
    expect(cableTraySource).toContain("const key = `${kind}|${widthMm}|${trayType}|${dutyClass}`");
    expect(cableTraySource).toContain("if (!groups.has(key)) groups.set(key, { kind, widthMm, trayType, dutyClass, plannedLengthM: 0 })");
    expect(cableTraySource).not.toContain("supportDutyClass");
    expect(cableTraySource).not.toContain("fittingDutyClass");
  });

  test("uses dutyClass in material assignment and article-aware output without new catalog authority", () => {
    expect(cableTraySource).toContain("mappingKey: { sourceKind: \"tray\", trayType: row.trayType, widthMm: row.widthMm, dutyClass: row.dutyClass }");
    expect(cableTraySource).toContain("dutyClass: row.dutyClass");
    expect(cableTraySource).toContain("_cableTrayMappingDutyClassMatchesV1(mapping, row.dutyClass)");
    expect(cableTraySource).toContain('"Ausfuehrungsklasse"');
    expect(cableTraySource).not.toContain("tray.loadCalculation");
    expect(cableTraySource).not.toContain("manufacturerDutyClass");
  });
});
