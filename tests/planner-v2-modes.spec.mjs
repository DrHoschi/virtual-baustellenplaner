import { test, expect } from '@playwright/test';

async function setup(page) {
  await page.goto('/planner-v2/index.html');
  await page.evaluate(() => new Promise(resolve => { const request = indexedDB.deleteDatabase('baustellenplaner-rebuild-v1'); request.onsuccess = request.onblocked = resolve; }));
  await page.reload();
  await page.getByRole('button', { name: /Projekt anlegen/ }).click();
  await page.getByLabel('Projektname').fill('Modusprüfung');
  await page.getByLabel('Breite (m)').fill('24');
  await page.getByLabel('Länge (m)').fill('12');
  await page.getByRole('button', { name: 'Projekt erstellen' }).click();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1180, height: 820 }]) {
  test(`Werkzeugfilter, Pan über Objekt und Save/Reload ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await setup(page);
    // Active saved workareas must not bypass the selection short card.
    await page.locator('#add-workarea').click();
    await page.locator('[data-tool="place"]').click();
    await expect(page.locator('#camera-list')).toBeHidden();
    await expect(page.locator('#tray-list')).toBeHidden();
    await page.locator('.plan-svg').click({ position: { x: 150, y: 150 } });
    await expect(page.locator('#properties input')).toHaveCount(0);
    const before = await page.locator('.plan-object').getAttribute('transform');
    await page.locator('[data-tool="pan"]').click();
    const svg = page.locator('.plan-svg');
    const viewBefore = await svg.getAttribute('viewBox');
    const box = await page.locator('.plan-object').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 4 });
    await page.mouse.up();
    await expect(svg).not.toHaveAttribute('viewBox', viewBefore);
    await expect(page.locator('.plan-object')).toHaveAttribute('transform', before);
    await expect(page.locator('#properties')).toBeHidden();
    await page.locator('[data-tool="camera"]').click();
    await expect(page.locator('.plan-object')).toHaveCount(0);
    await page.locator('.plan-svg').click({ position: { x: 200, y: 220 } });
    await expect(page.locator('.camera-fov')).toHaveCount(0);
    await page.locator('[data-mode="edit"]').click();
    await expect(page.locator('.camera-fov')).toHaveCount(1);
    await page.getByLabel('Fachgruppe').selectOption('objects');
    await expect(page.locator('.plan-camera')).toHaveCount(0);
    await expect(page.locator('.plan-object')).toHaveCount(1);
    await page.locator('summary').filter({ hasText: 'Zusätzlicher Kontext' }).click();
    await page.locator('[data-context="cameras"]').check();
    await expect(page.locator('.plan-camera')).toHaveCount(1);
    expect(await page.locator('.plan-cameras').evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('#save-status')).toHaveText('Gespeichert');
    await page.reload();
    await page.getByRole('button', { name: 'Öffnen' }).click();
    await expect(page.locator('.plan-object')).toHaveCount(1);
    await expect(page.locator('.plan-camera')).toHaveCount(1);
    await expect(page.locator('.camera-fov')).toHaveCount(0);
    expect(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('Trassenentwurf schützt Wechsel und Griffe erscheinen nur im Editor', async ({ page }) => {
  await setup(page);
  await page.locator('[data-tool="tray"]').click();
  await page.locator('.plan-svg').click({ position: { x: 120, y: 150 } });
  await page.locator('[data-tool="camera"]').click();
  await expect(page.locator('.plan-svg')).toHaveAttribute('data-tool', 'tray');
  await page.locator('#cancel-tool').click();
  await expect(page.locator('.plan-trays polyline')).toHaveCount(0);
  await page.locator('[data-tool="tray"]').click();
  await page.locator('.plan-svg').click({ position: { x: 120, y: 150 } });
  await page.locator('.plan-svg').click({ position: { x: 220, y: 220 } });
  await page.locator('#finish-tray').click();
  await expect(page.locator('[data-tray-point]')).toHaveCount(0);
  await page.locator('[data-mode="edit"]').click();
  await expect(page.locator('[data-tray-point]')).toHaveCount(2);
  await page.locator('[data-tool="pan"]').click();
  await expect(page.locator('[data-tray-point]')).toHaveCount(0);
});
