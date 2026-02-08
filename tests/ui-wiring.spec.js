// tests/ui-wiring.spec.js
// Version: v1.2.0-ci-stable
//
// End-to-End UI Wiring Test
// Fokus: reale Benutzerkette, nicht kosmetische Loader-Texte

import { test, expect } from '@playwright/test';

/**
 * Wartet, bis die App wirklich benutzbar ist
 * ❌ KEIN Textvergleich "(lädt...)"
 * ✅ Warten auf funktionale UI-Signale
 */
async function waitForBoot(page) {
  // baseURL kommt aus playwright.config.mjs
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Hauptcontainer sichtbar
  await expect(page.locator('#app, body')).toBeVisible();

  // Menü existiert → App ist interaktiv
  await expect(page.locator('#menu')).toBeVisible({ timeout: 20_000 });
}

async function clickMenu(page, labelRegex) {
  const btn = page.getByRole('button', { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click();
}

test('UI Wiring: Wizard → Projektliste → Projekt-Assets → AssetLab', async ({ page }) => {
  await waitForBoot(page);

  // 1️⃣ Wizard
  await clickMenu(page, /neu.*wizard/i);
  await expect(
    page.getByRole('heading', { name: /projekt.*wizard/i })
  ).toBeVisible();

  const nameInput = page.locator('input[placeholder]');
  await nameInput.fill('CI Test Projekt');

  await page.getByRole('button', { name: /projekt anlegen/i }).click();

  // Projekt geladen → URL enthält project=
  await page.waitForURL(/project=/, { timeout: 15_000 });

  // 2️⃣ Projektliste
  await clickMenu(page, /projektliste/i);
  await expect(page.getByRole('heading', { name: /projektliste/i })).toBeVisible();

  await expect(page.locator('#view')).toContainText(/P-\d{4}-\d{4}/);

  // 3️⃣ Projekt-Assets
  await clickMenu(page, /projekt-assets/i);
  await expect(
    page.getByRole('heading', { name: /projekt-assets/i })
  ).toBeVisible();

  await page.getByRole('button', { name: /dummy/i }).click();
  await expect(page.locator('#view')).toContainText(/dummy/i);

  await page.getByRole('button', { name: /assetlab/i }).click();

  // 4️⃣ AssetLab
  await expect(
    page.getByRole('heading', { name: /assetlab/i })
  ).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('#view')).toContainText(/PA-/);
});
