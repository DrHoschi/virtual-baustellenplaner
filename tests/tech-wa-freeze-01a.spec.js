import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator("#view .wa-viewport-host")).toHaveCount(1);
}

test("TECH-WA-FREEZE-01A Workarea keeps the browser main thread responsive after mount", async ({ page }) => {
  await bootPlanning(page);

  await page.evaluate(() => {
    window.__waFreezeProbe = { ticks: 0, raf: 0, startedAt: performance.now() };
    window.__waFreezeProbe.timer = setInterval(() => { window.__waFreezeProbe.ticks += 1; }, 100);
    const loop = () => {
      if (!window.__waFreezeProbe) return;
      window.__waFreezeProbe.raf += 1;
      window.__waFreezeProbe.rafId = requestAnimationFrame(loop);
    };
    window.__waFreezeProbe.rafId = requestAnimationFrame(loop);
  });

  await page.waitForTimeout(8_000);

  const probe = await page.evaluate(() => ({
    ticks: window.__waFreezeProbe?.ticks || 0,
    raf: window.__waFreezeProbe?.raf || 0,
    elapsed: performance.now() - (window.__waFreezeProbe?.startedAt || performance.now())
  }));

  expect(probe.elapsed).toBeGreaterThan(7_000);
  expect(probe.ticks).toBeGreaterThan(40);
  expect(probe.raf).toBeGreaterThan(100);

  const pan = page.locator('#view .wa-topbar button[data-bp-planning-mode="pan"]');
  await expect(pan).toBeEnabled();
  await pan.click({ timeout: 5_000 });
  await expect(page.locator('#view .wa-bottom-bar [data-bp-planning-status-mode="true"]')).toContainText("Mode: pan");

  await page.evaluate(() => {
    if (window.__waFreezeProbe?.timer) clearInterval(window.__waFreezeProbe.timer);
    if (window.__waFreezeProbe?.rafId) cancelAnimationFrame(window.__waFreezeProbe.rafId);
    delete window.__waFreezeProbe;
  });
});
