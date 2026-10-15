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
    await expect(page.locator('.project-settings')).not.toHaveAttribute('open', '');
    if (viewport.width <= 560) {
      await expect(page.locator('#tree-disclosure')).not.toHaveAttribute('open', '');
      await expect(page.locator('#properties-disclosure')).not.toHaveAttribute('open', '');
    } else {
      await expect(page.locator('#tree-disclosure')).toHaveAttribute('open', '');
      await expect(page.locator('#properties-disclosure')).toHaveAttribute('open', '');
    }
    await expect(page.locator('.workarea-tools')).toHaveCount(1);
    await expect(page.locator('#workarea-action')).toHaveCount(1);
    await expect(page.locator('#active-tool-label')).toHaveCount(0);
    await expect(page.locator('.workarea-tools [data-tool], .workarea-tools [data-mode]')).toHaveCount(0);
    // Active saved workareas must not bypass the selection short card.
    if (viewport.width <= 560) await page.locator('#tree-disclosure > summary').click();
    await page.locator('#add-workarea').click();
    await page.locator('#workarea-action').selectOption('place');
    await expect(page.locator('#camera-list')).toBeHidden();
    await expect(page.locator('#tray-list')).toBeHidden();
    await page.locator('.plan-svg').click({ position: { x: 150, y: 150 } });
    await expect(page.locator('#properties input')).toHaveCount(0);
    const before = await page.locator('.plan-object').getAttribute('transform');
    await page.locator('#workarea-action').selectOption('pan');
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
    await page.getByLabel('Fachgruppe').selectOption('cameras');
    await page.locator('#workarea-action').selectOption('camera');
    await expect(page.locator('.plan-object')).toHaveCount(0);
    await page.locator('.plan-svg').click({ position: { x: 200, y: 220 } });
    await expect(page.locator('.camera-fov')).toHaveCount(1);
    if (viewport.width <= 560) await page.locator('#properties-disclosure > summary').click();
    await page.locator('#open-edit').click();
    await expect(page.locator('.camera-fov')).toHaveCount(1);
    await page.getByLabel('Fachgruppe').selectOption('objects');
    await expect(page.locator('.plan-camera')).toHaveCount(1);
    await expect(page.locator('.plan-object')).toHaveCount(1);
    await expect(page.locator('#workarea-action option')).toHaveCount(3);
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('#save-status')).toHaveText('Gespeichert');
    await page.reload();
    await page.getByRole('button', { name: 'Öffnen' }).click();
    await page.getByLabel('Fachgruppe').selectOption('all');
    await expect(page.locator('.plan-object')).toHaveCount(1);
    await expect(page.locator('.plan-camera')).toHaveCount(1);
    await expect(page.locator('.camera-fov')).toHaveCount(0);
    expect(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('Trassenentwurf schützt Wechsel und Griffe erscheinen nur im Editor', async ({ page }) => {
  await setup(page);
  await page.getByLabel('Fachgruppe').selectOption('trays');
  await page.locator('#workarea-action').selectOption('tray');
  await page.locator('.plan-svg').click({ position: { x: 120, y: 150 } });
  await expect(page.locator('#workarea-action')).toBeDisabled();
  await expect(page.locator('#workarea-group')).toBeDisabled();
  await expect(page.locator('.plan-svg')).toHaveAttribute('data-tool', 'tray');
  await page.locator('#cancel-tool').click();
  await expect(page.locator('.plan-trays polyline')).toHaveCount(0);
  await page.locator('#workarea-action').selectOption('tray');
  await page.locator('.plan-svg').click({ position: { x: 120, y: 150 } });
  await page.locator('.plan-svg').click({ position: { x: 220, y: 220 } });
  await page.locator('#finish-tray').click();
  await expect(page.locator('[data-tray-point]')).toHaveCount(0);
  await page.locator('#open-edit').click();
  await expect(page.locator('[data-tray-point]')).toHaveCount(2);
  await page.locator('#workarea-action').selectOption('pan');
  await expect(page.locator('[data-tray-point]')).toHaveCount(0);
});

test('Paketkennung im Kopf kommt aus den Metadaten des ausgelieferten Builds', async ({ page }) => {
  await page.route('**/build-info.json', route => route.fulfill({ json: { blockId: 'Packet-H', testBuild: 7, shortSha: 'abc1234' } }));
  await page.goto('/planner-v2/index.html');
  await expect(page.locator('#build-id')).toHaveText('NEUAUFBAU · PAKET H · TESTBUILD 7 · abc1234');
});

test('Kabelauswahl bleibt kurz; Zuordnung und Messung sind getrennt', async ({ page }) => {
  await setup(page);
  await page.getByLabel("Fachgruppe").selectOption("cables");
  await page.locator('#workarea-action').selectOption('cable');
  await page.locator('#new-cable').click();
  await page.getByLabel('Kabel-ID').fill('H-001');
  await page.getByLabel('Bezeichnung').fill('Prüfkabel');
  await page.getByLabel('Quelle', { exact: true }).fill('Patchfeld');
  await page.getByLabel('Quell-Port').fill('1');
  await page.getByLabel('Ziel', { exact: true }).fill('Kamera');
  await page.getByLabel('Ziel-Port').fill('LAN');
  await page.getByRole('button', { name: 'Kabel speichern' }).click();
  await expect(page.locator('#measurement-form')).toBeHidden();
  await page.locator('#workarea-action').selectOption('select');
  await page.locator('#cable-list button').click();
  await expect(page.locator('#properties input, #properties select')).toHaveCount(0);
  await page.locator('#open-cable-edit').click();
  await expect(page.locator('#cable-tray')).toBeVisible();
  await expect(page.locator('#measurement-form')).toBeHidden();
  await page.locator('#workarea-action').selectOption('measure');
  await expect(page.locator('#measurement-form')).toBeVisible();
  await expect(page.locator('#cable-tray')).toBeHidden();
});
