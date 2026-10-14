import { test, expect } from "@playwright/test";

async function newProject(page) {
  await page.goto("/planner-v2/index.html");
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Abnahmehalle");
  await page.getByLabel("Arbeitsbereich").selectOption("hall-section");
  await page.locator(".project-settings > summary").click();
  await page.getByLabel("Breite (m)").fill("24");
  await page.getByLabel("Länge (m)").fill("12");
  await page.getByRole("button", { name: "Projekt erstellen" }).click();
}

async function createCable(page, id, target = "Kamera") {
  await page.getByLabel("Fachgruppe").selectOption("cables");
  await page.locator('#workarea-action').selectOption('cable');
  await page.getByRole("button", { name: "＋ Kabel anlegen" }).click();
  await page.getByLabel("Kabel-ID").fill(id);
  await page.getByLabel("Bezeichnung").fill(`Netzwerkkabel ${id}`);
  await page.getByLabel("Quelle").fill("Patchfeld");
  await page.getByLabel("Quell-Port").fill(id === "CAM-G1" ? "P01" : "P02");
  await page.getByLabel("Ziel", { exact: true }).fill(target);
  await page.getByLabel("Ziel-Port").fill("LAN");
  await page.getByRole("button", { name: "Kabel speichern" }).click();
}

async function addMeasurement(page, { result = "pass", note = "Kabel geprüft" } = {}) {
  await page.locator('#workarea-action').selectOption('measure');
  await page.getByLabel("Messgerät").fill("Netzwerktester");
  await page.getByLabel("Gemessene Länge · m").fill("31.4");
  await page.getByLabel("Ergebnis").selectOption(result);
  await page.getByLabel("Notiz").fill(note);
  await page.getByRole("button", { name: "Messung speichern" }).click();
}

async function placeCamera(page, cableId) {
  await page.getByLabel("Fachgruppe").selectOption("cameras");
  await page.locator('#workarea-action').selectOption('camera');
  await page.locator(".plan-svg").click({ position: { x: 410, y: 330 } });
  await page.locator('#open-edit').click();
  await page.locator('#properties input[name="name"]').fill("Kamera Tor");
  await page.getByLabel("Verknüpftes Kabel").selectOption(cableId);
}

test("Paket G zeigt Abnahmeliste, Filter und exportiert JSON-Nachweis", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await newProject(page);
  await createCable(page, "CAM-G1");
  await addMeasurement(page, { result: "pass", note: "Abnahmebereit" });
  await placeCamera(page, "CAM-G1");
  await createCable(page, "NET-G2", "Dose offen");
  await addMeasurement(page, { result: "fail", note: "Aderfehler" });
  await expect(page.locator("#acceptance-summary")).toContainText("Gesamt 2");
  await expect(page.locator("#acceptance-summary")).toContainText("Bestanden 1");
  await expect(page.locator("#acceptance-summary")).toContainText("Fehler 1");
  await expect(page.locator("#acceptance-list")).toContainText("CAM-G1");
  await expect(page.locator("#acceptance-list")).toContainText("Kamera Tor");
  await page.getByLabel("Nachweisfilter").selectOption("failed");
  await expect(page.locator("#acceptance-list")).toContainText("NET-G2");
  await expect(page.locator("#acceptance-list")).not.toContainText("CAM-G1");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON exportieren" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const report = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(report.schema).toBe("baustellenplaner.acceptance.v1");
  expect(report.project.name).toBe("Abnahmehalle");
  expect(report.summary).toMatchObject({ totalCables: 2, passed: 1, failed: 1 });
  expect(report.items.find(item => item.cableId === "CAM-G1")).toMatchObject({ cameraName: "Kamera Tor", status: "passed" });
  expect(report.items.find(item => item.cableId === "NET-G2")).toMatchObject({ status: "failed" });
  expect(report.warnings.some(warning => warning.includes("NET-G2") && warning.includes("fehlerhaft"))).toBeTruthy();
});

test("Paket G Modell erzeugt Nachweis ohne Projektmutation", async ({ page }) => {
  await page.goto("/planner-v2/index.html");
  const result = await page.evaluate(async () => {
    const { buildAcceptanceReport } = await import("/planner-v2/src/electrical/electrical-model.v1.js");
    const project = {
      id: "project-1",
      name: "Modelltest",
      modules: {
        electrical: {
          version: 1,
          trays: [],
          cables: [
            { id: "A", name: "Kabel A", source: { name: "Patch", port: "1" }, target: { name: "Cam", port: "LAN" }, trayIds: [], status: "planned", measurements: [] },
            { id: "B", name: "Kabel B", source: { name: "Patch", port: "2" }, target: { name: "Cam", port: "LAN" }, trayIds: [], status: "installed", measurements: [{ id: "m1", result: "open", measuredLengthM: 10, measuredAt: "2026-10-11T09:30:00.000Z", device: "Tester", note: "" }] },
          ],
        },
        camera: { version: 1, cameras: [{ id: "camera-1", name: "Kamera 1", cableId: "B" }] },
      },
    };
    const before = JSON.stringify(project);
    const report = buildAcceptanceReport(project, { exportedAt: "2026-10-11T12:00:00.000Z" });
    return { mutated: before !== JSON.stringify(project), report };
  });
  expect(result.mutated).toBe(false);
  expect(result.report.summary).toMatchObject({ totalCables: 2, open: 1, measured: 1 });
  expect(result.report.items.find(item => item.cableId === "B")).toMatchObject({ cameraId: "camera-1", cameraName: "Kamera 1", status: "measured" });
  expect(result.report.warnings.some(warning => warning.includes("A") && warning.includes("keine Messung"))).toBeTruthy();
});
