import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });

  const diagnostic = await page.evaluate(() => window.__bpWorkareaFreezeDiagnostic01B1 || null);
  expect(diagnostic).toEqual({ installed: true, version: "TECH-WA-FREEZE-01B.1" });

  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator("#view .wa-viewport-host canvas")).toHaveCount(1);
}

test("TECH-WA-FREEZE-01B.1 installs bounded breadcrumbs without blocking Workarea", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

  await bootPlanning(page);

  await page.evaluate(() => {
    window.__waFreeze01B1Probe = { ticks: 0, raf: 0 };
    window.__waFreeze01B1Probe.timer = setInterval(() => { window.__waFreeze01B1Probe.ticks += 1; }, 100);
    const loop = () => {
      if (!window.__waFreeze01B1Probe) return;
      window.__waFreeze01B1Probe.raf += 1;
      window.__waFreeze01B1Probe.rafId = requestAnimationFrame(loop);
    };
    window.__waFreeze01B1Probe.rafId = requestAnimationFrame(loop);
  });

  await page.waitForTimeout(3_000);

  const probe = await page.evaluate(() => ({
    ticks: window.__waFreeze01B1Probe?.ticks || 0,
    raf: window.__waFreeze01B1Probe?.raf || 0
  }));

  expect(probe.ticks).toBeGreaterThan(15);
  expect(probe.raf).toBeGreaterThan(30);
  expect(pageErrors).toEqual([]);

  const breadcrumbSeen = await page.evaluate(() => {
    try {
      return Object.keys(localStorage).some((key) => {
        const value = String(localStorage.getItem(key) || "");
        return value.includes("workarea:diag:freeze01b1:");
      });
    } catch {
      return false;
    }
  });
  expect(breadcrumbSeen).toBe(true);

  await page.evaluate(() => {
    if (window.__waFreeze01B1Probe?.timer) clearInterval(window.__waFreeze01B1Probe.timer);
    if (window.__waFreeze01B1Probe?.rafId) cancelAnimationFrame(window.__waFreeze01B1Probe.rafId);
    delete window.__waFreeze01B1Probe;
  });
});
