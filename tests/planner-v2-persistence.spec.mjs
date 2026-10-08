import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = resolve; request.onerror = () => reject(request.error); request.onblocked = resolve; }));
  await page.reload();
});

test("Projekt bleibt nach Reload erhalten", async ({ page }) => {
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Kamera Halle 2");
  await page.getByLabel("Arbeitsbereich").selectOption("hall-section");
  await page.getByLabel("Breite (m)").fill("12");
  await page.getByLabel("Länge (m)").fill("8");
  await page.getByRole("button", { name: "Projekt erstellen" }).click();
  await expect(page.getByRole("heading", { name: "Kamera Halle 2" })).toBeVisible();
  await expect(page.locator("#save-status")).toContainText("Gespeichert");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kamera Halle 2" })).toBeVisible();
  await expect(page.getByText("12000 × 8000 mm")).toBeVisible();
});

test("nicht verfügbarer lokaler Speicher wird als Fehler statt als Erfolg angezeigt", async ({ page }) => {
  await page.addInitScript(() => { indexedDB.open = () => { throw new DOMException("blocked", "SecurityError"); }; });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Planer kann nicht gestartet werden" })).toBeVisible();
  await expect(page.locator("#save-status")).toContainText("nicht verfügbar");
});
