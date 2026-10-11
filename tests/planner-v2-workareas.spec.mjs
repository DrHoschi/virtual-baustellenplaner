import { test, expect } from "@playwright/test";

async function newLargeProject(page) {
  await page.goto("/planner-v2/index.html");
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Musterhalle Arbeitsbereiche");
  await page.getByLabel("Arbeitsbereich").selectOption("whole-hall");
  await page.getByLabel("Breite (m)").fill("120");
  await page.getByLabel("Länge (m)").fill("60");
  await page.getByRole("button", { name: "Projekt erstellen" }).click();
}

async function changeProperty(page, selector, value) {
  const field = page.locator(selector);
  await field.fill(value);
  await field.dispatchEvent("change");
}

test("Paket E legt Arbeitsbereich an, fokussiert Praezisionsausschnitt und haelt globale Kamera-Koordinaten nach Reload", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await newLargeProject(page);
  await expect(page.getByText("Fläche 120000 × 60000 mm")).toBeVisible();

  await page.getByRole("button", { name: "＋ Arbeitsbereich" }).click();
  await expect(page.locator("#workarea-list").getByRole("button", { name: /Bereich 1/ })).toBeVisible();
  await changeProperty(page, '#properties input[name="name"]', "Torbereich Nord");
  await changeProperty(page, '#properties input[name="xMm"]', "40000");
  await changeProperty(page, '#properties input[name="yMm"]', "20000");
  await changeProperty(page, '#properties input[name="widthMm"]', "10000");
  await changeProperty(page, '#properties input[name="heightMm"]', "8000");
  await expect(page.locator("#workarea-list").getByRole("button", { name: /Torbereich Nord/ })).toBeVisible();
  await page.getByRole("button", { name: "Ausschnitt fokussieren" }).click();

  await page.getByRole("button", { name: "＋ Kamera setzen" }).click();
  await page.locator(".plan-svg").click({ position: { x: 300, y: 300 } });
  await expect(page.locator(".plan-camera")).toHaveCount(1);
  const cameraX = Number(await page.locator('#properties input[name="xMm"]').inputValue());
  const cameraY = Number(await page.locator('#properties input[name="yMm"]').inputValue());
  expect(cameraX).toBeGreaterThan(40000);
  expect(cameraX).toBeLessThan(50000);
  expect(cameraY).toBeGreaterThan(20000);
  expect(cameraY).toBeLessThan(28000);

  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#save-status")).toHaveText("Gespeichert");
  await page.reload();
  await page.getByRole("button", { name: "Öffnen" }).click();
  await expect(page.locator("#workarea-list").getByRole("button", { name: /Torbereich Nord/ })).toBeVisible();
  await expect(page.locator("#workarea-list").getByRole("button", { name: /Torbereich Nord/ })).toHaveClass(/active/);
  await page.locator("#camera-list").getByRole("button", { name: /Kamera 1/ }).click();
  expect(Number(await page.locator('#properties input[name="xMm"]').inputValue())).toBe(cameraX);
  expect(Number(await page.locator('#properties input[name="yMm"]').inputValue())).toBe(cameraY);
});

test("Paket E validiert optionale Arbeitsbereiche im Projektvertrag", async ({ page }) => {
  await page.goto("/planner-v2/index.html");
  const result = await page.evaluate(async () => {
    const { createProjectDocument } = await import("/planner-v2/src/domain/project-document.v1.js");
    const { validateProjectDocument } = await import("/planner-v2/src/domain/project-validation.v1.js");
    const project = createProjectDocument({ name: "Workspace-Vertrag", areaKind: "whole-hall", widthMm: 120000, heightMm: 60000 });
    project.workspace.workAreas.push({ id: "tor-nord", name: "Tor Nord", xMm: 40000, yMm: 20000, widthMm: 10000, heightMm: 8000, note: "" });
    const valid = validateProjectDocument(project);
    project.workspace.workAreas.push({ id: "tor-nord", name: "", xMm: 0, yMm: 0, widthMm: 0, heightMm: -1, note: "" });
    const invalid = validateProjectDocument(project);
    return { valid, invalid };
  });
  expect(result.valid.valid).toBe(true);
  expect(result.invalid.valid).toBe(false);
  expect(result.invalid.errors.some(error => error.includes("Arbeitsbereich-IDs"))).toBeTruthy();
  expect(result.invalid.errors.some(error => error.includes("Arbeitsbereich benötigt einen Namen"))).toBeTruthy();
  expect(result.invalid.errors.some(error => error.includes("Arbeitsbereichbreite"))).toBeTruthy();
});

test("Paket E-Fix uebernimmt beim Anlegen den aktuell sichtbaren Plan-Ausschnitt", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await newLargeProject(page);

  for (let index = 0; index < 4; index += 1) await page.getByRole("button", { name: "Ansicht vergrößern" }).click();
  await page.getByRole("button", { name: "Ansicht verschieben" }).click();
  const svg = page.locator(".plan-svg");
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + 620, box.y + 360);
  await page.mouse.down();
  await page.mouse.move(box.x + 360, box.y + 260, { steps: 8 });
  await page.mouse.up();

  const expected = await page.locator(".plan-svg").evaluate(node => {
    const [x, y, width, height] = node.getAttribute("viewBox").split(/\s+/).map(Number);
    const yTop = 60000;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const left = clamp(x, 0, 120000);
    const right = clamp(x + width, 0, 120000);
    const bottom = clamp(yTop - (y + height), 0, 60000);
    const top = clamp(yTop - y, 0, 60000);
    return {
      xMm: Math.round(Math.min(left, right)),
      yMm: Math.round(Math.min(bottom, top)),
      widthMm: Math.max(1, Math.round(Math.abs(right - left))),
      heightMm: Math.max(1, Math.round(Math.abs(top - bottom))),
    };
  });

  await page.getByRole("button", { name: "＋ Arbeitsbereich" }).click();
  const actual = {
    xMm: Number(await page.locator('#properties input[name="xMm"]').inputValue()),
    yMm: Number(await page.locator('#properties input[name="yMm"]').inputValue()),
    widthMm: Number(await page.locator('#properties input[name="widthMm"]').inputValue()),
    heightMm: Number(await page.locator('#properties input[name="heightMm"]').inputValue()),
  };
  expect(actual).toEqual(expected);
  expect(actual.widthMm).not.toBe(42000);
  expect(actual.heightMm).not.toBe(21000);

  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("#save-status")).toHaveText("Gespeichert");
  await page.reload();
  await page.getByRole("button", { name: "Öffnen" }).click();
  await page.locator("#workarea-list").getByRole("button", { name: /Bereich 1/ }).click();
  await expect(page.locator('#properties input[name="xMm"]')).toHaveValue(String(actual.xMm));
  await expect(page.locator('#properties input[name="yMm"]')).toHaveValue(String(actual.yMm));
  await expect(page.locator('#properties input[name="widthMm"]')).toHaveValue(String(actual.widthMm));
  await expect(page.locator('#properties input[name="heightMm"]')).toHaveValue(String(actual.heightMm));
});
