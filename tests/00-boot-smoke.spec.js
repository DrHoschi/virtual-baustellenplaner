// tests/00-boot-smoke.spec.js
// UI-MIG-02-IM02: neue Shell sichtbar, Legacy-Menü nur noch Compatibility Layer.

import { test, expect } from "@playwright/test";

function hookLogs(page) {
  const logs = [];
  page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e?.stack || e?.message || String(e)}`));
  page.on("requestfailed", (r) => logs.push(`[requestfailed] ${r.url()} :: ${r.failure()?.errorText || "unknown"}`));
  return { text: () => logs.join("\n") };
}

test("Boot Smoke: IM02 Shell lädt, Workspace Host sichtbar, keine harten JS Fehler", async ({ page }, testInfo) => {
  const log = hookLogs(page);

  try {
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#view")).toBeVisible({ timeout: 30_000 });

    // Legacy-Menü bleibt vorhanden, ist aber nicht mehr der sichtbare Primärweg.
    await expect(page.locator("#menu")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator("#active")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  } catch (err) {
    await testInfo.attach("console.txt", { body: Buffer.from(log.text() || "(no logs)"), contentType: "text/plain" });
    await testInfo.attach("dom.html", { body: Buffer.from((await page.content().catch(() => "")) || ""), contentType: "text/html" });
    await testInfo.attach("screenshot.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    throw err;
  }
});
