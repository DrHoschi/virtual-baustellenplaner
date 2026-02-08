// tests/ui-wiring.spec.js
// Version: v1.2.0-ci-stable (2026-02-08)
//
// Zweck:
// End-to-End Test der wichtigsten UI-Verkettung:
// Wizard → Projektliste → Projekt-Assets → AssetLab
//
// Design-Prinzip:
// ❌ keine harten Loader-Text-Abfragen
// ✅ stattdessen: "UI ist benutzbar"
// → CI-sicher & realitätsnah

import { test, expect } from '@playwright/test';

/**
 * Wartet, bis die App benutzbar ist.
 * NICHT: "Loader-Text muss verschwinden"
 * SONDERN: Menü + erste Buttons sind da.
 */
async function waitForBoot(page) {
  // CI braucht absolute URL
  await page.goto('http://localhost:3000/index.html', {
    waitUntil: 'domcontentloaded',
  });

  // Root-UI muss existieren
  await expect(page.locator('#menu')).toBeVisible({ timeout: 20_000 });

  // Mindestens ein Menü-Button muss klickbar sein
  const anyMenuButton = page.getByRole('button').first();
  await expect(anyMenuButton).toBeEnabled({ timeout: 20_000 });
}

/**
 * Klickt ein Menü-Item anhand seines Labels
 */
async function clickMenu(page, labelRegex) {
  const btn = page.getByRole('button', { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await btn.click();
}

test(
  'UI Wiring: Wizard → Projektliste → Projekt-Assets → AssetLab',
  async ({ page }) => {
    await waitForBoot(page);

    // 1) Wizard
    await clickMenu(page, /neu.*wizard/i);
    await expect(
      page.getByRole('heading', { name: /projekt.*wizard/i })
    ).toBeVisible();

    // Projektname
    const nameInput = page.locator('input');
    await nameInput.fill('CI Test Projekt');

    await clickMenu(page, /projekt anlegen/i);

    // Redirect akzeptieren
    await page.waitForURL(/project=/, { timeout: 20_000 });

    // 2) Projektliste
    await clickMenu(page, /projektliste/i);
    await expect(
      page.getByRole('heading', { name: /projektliste/i })
    ).toBeVisible();

    await expect(page.locator('#view')).toContainText(/P-\d{4}-\d{4}/);

    // 3) Projekt-Assets
    await clickMenu(page, /projekt-assets/i);
    await expect(
      page.getByRole('heading', { name: /projekt-assets/i })
    ).toBeVisible();

    const addDummy = page.getByRole('button', { name: /dummy/i });
    await addDummy.click();

    await expect(page.locator('#view')).toContainText(/dummy/i);

    // 4) AssetLab
    const openLab = page.getByRole('button', { name: /assetlab/i }).first();
    await openLab.click();

    await expect(
      page.getByRole('heading', { name: /assetlab/i })
    ).toBeVisible({ timeout: 20_000 });

    await expect(page.locator('#view')).toContainText(/PA-/);
  }
);
