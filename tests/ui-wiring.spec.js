// tests/ui-wiring.spec.js
// Version: v1.1.1-esm-clean-ci-stable (2026-02-08)
//
// ZIEL
// -----------------------------------------------------------------------------
// End-to-End UI Wiring Test:
// Wizard → Projektliste → Projekt-Assets → AssetLab
//
// Diese Kette deckt realistische UI-Ausfälle ab,
// selbst wenn keine Console-Errors existieren.
//
// WICHTIG:
// - Reines ES Module (kein require!)
// - CI-fähig ohne Dev-Server
// - file://-Fallback für GitHub Actions
// -----------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/* -------------------------------------------------------------------------- */
/* Pfade & URL-Auflösung (ESM-konform)                                         */
/* -------------------------------------------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Projekt-Root = eine Ebene über /tests
const PROJECT_ROOT = path.resolve(__dirname, '..');

function resolveIndexUrl() {
  // Optional: externer Server (z. B. lokal)
  if (process.env.PW_BASE_URL) {
    return `${process.env.PW_BASE_URL.replace(/\/$/, '')}/index.html`;
  }

  // CI / GitHub Pages / file://
  return `file://${path.join(PROJECT_ROOT, 'index.html')}`;
}

/* -------------------------------------------------------------------------- */
/* Helper                                                                      */
/* -------------------------------------------------------------------------- */

async function waitForBoot(page) {
  await page.goto(resolveIndexUrl(), { waitUntil: 'domcontentloaded' });

  const active = page.locator('#active');
  await expect(active).toBeVisible({ timeout: 15000 });
  await expect(active).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 15000 });

  await expect(page.locator('#menu')).toBeVisible({ timeout: 15000 });
}

async function clickMenu(page, labelRegex) {
  const btn = page.getByRole('button', { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 15000 });
  await btn.click();
}

/* -------------------------------------------------------------------------- */
/* Test                                                                        */
/* -------------------------------------------------------------------------- */

test(
  'UI Wiring: Wizard → Projektliste → Projekt-Assets → AssetLab',
  async ({ page }, testInfo) => {
    try {
      /* --------------------------- Boot ----------------------------------- */
      await waitForBoot(page);

      /* --------------------------- Wizard --------------------------------- */
      await clickMenu(page, /Neu \(Wizard\)/i);

      await expect(
        page.getByRole('heading', {
          level: 3,
          name: /Projekt\s*–\s*Neu \(Wizard\)/i,
        })
      ).toBeVisible();

      const nameInput = page.locator('input[placeholder*="Baustelle"]');
      await nameInput.fill('CI Test Projekt');

      await page
        .getByRole('button', { name: /Projekt anlegen \(localStorage\)/i })
        .click();

      await page.waitForURL(/\bproject=local%3A/i, { timeout: 15000 });

      /* --------------------------- Projektliste ---------------------------- */
      await clickMenu(page, /Projektliste/i);

      await expect(
        page.getByRole('heading', { level: 3, name: /Projektliste/i })
      ).toBeVisible();

      await expect(page.locator('#view')).toContainText(/P-\d{4}-\d{4}/);

      /* --------------------------- Projekt-Assets -------------------------- */
      await clickMenu(page, /Projekt-Assets/i);

      await page
        .getByRole('button', { name: /\+ Dummy-Asset/i })
        .click();

      await expect(page.locator('#view')).toContainText(/Dummy Asset/i);

      await page
        .getByRole('button', { name: /In AssetLab öffnen/i })
        .first()
        .click();

      /* --------------------------- AssetLab -------------------------------- */
      await expect(
        page.getByRole('heading', { level: 3, name: /AssetLab 3D/i })
      ).toBeVisible({ timeout: 15000 });

      await expect(page.locator('#view')).toContainText(/PA-/);
    } catch (err) {
      // CI-Debug-Artefakte
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
