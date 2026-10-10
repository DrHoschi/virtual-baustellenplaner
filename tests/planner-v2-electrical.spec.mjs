import { test, expect } from "@playwright/test";

async function newProject(page) {
  await page.goto("/planner-v2/index.html");
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Elektroprüfung");
  await page.getByLabel("Arbeitsbereich").selectOption("hall-section");
  await page.getByLabel("Breite (m)").fill("24");
  await page.getByLabel("Länge (m)").fill("12");
  await page.getByRole("button", { name: "Projekt erstellen" }).click();
}

async function drawTray(page) {
  await page.getByRole("button", { name: "＋ Trasse zeichnen" }).click();
  await page.locator(".plan-svg").click({ position: { x: 180, y: 180 } });
  await page.locator(".plan-svg").click({ position: { x: 500, y: 220 } });
  await page.getByRole("button", { name: "Trasse abschließen" }).click();
}

test("Paket C zeichnet maßstäbliche Trasse und hält sie nach Save/Reload sichtbar", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await newProject(page);
  await drawTray(page);
  await expect(page.locator("#tray-list").getByRole("button", { name: /Trasse 1/ })).toBeVisible();
  await expect(page.locator(".plan-trays polyline")).toHaveCount(1);
  await expect(page.getByText(/Geplante Länge:/)).toBeVisible();
  await page.getByRole("button", { name: /Rückgängig/ }).click();
  await expect(page.locator(".plan-trays polyline")).toHaveCount(0);
  await page.getByRole("button", { name: /Wiederholen/ }).click();
  await expect(page.locator(".plan-trays polyline")).toHaveCount(1);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#save-status")).toHaveText("Gespeichert");
  await page.reload();
  await page.getByRole("button", { name: "Öffnen" }).click();
  await expect(page.locator("#tray-list").getByRole("button", { name: /Trasse 1/ })).toBeVisible();
  await expect(page.locator(".plan-trays polyline")).toHaveCount(1);
});

test("Paket C speichert Kabelzuordnung und getrennte reale Messungen", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await newProject(page);
  await drawTray(page);
  await page.getByRole("button", { name: "＋ Kabel anlegen" }).click();
  await page.getByLabel("Kabel-ID").fill("NET-001");
  await page.getByLabel("Bezeichnung").fill("Netzwerkkabel Kamera");
  await page.getByLabel("Quelle").fill("Patchfeld");
  await page.getByLabel("Quell-Port").fill("P01");
  await page.getByLabel("Ziel", { exact: true }).fill("Kamera 7");
  await page.getByLabel("Ziel-Port").fill("LAN");
  await page.locator('#properties select[name="trayId"]').selectOption({ label: "Trasse 1" });
  await page.getByRole("button", { name: "Kabel speichern" }).click();
  await expect(page.getByText(/Geplante Trassenlänge:/)).toBeVisible();
  await page.getByLabel("Messgerät").fill("Netzwerktester");
  await page.getByLabel("Gemessene Länge · m").fill("31.4");
  await page.getByLabel("Ergebnis").fill("PASS");
  await page.getByLabel("Notiz").fill("Kabel geprüft");
  await page.getByRole("button", { name: "Messung speichern" }).click();
  await expect(page.getByText(/Netzwerktester · 31.4 m · PASS/)).toBeVisible();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#save-status")).toHaveText("Gespeichert");
  await page.reload();
  await page.getByRole("button", { name: "Öffnen" }).click();
  await page.getByRole("button", { name: /NET-001/ }).click();
  await expect(page.getByText(/Netzwerktester · 31.4 m · PASS/)).toBeVisible();
  await page.getByRole("button", { name: "‹ Projekte" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Datei sichern" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  await page.locator("#project-import").setInputFiles({ name: download.suggestedFilename(), mimeType: "application/vnd.baustellenplaner.project", buffer: Buffer.concat(chunks) });
  await expect(page.getByRole("heading", { name: "Elektroprüfung (Import)" })).toBeVisible();
  await page.locator("article.project-card").filter({ has: page.getByRole("heading", { name: "Elektroprüfung (Import)" }) }).getByRole("button", { name: "Öffnen" }).click();
  await page.getByRole("button", { name: /NET-001/ }).click();
  await expect(page.getByText(/Netzwerktester · 31.4 m · PASS/)).toBeVisible();
});

test("Paket C validator weist ungültige Referenzen und Messungen zurück", async ({ page }) => {
  await page.goto("/planner-v2/index.html");
  const errors = await page.evaluate(async () => {
    const { validateElectricalData } = await import("/planner-v2/src/electrical/electrical-model.v1.js");
    return validateElectricalData({ version: 1, trays: [], cables: [{ id: "NET-1", name: "Kabel", source: { name: "A", port: "1" }, target: { name: "B", port: "2" }, trayIds: ["missing"], status: "measured", measurements: [{ device: "", lengthMm: -1, result: "", measuredAt: "invalid" }] }] }, []);
  });
  expect(errors.some(error => error.includes("Trassenreferenz"))).toBeTruthy();
  expect(errors.some(error => error.includes("Messdatensatz"))).toBeTruthy();
});
