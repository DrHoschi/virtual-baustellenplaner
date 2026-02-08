// tests/ui-wiring.spec.js
// Version: v1.2.0-ci-stable (2026-02-08)

import { test, expect } from '@playwright/test';

async function waitForBoot(page) {
  // Absolute URL → CI-sicher
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

  const active = page.locator('#active');

  // Element existiert
  await expect(active).toBeVisible({ timeout: 20_000 });

  // Warten BIS Text sich ändert (nicht nur "not.toHaveText")
  await expect
    .poll(async () => await active.textContent(), {
      timeout: 20_000,
    })
    .not.toMatch(/\(lädt\.\.\.\)/i);

  // Menü sichtbar
  await expect(page.locator('#menu')).toBeVisible({ timeout: 20_000 });
}

async function clickMenu(page, labelRegex) {
  const btn = page.getByRole('button', { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click();
}

test('UI Wiring: Wizard → Projektliste → Projekt-Assets → AssetLab', async ({ page }) => {
  await waitForBoot(page);

  // Wizard
  await clickMenu(page, /Neu \(Wizard\)/i);
  await expect(
    page.getByRole('heading', { level: 3, name: /Projekt\s*–\s*Neu/i })
  ).toBeVisible();

  await page
    .locator('input[placeholder*="Baustelle"]')
    .fill('CI Test Projekt');

  await page
    .getByRole('button', { name: /Projekt anlegen/i })
    .click();

  await page.waitForURL(/project=local/i, { timeout: 20_000 });

  // Projektliste
  await clickMenu(page, /Projektliste/i);
  await expect(page.locator('#view')).toContainText(/P-\d{4}-\d{4}/);

  // Projekt-Assets
  await clickMenu(page, /Projekt-Assets/i);
  await page.getByRole('button', { name: /\+ Dummy-Asset/i }).click();

  await expect(page.locator('#view')).toContainText(/Dummy Asset/i);

  await page
    .getByRole('button', { name: /In AssetLab öffnen/i })
    .first()
    .click();

  await expect(
    page.getByRole('heading', { level: 3, name: /AssetLab/i })
  ).toBeVisible();

  await expect(page.locator('#view')).toContainText(/PA-/);
});
