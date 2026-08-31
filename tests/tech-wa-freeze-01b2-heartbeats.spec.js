import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });

  const diagnostic = await page.evaluate(() => window.__bpWorkareaFreezeDiagnostic01B2 || null);
  expect(diagnostic).toEqual({
    installed: true,
    version: "TECH-WA-FREEZE-01B.2",
    heartbeatMs: 1000,
    maxRuntimeMs: 30000
  });

  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator("#view .wa-viewport-host canvas")).toHaveCount(1);
}

function readDiagnosticBreadcrumbs() {
  try {
    return Object.keys(localStorage)
      .map((key) => String(localStorage.getItem(key) || ""))
      .filter((value) => value.includes("workarea:diag:freeze01b2:"))
      .join("\n");
  } catch {
    return "";
  }
}

test("TECH-WA-FREEZE-01B.2 emits independent RAF and timer heartbeats", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

  await bootPlanning(page);
  await page.waitForTimeout(3_500);

  const state = await page.evaluate(() => {
    const panelClass = window.__BAUSTELLENPLANER_WORKAREA_CLASS__;
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
      classAvailable: !!panelClass,
      hasStart: text.includes("workarea:diag:freeze01b2:monitor-start"),
      hasRaf: text.includes("workarea:diag:freeze01b2:raf-heartbeat"),
      hasTimer: text.includes("workarea:diag:freeze01b2:timer-heartbeat")
    };
  });

  expect(state.hasStart).toBe(true);
  expect(state.hasRaf).toBe(true);
  expect(state.hasTimer).toBe(true);
  expect(pageErrors).toEqual([]);

  const before = await page.locator("#view .wa-viewport-host canvas").boundingBox();
  expect(before?.width || 0).toBeGreaterThan(100);
  expect(before?.height || 0).toBeGreaterThan(100);

  await page.locator("#view .wa-viewport-host canvas").click({ position: { x: 20, y: 20 } });
  await expect(page.locator("#view .wa-viewport-host canvas")).toHaveCount(1);

  const breadcrumbs = await page.evaluate(readDiagnosticBreadcrumbs);
  expect(breadcrumbs).toContain("freeze01b2");
});
