import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("ui/panels/WorkareaPanel.base.js", "utf8");

test.describe("BP-017 practical cable tray accessory planning contract", () => {
  test("persists explicit route-owned cover and divider inputs", async () => {
    expect(source).toContain("coverRequired: false");
    expect(source).toContain("dividerCount: 0");
    expect(source).toContain("selectedRoute.tray.coverRequired = Boolean(coverCheck.checked)");
    expect(source).toContain("selectedRoute.tray.dividerCount = Math.max(0, Math.floor(Number(dividerInput.value) || 0))");
    expect(source).toContain('this._persistSceneToStore("cable-tray-cover-required")');
    expect(source).toContain('this._persistSceneToStore("cable-tray-divider-count")');
  });

  test("derives accessories only from existing route evaluation and new routes", async () => {
    expect(source).toContain("_getCableTrayAccessoryPreparationV1()");
    expect(source).toContain("const routes = this._getCableTrayEvaluation().routes");
    expect(source).toContain('if (route.routeClass !== "new") continue');
    expect(source).toContain('if (route.coverRequired) addLength("cover", route, routeLengthM)');
    expect(source).toContain('addLength("divider", route, routeLengthM * dividerCount)');
    expect(source).toContain('const key = \`${kind}|${widthMm}|${trayType}\`');
  });

  test("uses BP-016 compatible 3 m purchasing semantics", async () => {
    expect(source).toContain("const stickLengthM = 3");
    expect(source).toContain("Math.ceil(row.plannedLengthM / stickLengthM)");
    expect(source).toContain("const purchaseLengthM = requiredStickCount * stickLengthM");
    expect(source).toContain("const offcutM = purchaseLengthM - row.plannedLengthM");
  });

  test("reuses existing evaluation UI without article or manufacturer authority", async () => {
    expect(source).toContain("Zubehörbedarf (Neu)");
    expect(source).toContain('row.kind === "cover" ? "Deckel" : "Trennsteg"');
    expect(source).not.toContain("tray.coverArticleNo");
    expect(source).not.toContain("tray.dividerArticleNo");
    expect(source).not.toContain("tray.coverManufacturer");
    expect(source).not.toContain("tray.dividerManufacturer");
  });
});
