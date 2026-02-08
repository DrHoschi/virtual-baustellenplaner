// tests/ui-wiring.spec.js
// Version: v1.0.0 (2026-02-08)
//
// Ziel:
// - Menüs/Tabs klicken
// - Wizard: Projekt anlegen (localStorage) -> Redirect
// - Projektliste: neues Projekt taucht auf
// - Projekt-Assets: Dummy erstellen -> In AssetLab öffnen
// - AssetLab: Kontextanzeige erscheint
//
// Warum so?:
// - Diese Kette bricht euch realistisch am häufigsten, ohne Console-Fehler.

import { test, expect } from '@playwright/test';

async function waitForBoot(page) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

  // Loader muss durch sein (kein "(lädt...)" mehr)
  const active = page.locator('#active');
  await expect(active).toBeVisible();
  await expect(active).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 15000 });

  // Menü muss da sein
  await expect(page.locator('#menu')).toBeVisible();
}

async function clickMenu(page, labelRegex) {
  // menu items sind <button> mit Label in .bp-menu__label
  const btn = page.getByRole('button', { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 15000 });
  await btn.click();
}

test('UI Wiring: Wizard -> Projektliste -> Projekt-Assets -> AssetLab', async ({ page }) => {
  await waitForBoot(page);

  // 1) Wizard öffnen
  await clickMenu(page, /Neu \(Wizard\)/i);
  await expect(page.getByRole('heading', { level: 3, name: /Projekt\s*–\s*Neu \(Wizard\)/i })).toBeVisible();

  // Projektname setzen (FormField nutzt Placeholder)
  const nameInput = page.locator('input[placeholder*="Baustelle"]');
  await expect(nameInput).toBeVisible();
  await nameInput.fill('CI Test Projekt');

  // Projekt anlegen (führt Redirect auf ?project=local:... aus)
  const createBtn = page.getByRole('button', { name: /Projekt anlegen \(localStorage\)/i });
  await expect(createBtn).toBeVisible();
  await createBtn.click();

  // Redirect abwarten
  await page.waitForURL(/\bproject=local%3A/i, { timeout: 15000 });

  // Boot auf dem neuen Projekt wieder durchlaufen lassen
  const active = page.locator('#active');
  await expect(active).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 15000 });

  // 2) Projektliste öffnen und prüfen, dass das Projekt existiert
  await clickMenu(page, /Projektliste/i);
  await expect(page.getByRole('heading', { level: 3, name: /Projektliste/i })).toBeVisible();

  // Projekt-ID steht irgendwo im Panel (P-YYYY-XXXX)
  await expect(page.locator('#view')).toContainText(/P-\d{4}-\d{4}/, { timeout: 10000 });

  // 3) Projekt-Assets öffnen, Dummy anlegen, In AssetLab öffnen
  await clickMenu(page, /Projekt-Assets/i);
  await expect(page.getByRole('heading', { level: 3, name: /Projekt-Assets/i })).toBeVisible();

  const addDummy = page.getByRole('button', { name: /\+ Dummy-Asset/i });
  await expect(addDummy).toBeVisible();
  await addDummy.click();

  // Nach dem Klick muss ein Card mit "Dummy Asset" auftauchen
  await expect(page.locator('#view')).toContainText(/Dummy Asset/i);

  const openInAssetLab = page.getByRole('button', { name: /In AssetLab öffnen/i }).first();
  await expect(openInAssetLab).toBeVisible();
  await openInAssetLab.click();

  // 4) AssetLab Panel sichtbar + Kontextanzeige (Projektasset-ID)
  await expect(page.getByRole('heading', { level: 3, name: /AssetLab 3D/i })).toBeVisible({ timeout: 15000 });

  // Kontext: PA-... sollte in Beschreibung oder im Panel stehen (je nach Version)
  await expect(page.locator('#view')).toContainText(/PA-/, { timeout: 10000 });
});
