import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");
const cableTraySource = fs.readFileSync("ui/workarea/workarea-cable-tray.v1.js", "utf8");

test.describe("BP-017 practical cable tray accessory planning contract", () => {
  test("persists explicit route-owned cover and divider inputs", async () => {
    expect(cableTraySource).toContain("coverRequired: false");
    expect(cableTraySource).toContain("dividerCount: 0");
    expect(baseSource).toContain("selectedRoute.tray.coverRequired = Boolean(coverCheck.checked)");
    expect(baseSource).toContain("selectedRoute.tray.dividerCount = Math.max(0, Math.floor(Number(dividerInput.value) || 0))");
    expect(baseSource).toContain('this._persistSceneToStore("cable-tray-cover-required")');
    expect(baseSource).toContain('this._persistSceneToStore("cable-tray-divider-count")');
  });

  test("derives accessories only from existing route evaluation and new routes", async () => {
    expect(cableTraySource).toContain("_getCableTrayAccessoryPreparationV1()");
    expect(cableTraySource).toContain("const routes = this._getCableTrayEvaluation().routes");
    expect(cableTraySource).toContain('if (route.routeClass !== "new") continue');
    expect(cableTraySource).toContain('if (route.coverRequired) addLength("cover", route, routeLengthM)');
    expect(cableTraySource).toContain('addLength("divider", route, routeLengthM * dividerCount)');
    expect(cableTraySource).toContain('const key = \`${kind}|${widthMm}|${trayType}|${dutyClass}\`');
  });

  test("uses BP-016 compatible 3 m purchasing semantics", async () => {
    expect(cableTraySource).toContain("const stickLengthM = 3");
    expect(cableTraySource).toContain("Math.ceil(row.plannedLengthM / stickLengthM)");
    expect(cableTraySource).toContain("const purchaseLengthM = requiredStickCount * stickLengthM");
    expect(cableTraySource).toContain("const offcutM = purchaseLengthM - row.plannedLengthM");
  });

  test("reuses existing evaluation UI without article or manufacturer authority", async () => {
    expect(cableTraySource).toContain("Zubehörbedarf (Neu)");
    expect(cableTraySource).toContain('row.kind === "cover" ? "Deckel" : "Trennsteg"');
    expect(cableTraySource).toContain("row.dutyClass");
    expect(cableTraySource).not.toContain("tray.coverArticleNo");
    expect(cableTraySource).not.toContain("tray.dividerArticleNo");
    expect(cableTraySource).not.toContain("tray.coverManufacturer");
    expect(cableTraySource).not.toContain("tray.dividerManufacturer");
  });
});
