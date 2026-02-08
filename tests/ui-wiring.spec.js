// tests/ui-wiring.spec.js
// Version: v1.4.0-ci-debuggable (2026-02-08)

import { test, expect } from "@playwright/test";

function attachBrowserLogging(page) {
  const logs = [];
  page.on("console", (msg) => logs.push(`[console.${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => logs.push(`[pageerror] ${err?.stack || err?.message || String(err)}`));
  page.on("requestfailed", (req) => logs.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText || "unknown"}`));
  return { getText: () => logs.join("\n") };
}

async function waitForBoot(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });

  // stärkstes Signal: Menü muss erscheinen
  await expect(page.locator("#menu")).toBeVisible({ timeout: 30_000 });

  // wenn #active existiert: nicht ewig "(lädt...)"
  const active = page.locator("#active");
  if (await active.count()) {
    await expect(active).toBeVisible({ timeout: 30_000 });
    await expect(active).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  }
}

async function clickMenu(page, labelRegex) {
  const btn = page.getByRole("button", { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 30_000 });
  await btn.click();
}

test("UI Wiring: Wizard -> Projektliste -> Projekt-Assets -> AssetLab", async ({ page }, testInfo) => {
  const log = attachBrowserLogging(page);

  try {
    await waitForBoot(page);

    // Wizard
    await clickMenu(page, /Neu \(Wizard\)/i);
    await expect(page.getByRole("heading", { name: /Projekt\s*–\s*Neu \(Wizard\)/i })).toBeVisible({ timeout: 30_000 });

    const nameInput = page.locator('input[placeholder*="Baustelle"]');
    await expect(nameInput).toBeVisible({ timeout: 30_000 });
    await nameInput.fill("CI Test Projekt");

    const createBtn = page.getByRole("button", { name: /Projekt anlegen \(localStorage\)/i });
    await expect(createBtn).toBeVisible({ timeout: 30_000 });
    await createBtn.click();

    // Redirect auf Projekt
    await page.waitForURL(/project=local(%3A|:)/i, { timeout: 30_000 });
    await expect(page.locator("#menu")).toBeVisible({ timeout: 30_000 });

    // Projektliste
    await clickMenu(page, /Projektliste/i);
    await expect(page.getByRole("heading", { name: /Projektliste/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#view")).toContainText(/P-\d{4}-\d{4}/, { timeout: 30_000 });

    // Projekt-Assets
    await clickMenu(page, /Projekt-Assets/i);
    await expect(page.getByRole("heading", { name: /Projekt-Assets/i })).toBeVisible({ timeout: 30_000 });

    const addDummy = page.getByRole("button", { name: /\+ Dummy-Asset/i });
    await expect(addDummy).toBeVisible({ timeout: 30_000 });
    await addDummy.click();
    await expect(page.locator("#view")).toContainText(/Dummy Asset/i, { timeout: 30_000 });

    const openInAssetLab = page.getByRole("button", { name: /In AssetLab öffnen/i }).first();
    await expect(openInAssetLab).toBeVisible({ timeout: 30_000 });
    await openInAssetLab.click();

    // AssetLab
    await expect(page.getByRole("heading", { name: /AssetLab 3D/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#view")).toContainText(/PA-/, { timeout: 30_000 });
  } catch (err) {
    // harte Debug-Artefakte
    await testInfo.attach("console.txt", {
      body: Buffer.from(log.getText() || "(no console output)"),
      contentType: "text/plain",
    });

    await testInfo.attach("dom.html", {
      body: Buffer.from((await page.content().catch(() => "")) || "(no html)"),
      contentType: "text/html",
    });

    await testInfo.attach("screenshot.png", {
      body: await page.screenshot({ fullPage: true }).catch(() => Buffer.from("")),
      contentType: "image/png",
    });

    throw err;
  }
});
