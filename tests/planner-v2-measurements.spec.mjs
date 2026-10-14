import { test, expect } from "@playwright/test";

async function newProject(page) {
  await page.goto("/planner-v2/index.html");
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Messworkflow");
  await page.getByLabel("Arbeitsbereich").selectOption("hall-section");
  await page.getByLabel("Breite (m)").fill("24");
  await page.getByLabel("Länge (m)").fill("12");
  await page.getByRole("button", { name: "Projekt erstellen" }).click();
}

async function createCable(page, id = "NET-F1") {
  await page.locator('[data-mode="cable"]').click();
  await page.getByRole("button", { name: "＋ Kabel anlegen" }).click();
  await page.getByLabel("Kabel-ID").fill(id);
  await page.getByLabel("Bezeichnung").fill("Netzwerkkabel Kamera");
  await page.getByLabel("Quelle").fill("Patchfeld");
  await page.getByLabel("Quell-Port").fill("P01");
  await page.getByLabel("Ziel", { exact: true }).fill("Kamera");
  await page.getByLabel("Ziel-Port").fill("LAN");
  await page.getByRole("button", { name: "Kabel speichern" }).click();
}

async function addMeasurement(page, { device = "Netzwerktester", length = "31.4", result = "pass", note = "Kabel geprüft" } = {}) {
  await page.locator('[data-mode="measure"]').click();
  await page.getByLabel("Messgerät").fill(device);
  await page.getByLabel("Gemessene Länge · m").fill(length);
  await page.getByLabel("Ergebnis").selectOption(result);
  await page.getByLabel("Notiz").fill(note);
  await page.getByRole("button", { name: "Messung speichern" }).click();
}

async function placeCamera(page) {
  await page.getByRole("button", { name: "＋ Kamera setzen" }).click();
  await page.locator(".plan-svg").click({ position: { x: 410, y: 330 } });
  await page.locator('[data-mode="edit"]').click();
}

test("Paket F speichert Messung am Kabel, leitet Status ab und bleibt nach Reload erhalten", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await newProject(page);
  await createCable(page, "NET-F1");
  await expect(page.getByText("Noch keiner Trasse zugeordnet.")).toBeVisible();
  await addMeasurement(page, { result: "pass" });
  await expect(page.getByText(/Wirksamer Kabelstatus: passed/)).toBeVisible();
  await expect(page.locator("#measurement-list").getByText(/Netzwerktester · 31.4 m · PASS \/ bestanden/)).toBeVisible();
  await expect(page.locator("#cable-overview")).toContainText("bestanden 1");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#save-status")).toHaveText("Gespeichert");
  await page.reload();
  await page.getByRole("button", { name: "Öffnen" }).click();
  await page.locator('[data-mode="measure"]').click();
  await page.locator("#cable-list").getByRole("button", { name: /NET-F1/ }).click();
  await expect(page.getByText(/Wirksamer Kabelstatus: passed/)).toBeVisible();
  await expect(page.locator("#measurement-list").getByText(/Netzwerktester · 31.4 m · PASS \/ bestanden/)).toBeVisible();
});

test("Paket F zeigt Messstatus im Kamera-Kontext der verknuepften Kabel-ID", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await newProject(page);
  await createCable(page, "CAM-F1");
  await addMeasurement(page, { result: "fail", note: "Aderfehler" });
  await placeCamera(page);
  await page.locator('#properties input[name="name"]').fill("Kamera Tor");
  await page.getByLabel("Verknüpftes Kabel").selectOption("CAM-F1");
  await expect(page.getByText(/Kabelstatus CAM-F1: failed/)).toBeVisible();
  await expect(page.getByText(/FAIL \/ Fehler/)).toBeVisible();
  await expect(page.locator("#cable-overview")).toContainText("Fehler 1");
});

test("Paket F Modell leitet Messstatus ab und validiert Messdatensatz", async ({ page }) => {
  await page.goto("/planner-v2/index.html");
  const result = await page.evaluate(async () => {
    const { deriveCableStatus, cableStatusSummary, validateElectricalData } = await import("/planner-v2/src/electrical/electrical-model.v1.js");
    const cables = [
      { id: "A", status: "planned", measurements: [] },
      { id: "B", status: "installed", measurements: [{ id: "m1", result: "pass", measuredLengthM: 10, measuredAt: "2026-10-11T09:30:00.000Z", device: "", note: "" }] },
      { id: "C", status: "planned", measurements: [{ id: "m2", result: "fail", measuredLengthM: 0, measuredAt: "2026-10-11T09:31:00.000Z", device: "Tester", note: "Fehler" }] },
    ];
    const errors = validateElectricalData({ version: 1, trays: [], cables: [{ id: "NET-1", name: "Kabel", source: { name: "A", port: "1" }, target: { name: "B", port: "2" }, trayIds: [], status: "passed", measurements: [{ id: "m1", measuredLengthM: -1, result: "bad", measuredAt: "invalid" }] }] }, []);
    return { statusB: deriveCableStatus(cables[1]), statusC: deriveCableStatus(cables[2]), summary: cableStatusSummary(cables), errors };
  });
  expect(result.statusB).toBe("passed");
  expect(result.statusC).toBe("failed");
  expect(result.summary).toEqual({ open: 1, measured: 0, passed: 1, failed: 1 });
  expect(result.errors.some(error => error.includes("gemessene Länge"))).toBeTruthy();
  expect(result.errors.some(error => error.includes("Messergebnis"))).toBeTruthy();
});
