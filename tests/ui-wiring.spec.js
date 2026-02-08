// tests/ui-wiring.spec.js
// Version: v1.1.0-fileurl-ci-stable (2026-02-08)
//
// ZIEL
// -----------------------------------------------------------------------------
// End-to-End-UI-Wiring-Test für den Baustellenplaner.
// Diese Testkette deckt die häufigsten "UI ist leer / nichts reagiert"
// Fehler ab – selbst wenn KEINE Console-Errors auftreten.
//
// Testet folgende Kette:
//   Wizard → Projektliste → Projekt-Assets → AssetLab
//
// WARUM FILE:// ?
// -----------------------------------------------------------------------------
// In GitHub Actions läuft KEIN Webserver.
// page.goto('/index.html') schlägt dort fehl (invalid URL).
//
// Lösung:
// - Wir laden index.html direkt per file://
// - Funktioniert lokal UND im CI
//
// OPTIONAL:
// - Wenn später ein Server existiert, kann PW_BASE_URL genutzt werden,
//   ohne den Test wieder anzufassen.
// -----------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* -------------------------------------------------------------------------- */
/* Hilfsfunktionen                                                             */
/* -------------------------------------------------------------------------- */

// ESM-kompatibles __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Projekt-Root (tests/..)
const PROJECT_ROOT = path.resolve(__dirname, '..');

// URL-Auflösung:
// 1) Wenn PW_BASE_URL gesetzt ist → nutzen (z. B. http://localhost:3000)
// 2) Sonst fallback auf file://.../index.html
function resolveIndexUrl() {
  if (process.env.PW_BASE_URL) {
    return `${process.env.PW_BASE_URL.replace(/\/$/, '')}/index.html`;
  }
  return `file://${path.join(PROJECT_ROOT, 'index.html')}`;
}

/**
 * Wartet, bis die App vollständig gebootet ist.
 * Das ist absichtlich NICHT nur ein waitForSelector,
 * sondern eine Kombination aus sichtbarem Zustand + Textprüfung.
 */
async function waitForBoot(page) {
  const indexUrl = resolveIndexUrl();

  await page.goto(indexUrl, { waitUntil: 'domcontentloaded' });

  // Aktiver View-Container muss existieren
  const active = page.locator('#active');
  await expect(active).toBeVisible({ timeout: 15000 });

  // Loader-Text darf NICHT mehr sichtbar sein
  await expect(active).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 15000 });

  // Menü muss gerendert sein
  await expect(page.locator('#menu')).toBeVisible({ timeout: 15000 });
}

/**
 * Klickt einen Menü-Button anhand seines sichtbaren Labels
 */
async function clickMenu(page, labelRegex) {
  const btn = page.getByRole('button', { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 15000 });
  await btn.click();
}

/* -------------------------------------------------------------------------- */
/* Testfall                                                                    */
/* -------------------------------------------------------------------------- */

test(
  'UI Wiring: Wizard → Projektliste → Projekt-Assets → AssetLab',
  async ({ page }, testInfo) => {
    try {
      /* -------------------------------------------------------------------- */
      /* Boot                                                                  */
      /* -------------------------------------------------------------------- */
      await waitForBoot(page);

      /* -------------------------------------------------------------------- */
      /* 1) Wizard öffnen & Projekt anlegen                                    */
      /* -------------------------------------------------------------------- */
      await clickMenu(page, /Neu \(Wizard\)/i);

      await expect(
        page.getByRole('heading', {
          level: 3,
          name: /Projekt\s*–\s*Neu \(Wizard\)/i,
        })
      ).toBeVisible({ timeout: 15000 });

      const nameInput = page.locator('input[placeholder*="Baustelle"]');
      await expect(nameInput).toBeVisible();
      await nameInput.fill('CI Test Projekt');

      const createBtn = page.getByRole('button', {
        name: /Projekt anlegen \(localStorage\)/i,
      });
      await expect(createBtn).toBeVisible();
      await createBtn.click();

      // Redirect muss erfolgt sein
      await page.waitForURL(/\bproject=local%3A/i, { timeout: 15000 });

      // Loader nach Projektwechsel erneut prüfen
      const active = page.locator('#active');
      await expect(active).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 15000 });

      /* -------------------------------------------------------------------- */
      /* 2) Projektliste prüfen                                                */
      /* -------------------------------------------------------------------- */
      await clickMenu(page, /Projektliste/i);

      await expect(
        page.getByRole('heading', { level: 3, name: /Projektliste/i })
      ).toBeVisible({ timeout: 15000 });

      // Projekt-ID muss sichtbar sein
      await expect(page.locator('#view')).toContainText(
        /P-\d{4}-\d{4}/,
        { timeout: 10000 }
      );

      /* -------------------------------------------------------------------- */
      /* 3) Projekt-Assets → Dummy → AssetLab                                  */
      /* -------------------------------------------------------------------- */
      await clickMenu(page, /Projekt-Assets/i);

      await expect(
        page.getByRole('heading', { level: 3, name: /Projekt-Assets/i })
      ).toBeVisible({ timeout: 15000 });

      const addDummy = page.getByRole('button', {
        name: /\+ Dummy-Asset/i,
      });
      await expect(addDummy).toBeVisible();
      await addDummy.click();

      await expect(page.locator('#view')).toContainText(/Dummy Asset/i, {
        timeout: 10000,
      });

      const openInAssetLab = page
        .getByRole('button', { name: /In AssetLab öffnen/i })
        .first();
      await expect(openInAssetLab).toBeVisible();
      await openInAssetLab.click();

      /* -------------------------------------------------------------------- */
      /* 4) AssetLab prüfen                                                    */
      /* -------------------------------------------------------------------- */
      await expect(
        page.getByRole('heading', { level: 3, name: /AssetLab 3D/i })
      ).toBeVisible({ timeout: 15000 });

      // Kontext: Projekt-Asset-ID (PA-...)
      await expect(page.locator('#view')).toContainText(/PA-/, {
        timeout: 10000,
      });
    } catch (err) {
      /* -------------------------------------------------------------------- */
      /* Debug-Artefakte bei CI-Fehler                                         */
      /* -------------------------------------------------------------------- */
      await page.screenshot({
        path: testInfo.outputPath('ui-wiring-failure.png'),
        fullPage: true,
      });

      await testInfo.attach('dom.html', {
        body: await page.content(),
        contentType: 'text/html',
      });

      throw err;
    }
  }
);
