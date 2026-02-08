// tests/00-boot-smoke.spec.js
// Version: v1.0.0 (2026-02-08)
//
// Ziel: ultraschnell herausfinden, ob Boot/Assets/Imports kaputt sind.
// Liefert bei Fail: console.txt + dom.html + screenshot.png

import { test, expect } from "@playwright/test";

function hookLogs(page) {
  const logs = [];
  page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e?.stack || e?.message || String(e)}`));
  page.on("requestfailed", (r) => logs.push(`[requestfailed] ${r.url()} :: ${r.failure()?.errorText || "unknown"}`));
  return { text: () => logs.join("\n") };
}

test("Boot Smoke: index.html lädt, Menü sichtbar, keine harten JS Fehler", async ({ page }, testInfo) => {
  const log = hookLogs(page);

  try {
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });

    // App-Container + Menü sichtbar = Boot grundsätzlich OK
    await expect(page.locator("#menu")).toBeVisible({ timeout: 30_000 });

    // optional: #active sichtbar (wenn vorhanden)
    const active = page.locator("#active");
    if (await active.count()) {
      await expect(active).toBeVisible({ timeout: 30_000 });
    }
  } catch (err) {
    await testInfo.attach("console.txt", { body: Buffer.from(log.text() || "(no logs)"), contentType: "text/plain" });
    await testInfo.attach("dom.html", { body: Buffer.from((await page.content().catch(() => "")) || ""), contentType: "text/html" });
    await testInfo.attach("screenshot.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    throw err;
  }
});
