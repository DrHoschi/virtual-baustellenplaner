import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator("#view .wa-viewport-host")).toHaveCount(1);
}

test("UI-MIG-05H.1 hides legacy Workarea panel chrome in Planning", async ({ page }) => {
  await bootPlanning(page);

  const root = page.locator("#view .wa-panel-root");
  await expect(root).toHaveCount(1);
  await expect(root.locator(":scope > .wa-panel-header")).toBeHidden();

  // Die Planning-Werkzeugleiste bleibt sichtbar und besitzt weiterhin die
  // bestehenden Workarea-Controls statt sie zu duplizieren.
  await expect(root.locator(":scope > .wa-topbar [data-bp-planning-topbar='05e-b']")).toBeVisible();
});

test("UI-MIG-05H.1 keeps exactly one real viewport and canvas", async ({ page }) => {
  await bootPlanning(page);

  const viewport = page.locator("#view .wa-viewport-host");
  await expect(viewport).toHaveCount(1);
  await expect(viewport).toBeVisible();
  await expect(viewport.locator("canvas")).toHaveCount(1);
});

test("UI-MIG-05H.1 does not replace Workarea interaction ownership", async ({ page }) => {
  await bootPlanning(page);

  const modeSelect = page.locator("#view .wa-mode-select");
  await expect(modeSelect).toHaveCount(1);

  await page.locator('#view button[data-bp-planning-mode="pan"]').click();
  await expect(modeSelect).toHaveValue("pan");

  await page.locator('#view button[data-bp-planning-mode="select"]').click();
  await expect(modeSelect).toHaveValue("select");
});
