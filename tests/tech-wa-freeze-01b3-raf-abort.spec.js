import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });

  const diagnostic = await page.evaluate(() => window.__bpWorkareaFreezeDiagnostic01B3 || null);
  expect(diagnostic).toEqual({
    installed: true,
    version: "TECH-WA-FREEZE-01B.3",
    watchdogMs: 1000,
    stallMs: 1800,
    maxRuntimeMs: 30000
  });

  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator("#view .wa-viewport-host canvas")).toHaveCount(1);
}

function allCrashText() {
  try {
    return Object.keys(localStorage)
      .map((key) => String(localStorage.getItem(key) || ""))
      .join("\n");
  } catch {
    return "";
  }
}

test("TECH-WA-FREEZE-01B.3 observes RAF rescheduling without disturbing normal rendering", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

  await bootPlanning(page);
  await page.waitForTimeout(2_500);

  const result = await page.evaluate(() => {
    const text = (() => {
      try {
        return Object.keys(localStorage)
          .map((key) => String(localStorage.getItem(key) || ""))
          .join("\n");
      } catch {
        return "";
      }
    })();

    return {
      hasWatchdogStart: text.includes("workarea:diag:freeze01b3:watchdog-start"),
      hasScheduleObserved: text.includes("workarea:diag:freeze01b3:next-raf-observed"),
      hasLoopThrow: text.includes("workarea:diag:freeze01b3:loop-throw"),
      hasRenderThrow: text.includes("workarea:diag:freeze01b3:render-throw"),
      hasStall: text.includes("workarea:diag:freeze01b3:raf-stall-detected")
    };
  });

  expect(result.hasWatchdogStart).toBe(true);
  expect(result.hasScheduleObserved).toBe(true);
  expect(result.hasLoopThrow).toBe(false);
  expect(result.hasRenderThrow).toBe(false);
  expect(result.hasStall).toBe(false);
  expect(pageErrors).toEqual([]);

  const canvas = page.locator("#view .wa-viewport-host canvas");
  const box = await canvas.boundingBox();
  expect(box?.width || 0).toBeGreaterThan(100);
  expect(box?.height || 0).toBeGreaterThan(100);

  await canvas.click({ position: { x: 20, y: 20 } });
  await expect(canvas).toHaveCount(1);

  const breadcrumbs = await page.evaluate(allCrashText);
  expect(breadcrumbs).toContain("freeze01b3");
});
