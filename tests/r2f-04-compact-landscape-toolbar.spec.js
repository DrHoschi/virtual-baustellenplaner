import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
}

test("R2F-04 keeps compact landscape toolbar single-row, symbol-first and inside the viewport", async ({ page }) => {
  await bootPlanning(page);

  const topbar = page.locator("#view .wa-center > .wa-topbar");
  const semantic = topbar.locator('[data-bp-planning-topbar="05e-b"]');

  await expect(topbar).toBeVisible();
  await expect(semantic).toHaveCount(1);
  await expect(topbar.locator('[data-bp-planning-legacy-mode-control="true"]')).toBeHidden();

  for (const mode of ["select", "place", "edit", "pan"]) {
    const button = semantic.locator(`button[data-bp-planning-mode="${mode}"]`);
    await expect(button).toBeVisible();
    expect(await button.evaluate((el) => getComputedStyle(el).fontSize)).toBe("0px");
  }

  await expect(semantic.locator(".wa-zoom-slider")).toBeHidden();
  await expect(semantic.locator(".wa-zoom-value")).toBeHidden();

  const fit = await topbar.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    height: el.getBoundingClientRect().height
  }));
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth);
  expect(fit.height).toBeLessThanOrEqual(40);
});
