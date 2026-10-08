import { test, expect } from "@playwright/test";

test("Paket B platziert, bearbeitet, sichert und lädt Planobjekte mit Ebenen", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/planner-v2/index.html");
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Workarea-Prüfung");
  await page.getByLabel("Arbeitsbereich").selectOption("hall-section");
  await page.getByLabel("Breite (m)").fill("24");
  await page.getByLabel("Länge (m)").fill("12");
  await page.getByRole("button", { name: "Projekt erstellen" }).click();

  await expect(page.getByRole("img", { name: "Maßstäbliche 2D-Baustellenfläche" })).toBeVisible();
  await expect(page.getByText("Fläche 24000 × 12000 mm")).toBeVisible();
  await page.getByRole("button", { name: "Ansicht verschieben" }).click();
  await expect(page.getByRole("button", { name: "Ansicht verschieben" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Aktives Werkzeug: Ansicht verschieben")).toBeVisible();
  await page.getByRole("button", { name: "Auswählen" }).click();
  await page.getByRole("button", { name: /Objekt platzieren/ }).click();
  await page.locator(".plan-svg").click({ position: { x: 500, y: 350 } });
  await expect(page.locator("#object-list").getByRole("button", { name: "Objekt 1" })).toBeVisible();
  await page.locator("#object-list").getByRole("button", { name: "Objekt 1" }).click();
  await page.locator("#properties input[name=name]").fill("Kamera-Markierung");
  await page.locator("#properties input[name=name]").press("Tab");
  await expect(page.locator("#object-list").getByRole("button", { name: "Kamera-Markierung" })).toBeVisible();

  await page.getByRole("button", { name: "＋ Ebene" }).click();
  await expect(page.getByRole("button", { name: "Ebene 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Rückgängig/ }).click();
  await expect(page.getByRole("button", { name: "Ebene 2", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Wiederholen/ }).click();
  await expect(page.getByRole("button", { name: "Ebene 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ebene 2", exact: true }).click();
  await page.getByRole("button", { name: /Objekt platzieren/ }).click();
  await page.locator(".plan-svg").click({ position: { x: 400, y: 350 } });
  await expect(page.locator("#object-list").getByRole("button", { name: "Objekt 2" })).toBeVisible();
  await page.locator("#object-list").getByRole("button", { name: "Objekt 2" }).click();
  await page.locator("#properties input[name=name]").fill("Objekt Ebene 2");
  await page.locator("#properties input[name=name]").press("Tab");
  await expect(page.locator("#object-list").getByRole("button", { name: "Objekt Ebene 2" })).toBeVisible();
  await page.getByRole("button", { name: "Boden" }).click();
  await expect(page.locator(".plan-object")).toHaveCount(2);

  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#save-status")).toHaveText("Gespeichert");
  await page.reload();
  await page.getByRole("button", { name: "Öffnen" }).click();
  await expect(page.locator("#object-list").getByRole("button", { name: "Kamera-Markierung" })).toBeVisible();
  await expect(page.locator("#object-list").getByRole("button", { name: "Objekt Ebene 2" })).toBeVisible();
  await expect(page.locator(".plan-object")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Ebene 2", exact: true })).toBeVisible();
  expect(await page.locator("body").evaluate(element => element.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("Paket B Workarea passt in das Hochkantlayout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/planner-v2/index.html");
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Hochkant-Prüfung");
  await page.getByLabel("Breite (m)").fill("10");
  await page.getByLabel("Länge (m)").fill("6");
  await page.getByRole("button", { name: "Projekt erstellen" }).click();
  await expect(page.locator(".plan-svg")).toBeVisible();
  await page.getByRole("button", { name: "Ansicht verschieben" }).click();
  await expect(page.getByRole("button", { name: "Ansicht verschieben" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Aktives Werkzeug: Ansicht verschieben")).toBeVisible();
  await page.getByRole("button", { name: "Auswählen" }).click();
  await page.getByRole("button", { name: /Objekt platzieren/ }).click();
  await page.locator(".plan-svg").click({ position: { x: 190, y: 180 } });
  await expect(page.locator("#object-list").getByRole("button", { name: "Objekt 1" })).toBeVisible();
  expect(await page.locator("body").evaluate(element => element.scrollWidth <= window.innerWidth)).toBeTruthy();
});
