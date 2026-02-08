/**
 * tests/ui-wiring.spec.js
 * Version: v1.3.0-ci-debuggable (2026-02-08)
 *
 * Ziel:
 * - Menüs/Tabs klicken
 * - Wizard: Projekt anlegen (localStorage) -> Redirect
 * - Projektliste: neues Projekt taucht auf
 * - Projekt-Assets: Dummy erstellen -> In AssetLab öffnen
 * - AssetLab: Kontextanzeige erscheint
 *
 * Warum dieser Test wichtig ist:
 * - Diese Klick-Kette bricht realistisch am häufigsten, ohne klare Console-Fehler.
 *
 * CI-Debug-Features:
 * - Wir sammeln Browser-Console + PageErrors
 * - Bei Fehler attachen wir:
 *   - console.txt
 *   - dom.html
 *   - screenshot.png
 */

import { test, expect } from "@playwright/test";

/** Kleiner Helfer: Konsolen- & PageError-Logs einsammeln */
function attachBrowserLogging(page) {
  const logs = [];

  page.on("console", (msg) => {
    // type: log/warn/error etc.
    logs.push(`[console.${msg.type()}] ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    logs.push(`[pageerror] ${err?.stack || err?.message || String(err)}`);
  });

  page.on("requestfailed", (req) => {
    logs.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText || "unknown"}`);
  });

  return {
    getText: () => logs.join("\n"),
  };
}

/**
 * Boot-Wait:
 * - Wir gehen auf /index.html (baseURL kommt aus playwright.config.js)
 * - Warten auf #menu (Menü sichtbar)
 * - Warten, dass #active NICHT dauerhaft "(lädt...)" ist
 *
 * Wichtig:
 * - In CI kann "(lädt...)" manchmal länger stehen.
 * - Deshalb machen wir zusätzlich "Menu sichtbar" als harte Bedingung.
 */
async function waitForBoot(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });

  // Menü muss sichtbar werden – das ist unser "App ist da"-Signal.
  await expect(page.locator("#menu")).toBeVisible({ timeout: 30_000 });

  // #active ist oft ein Ladeindikator: darf nicht dauerhaft "(lädt...)" bleiben
  const active = page.locator("#active");
  await expect(active).toBeVisible({ timeout: 30_000 });

  // Nicht-toHaveText ist manchmal heikel, wenn der Text sich nie ändert.
  // Darum: wir warten aktiv, dass es sich *irgendwann* ändert, aber geben mehr Zeit.
  await expect(active).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

async function clickMenu(page, labelRegex) {
  // In deinem UI sind das Buttons mit Text – getByRole ist am stabilsten.
  const btn = page.getByRole("button", { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 30_000 });
  await btn.click();
}

test("UI Wiring: Wizard -> Projektliste -> Projekt-Assets -> AssetLab", async ({ page }, testInfo) => {
  const log = attachBrowserLogging(page);

  try {
    // 0) Boot
    await waitForBoot(page);

    // 1) Wizard öffnen
    await clickMenu(page, /Neu \(Wizard\)/i);

    // Überschrift prüfen (wenn euer Heading-Level abweicht: anpassen)
    await expect(
      page.getByRole("heading", { name: /Projekt\s*–\s*Neu \(Wizard\)/i })
    ).toBeVisible({ timeout: 30_000 });

    // Projektname setzen (Placeholder ist in eurem Wizard ok)
    const nameInput = page.locator('input[placeholder*="Baustelle"]');
    await expect(nameInput).toBeVisible({ timeout: 30_000 });
    await nameInput.fill("CI Test Projekt");

    // Projekt anlegen
    const createBtn = page.getByRole("button", {
      name: /Projekt anlegen \(localStorage\)/i,
    });
    await expect(createBtn).toBeVisible({ timeout: 30_000 });
    await createBtn.click();

    // Redirect: je nach Encoding kann local: als local%3A auftauchen
    await page.waitForURL(/project=local(%3A|:)/i, { timeout: 30_000 });

    // Nach Redirect: Menü wieder da
    await expect(page.locator("#menu")).toBeVisible({ timeout: 30_000 });

    // 2) Projektliste öffnen
    await clickMenu(page, /Projektliste/i);

    await expect(
      page.getByRole("heading", { name: /Projektliste/i })
    ).toBeVisible({ timeout: 30_000 });

    // Projekt-ID sichtbar (P-YYYY-XXXX)
    await expect(page.locator("#view")).toContainText(/P-\d{4}-\d{4}/, {
      timeout: 30_000,
    });

    // 3) Projekt-Assets öffnen
    await clickMenu(page, /Projekt-Assets/i);

    await expect(
      page.getByRole("heading", { name: /Projekt-Assets/i })
    ).toBeVisible({ timeout: 30_000 });

    // Dummy Asset anlegen
    const addDummy = page.getByRole("button", { name: /\+ Dummy-Asset/i });
    await expect(addDummy).toBeVisible({ timeout: 30_000 });
    await addDummy.click();

    await expect(page.locator("#view")).toContainText(/Dummy Asset/i, {
      timeout: 30_000,
    });

    // In AssetLab öffnen
    const openInAssetLab = page.getByRole("button", { name: /In AssetLab öffnen/i }).first();
    await expect(openInAssetLab).toBeVisible({ timeout: 30_000 });
    await openInAssetLab.click();

    // 4) AssetLab Panel sichtbar
    await expect(
      page.getByRole("heading", { name: /AssetLab 3D/i })
    ).toBeVisible({ timeout: 30_000 });

    // Kontext: PA-... irgendwo sichtbar
    await expect(page.locator("#view")).toContainText(/PA-/, {
      timeout: 30_000,
    });
  } catch (err) {
    // ======== HARTE DEBUG-AUSGABE, DAMIT DU ENDLICH SIEHST, WAS LOS IST ========
    const html = await page.content().catch(() => "");
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);

    await testInfo.attach("console.txt", {
      body: Buffer.from(log.getText() || "(no console output)"),
      contentType: "text/plain",
    });

    await testInfo.attach("dom.html", {
      body: Buffer.from(html || "(no html)"),
      contentType: "text/html",
    });

    if (screenshot) {
      await testInfo.attach("screenshot.png", {
        body: screenshot,
        contentType: "image/png",
      });
    }

    throw err;
  }
});
