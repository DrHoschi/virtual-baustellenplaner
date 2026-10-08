import { test, expect } from "@playwright/test";

test("Projektdatei exportieren und als separates Projekt importieren", async ({ page }) => {
  await page.goto("/planner-v2/index.html");
  await page.evaluate(() => new Promise(resolve => { const r = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); r.onsuccess = r.onblocked = resolve; })); await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click(); await page.getByLabel("Projektname").fill("Transporttest"); await page.getByRole("button", { name: "Projekt erstellen" }).click();
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "‹ Projekte" }).click(); await page.getByRole("button", { name: "Datei sichern" }).click();
  const download = await downloadPromise; const file = await download.createReadStream(); const chunks = []; for await (const chunk of file) chunks.push(chunk); const buffer = Buffer.concat(chunks);
  await page.locator("#project-import").setInputFiles({ name: download.suggestedFilename(), mimeType: "application/vnd.baustellenplaner.project", buffer });
  await expect(page.getByRole("heading", { name: "Transporttest (Import)" })).toBeVisible();
  await expect(page.locator("#save-status")).toContainText("Projekt importiert");
});

test("beschädigte Datei wird abgelehnt und lässt vorhandenes Projekt erhalten", async ({ page }) => {
  await page.goto("/planner-v2/index.html"); await page.evaluate(() => new Promise(resolve => { const r = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); r.onsuccess = r.onblocked = resolve; })); await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click(); await page.getByLabel("Projektname").fill("Bleibt erhalten"); await page.getByRole("button", { name: "Projekt erstellen" }).click(); await page.getByRole("button", { name: "‹ Projekte" }).click();
  await page.locator("#project-import").setInputFiles({ name: "kaputt.bp-project", mimeType: "application/octet-stream", buffer: Buffer.from("not a zip") });
  await expect(page.locator("#save-status")).toContainText("nicht gespeichert"); await expect(page.getByRole("heading", { name: "Bleibt erhalten" })).toBeVisible();
});
