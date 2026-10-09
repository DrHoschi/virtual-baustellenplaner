import { test, expect } from "@playwright/test";

async function tapImagePixel(page, x, y) {
  const point = await page.locator("#calibration-canvas").evaluate((svg, pixel) => {
    const p = svg.createSVGPoint(); p.x = pixel.x; p.y = pixel.y;
    const screen = p.matrixTransform(svg.getScreenCTM());
    return { x: screen.x, y: screen.y };
  }, { x, y });
  await page.mouse.click(point.x, point.y);
}

test("Grundriss laden, kalibrieren und Maßstab nach Reload wiederherstellen", async ({ page }) => {
  await page.goto("/planner-v2/index.html");
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase("baustellenplaner-rebuild-v1"); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole("button", { name: /Projekt anlegen/ }).click();
  await page.getByLabel("Projektname").fill("Kalibrierung");
  await page.getByRole("button", { name: "Projekt erstellen" }).click();
  const pngData = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 320; c.height = 200; c.getContext("2d").fillRect(0, 0, 320, 200); return c.toDataURL("image/png"); });
  await page.locator("#plan-file").setInputFiles({ name: "halle.png", mimeType: "image/png", buffer: Buffer.from(pngData.split(",")[1], "base64") });
  await expect(page.getByText(/320 × 200 px/)).toBeVisible();
  await expect(page.locator("#workarea-root")).toBeHidden();
  await expect(page.getByRole("img", { name: "Grundriss zur Kalibrierung" })).toBeVisible();
  await page.getByRole("button", { name: "Punkt A setzen" }).click();
  await tapImagePixel(page, 10, 20);
  await expect(page.locator('[data-calibration-point="A"]')).toBeVisible();
  await expect(page.getByLabel("Punkt A · X (px)")).toHaveValue("10");
  await page.getByRole("button", { name: "Punkt B setzen" }).click();
  await tapImagePixel(page, 110, 20);
  await expect(page.locator('[data-calibration-point="B"]')).toBeVisible();
  await page.locator("#calibration-slot summary").click();
  await expect(page.locator("#workarea-root")).toBeVisible();
  await page.getByLabel("Reale Distanz").fill("5"); await page.getByLabel("Einheit").selectOption("m");
  await page.getByRole("button", { name: "Maßstab speichern" }).click();
  await expect(page.locator("#calibration-slot details")).not.toHaveAttribute("open", "");
  await expect(page.locator("#calibration-slot summary")).toContainText("50 mm/px");
  await expect(page.locator("#workarea-root")).toBeVisible();
  await page.locator("#calibration-slot summary").click();
  await expect(page.locator("#workarea-root")).toBeHidden();
  await expect(page.locator("#calibration-summary")).toHaveText("Kalibriert · 50 mm/px");
  await expect(page.locator('[data-calibration-point="A"]')).toBeVisible();
  await expect(page.locator('[data-calibration-point="B"]')).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "Öffnen" }).click();
  await expect(page.locator("#calibration-slot details")).not.toHaveAttribute("open", "");
  await expect(page.locator("#calibration-slot summary")).toContainText("50 mm/px");
});
