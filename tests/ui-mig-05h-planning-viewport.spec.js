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

test("UI-MIG-05H keeps the real Workarea viewport and prioritizes it on mobile", async ({ page }) => {
  await bootPlanning(page);

  const center = page.locator('#view .wa-center[data-bp-planning-region="workspace"]');
  const left = page.locator('#view .wa-left-dock[data-bp-planning-region="structure-content"]');
  const viewport = page.locator('#view .wa-viewport-host[data-bp-planning-region="viewport"]');

  await expect(center).toHaveCount(1);
  await expect(left).toHaveCount(1);
  await expect(viewport).toHaveCount(1);
  await expect(viewport).toBeVisible();

  const layout = await page.evaluate(() => {
    const center = document.querySelector('#view .wa-center[data-bp-planning-region="workspace"]');
    const left = document.querySelector('#view .wa-left-dock[data-bp-planning-region="structure-content"]');
    const viewport = document.querySelector('#view .wa-viewport-host[data-bp-planning-region="viewport"]');
    return {
      centerOrder: getComputedStyle(center).order,
      leftOrder: getComputedStyle(left).order,
      viewportHeight: viewport.getBoundingClientRect().height
    };
  });

  expect(Number(layout.centerOrder)).toBeLessThan(Number(layout.leftOrder));
  expect(layout.viewportHeight).toBeGreaterThanOrEqual(280);
});

test("UI-MIG-05H does not duplicate the Workarea canvas or scene host", async ({ page }) => {
  await bootPlanning(page);
  await expect(page.locator('#view .wa-viewport-host')).toHaveCount(1);
  await expect(page.locator('#view .wa-viewport-host canvas')).toHaveCount(1);
});
