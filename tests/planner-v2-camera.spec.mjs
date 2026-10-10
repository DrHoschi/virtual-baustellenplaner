import { test, expect } from "@playwright/test";

async function newProject(page) {
  await page.goto("/planner-v2/index.html");
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Kamerapruefung");
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

async function createCable(page) {
  await page.getByRole("button", { name: "＋ Kabel anlegen" }).click();
  await page.getByLabel("Kabel-ID").fill("CAM-001");
  await page.getByLabel("Bezeichnung").fill("Netzwerkkabel Kamera 1");
  await page.getByLabel("Quelle").fill("Patchfeld");
  await page.getByLabel("Quell-Port").fill("P01");
  await page.getByLabel("Ziel", { exact: true }).fill("Kamera 1");
  await page.getByLabel("Ziel-Port").fill("LAN");
  await page.locator('#properties select[name="trayId"]').selectOption({ label: "Trasse 1" });
  await page.getByRole("button", { name: "Kabel speichern" }).click();
}

async function placeCamera(page) {
  await page.getByRole("button", { name: "＋ Kamera setzen" }).click();
  await page.locator(".plan-svg").click({ position: { x: 410, y: 330 } });
}

async function changeField(page, selector, value) {
  const field = page.locator(selector);
  await field.fill(value);
  await field.dispatchEvent("change");
}

test("Paket D platziert Kamera, zeigt FOV und erlaubt Bewegen und Drehen", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await newProject(page);
  await placeCamera(page);
  await expect(page.locator(".plan-camera")).toHaveCount(1);
  await expect(page.locator(".camera-fov")).toHaveCount(1);
  await expect(page.locator("#camera-list").getByRole("button", { name: /Kamera 1/ })).toBeVisible();
  await changeField(page, '#properties input[name="name"]', "Kamera Eingang");
  await changeField(page, '#properties input[name="rotationDeg"]', "45");
  await changeField(page, '#properties input[name="rangeM"]', "18");
  await changeField(page, '#properties input[name="fovDeg"]', "90");
  await changeField(page, '#properties input[name="mountingHeightM"]', "3.5");
  await changeField(page, '#properties input[name="mountingLocation"]', "Wand Nord");
  await changeField(page, '#properties input[name="note"]', "Blick auf Torbereich");
  await expect(page.locator(".camera-fov")).toHaveCount(1);
  await expect(page.getByText(/FOV: 18.0 m Reichweite · 90°/)).toBeVisible();
  const before = await page.getByLabel("X · mm").inputValue();
  const camera = page.locator(".plan-camera").first();
  const box = await camera.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40);
  await page.mouse.up();
  await expect(page.getByLabel("X · mm")).not.toHaveValue(before);
});

test("Paket D verknuepft Kamera mit vorhandener Kabel-ID und haelt Save/Reload sowie Import/Export", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await newProject(page);
  await drawTray(page);
  await createCable(page);
  await placeCamera(page);
  await expect(page.getByText("Noch keinem Kabel zugeordnet.")).toBeVisible();
  await page.getByLabel("Name").fill("Kamera Tor 1");
  await page.getByLabel("Verknüpftes Kabel").selectOption("CAM-001");
  await expect(page.getByText("Noch keinem Kabel zugeordnet.")).toBeHidden();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#save-status")).toHaveText("Gespeichert");
  await page.reload();
  await page.getByRole("button", { name: "Öffnen" }).click();
  await page.locator("#camera-list").getByRole("button", { name: /Kamera Tor 1/ }).click();
  await expect(page.getByLabel("Verknüpftes Kabel")).toHaveValue("CAM-001");
  await expect(page.locator(".camera-fov")).toHaveCount(1);
  await page.getByRole("button", { name: "‹ Projekte" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Datei sichern" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  await page.locator("#project-import").setInputFiles({ name: download.suggestedFilename(), mimeType: "application/vnd.baustellenplaner.project", buffer: Buffer.concat(chunks) });
  await expect(page.getByRole("heading", { name: "Kamerapruefung (Import)" })).toBeVisible();
  await page.locator("article.project-card").filter({ has: page.getByRole("heading", { name: "Kamerapruefung (Import)" }) }).getByRole("button", { name: "Öffnen" }).click();
  await page.locator("#camera-list").getByRole("button", { name: /Kamera Tor 1/ }).click();
  await expect(page.getByLabel("Verknüpftes Kabel")).toHaveValue("CAM-001");
  await expect(page.locator(".camera-fov")).toHaveCount(1);
});

test("Paket D validator prueft FOV und Kabelreferenz", async ({ page }) => {
  await page.goto("/planner-v2/index.html");
  const result = await page.evaluate(async () => {
    const { validateCameraData, cameraFovPolygon } = await import("/planner-v2/src/camera/camera-model.v1.js");
    const data = { version: 1, cameras: [{ id: "cam-1", name: "Kamera", type: "color", xMm: 1000, yMm: 1000, zMm: 0, rotationDeg: 0, rangeMm: 5000, fovDeg: 60, mountingHeightMm: 3000, mountingLocation: "", layerId: "layer-1", cableId: "missing", note: "" }] };
    return { errors: validateCameraData(data, { layers: [{ id: "layer-1" }], electrical: { cables: [] } }), polygon: cameraFovPolygon(data.cameras[0]) };
  });
  expect(result.errors.some(error => error.includes("Kabelreferenz"))).toBeTruthy();
  expect(result.polygon).toHaveLength(4);
});
