import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator('#view .wa-shell[data-bp-planning-layout="three-region-v1"]')).toHaveCount(1);
}

async function box(locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value;
}

test("UI-MIG-05H.2 keeps viewport, object tree and context in separate mobile regions", async ({ page }) => {
  await bootPlanning(page);

  const center = page.locator('#view .wa-center[data-bp-planning-region="workspace"]');
  const viewport = page.locator('#view .wa-viewport-host[data-bp-planning-region="viewport"]');
  const left = page.locator('#view .wa-left-dock[data-bp-planning-region="structure-content"]');
  const right = page.locator('#view .wa-right-dock[data-bp-planning-region="context"]');

  await expect(center).toBeVisible();
  await expect(viewport).toBeVisible();
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();

  const centerBox = await box(center);
  const viewportBox = await box(viewport);
  const leftBox = await box(left);
  const rightBox = await box(right);

  expect(viewportBox.y).toBeGreaterThanOrEqual(centerBox.y);
  expect(leftBox.y).toBeGreaterThanOrEqual(centerBox.y + centerBox.height - 1);
  expect(rightBox.y).toBeGreaterThanOrEqual(leftBox.y + leftBox.height - 1);
});

test("UI-MIG-05H.2 keeps exactly one real canvas and no legacy panel header", async ({ page }) => {
  await bootPlanning(page);

  await expect(page.locator('#view .wa-viewport-host[data-bp-planning-region="viewport"] canvas')).toHaveCount(1);
  await expect(page.locator('#view .wa-panel-header')).toBeHidden();

  const viewportBox = await box(page.locator('#view .wa-viewport-host[data-bp-planning-region="viewport"]'));
  expect(viewportBox.width).toBeGreaterThan(300);
  expect(viewportBox.height).toBeGreaterThanOrEqual(280);
});
