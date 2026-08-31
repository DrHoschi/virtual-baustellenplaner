import { test, expect } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1"
});

function crashText() {
  try {
    return Object.keys(localStorage).map((key) => String(localStorage.getItem(key) || "")).join("\n");
  } catch { return ""; }
}

test("TECH-WA-FREEZE-01C suppresses pure browser-height viewer rebuilds during probe window", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });

  const diagnostic = await page.evaluate(() => window.__bpWorkareaFreezeDiagnostic01C || null);
  expect(diagnostic).toEqual({ installed: true, version: "TECH-WA-FREEZE-01C", probeMs: 30000, widthTolerancePx: 2 });

  // Navigation presentation is not under test here. Use the real button/handler without
  // requiring the still-paused small-screen nav to be physically inside the viewport.
  await page.locator('#moduleNav button[data-module-id="module.planning"]').evaluate((button) => button.click());
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });

  const canvas = page.locator("#view .wa-viewport-host canvas");
  const host = page.locator("#view .wa-viewport-host");
  await expect(canvas).toHaveCount(1);
  await page.waitForTimeout(800);

  const before = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));
  const hostBefore = await host.evaluate((el) => ({ w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));

  // Real browser viewport-height change, constant width: the condition we want to isolate
  // from Safari URL/bottom-bar show/hide behavior.
  await page.setViewportSize({ width: 390, height: 704 });
  await page.waitForTimeout(1_500);

  const after = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));
  const hostAfter = await host.evaluate((el) => ({ w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));
  const text = await page.evaluate(crashText);

  expect(text).toContain("workarea:diag:freeze01c:probe-start");
  expect(hostAfter.w).toBe(hostBefore.w);
  expect(hostAfter.h).not.toBe(hostBefore.h);
  expect(text).toContain("workarea:diag:freeze01c:height-resize-suppressed");
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  expect(pageErrors).toEqual([]);
});
