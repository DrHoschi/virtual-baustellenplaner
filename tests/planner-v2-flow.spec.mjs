import { test, expect } from "@playwright/test";

for (const viewport of [{ name: "iPad quer / Desktop", width: 1180, height: 820 }, { name: "iPad hochkant / iPhone hochkant", width: 390, height: 844 }]) {
  test(`Paket-A-Kernablauf ist in ${viewport.name} bedienbar`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.evaluate(() => new Promise(resolve => { const r = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); r.onsuccess = r.onblocked = resolve; })); await page.reload();
    await expect(page.getByRole("heading", { name: "Womit möchtest du arbeiten?" })).toBeVisible();
    await page.getByRole("button", { name: /Projekt anlegen/ }).click(); await page.getByLabel("Projektname").fill("Ansichtstest"); await page.getByRole("button", { name: "Projekt erstellen" }).click();
    await expect(page.getByRole("heading", { name: "Ansichtstest" })).toBeVisible();
    await expect(page.locator("#plan-canvas")).toBeVisible(); await expect(page.getByRole("button", { name: "Projektdatei sichern" })).toBeVisible();
    expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth)).toBeTruthy();
  });
}
