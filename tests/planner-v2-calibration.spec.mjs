import { test, expect } from "@playwright/test";

test("Grundriss laden, kalibrieren und Maßstab nach Reload wiederherstellen", async ({ page }) => {
  await page.goto("/planner-v2/");
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Kalibrierung");
  await page.getByRole("button", { name: "Projekt erstellen" }).click();
  const canvas = await page.evaluate(() => new Promise(resolve => { const c = document.createElement("canvas"); c.width = 320; c.height = 200; c.getContext("2d").fillRect(0, 0, 320, 200); c.toBlob(blob => resolve(blob)); }));
  await page.locator("#plan-file").setInputFiles({ name: "halle.png", mimeType: "image/png", buffer: Buffer.from(await canvas.arrayBuffer()) });
  await expect(page.getByText(/320 × 200 px/)).toBeVisible();
  await page.getByLabel("Punkt A · X (px)").fill("10"); await page.getByLabel("Punkt A · Y (px)").fill("20");
  await page.getByLabel("Punkt B · X (px)").fill("110"); await page.getByLabel("Punkt B · Y (px)").fill("20");
  await page.getByLabel("Reale Distanz").fill("5"); await page.getByLabel("Einheit").selectOption("m");
  await page.getByRole("button", { name: "Maßstab speichern" }).click();
  await expect(page.getByText("Kalibriert · 50 mm/px")).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "Öffnen" }).click();
  await expect(page.getByText("Kalibriert · 50 mm/px")).toBeVisible();
});
