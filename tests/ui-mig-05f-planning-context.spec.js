import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator('#view .wa-right-dock[data-bp-planning-context="05f"]')).toBeVisible();
}

test("UI-MIG-05F presents one unified Planning context area", async ({ page }) => {
  await bootPlanning(page);
  const right = page.locator('#view .wa-right-dock[data-bp-planning-context="05f"]');

  await expect(right.locator('[data-bp-planning-context-header="05f"]')).toContainText("Kontext");
  await expect(right.locator('[data-bp-planning-context-header="05f"]')).toContainText("Aktives Werkzeug");
  await expect(right.locator('[data-bp-planning-context-host="05f"]')).toHaveCount(1);
});

test("UI-MIG-05F keeps legacy right tabs as hidden compatibility anchors", async ({ page }) => {
  await bootPlanning(page);
  const right = page.locator('#view .wa-right-dock[data-bp-planning-context="05f"]');
  const legacyTabs = right.locator('[data-bp-planning-legacy-context-tabs="true"]');

  await expect(legacyTabs).toHaveCount(1);
  await expect(legacyTabs).toBeHidden();
  await expect(legacyTabs.locator('.wa-tabs-btn[data-tab-id="tab.properties"]')).toHaveCount(1);
  await expect(legacyTabs.locator('.wa-tabs-btn[data-tab-id="tab.params"]')).toHaveCount(1);
  await expect(legacyTabs.locator('.wa-tabs-btn[data-tab-id="tab.bom"]')).toHaveCount(1);
  await expect(legacyTabs.locator('.wa-tabs-btn[data-tab-id="tab.outliner"]')).toHaveCount(1);
});

test("UI-MIG-05F routes visible context actions through existing Workarea controls", async ({ page }) => {
  await bootPlanning(page);
  const right = page.locator('#view .wa-right-dock[data-bp-planning-context="05f"]');
  const host = right.locator('[data-bp-planning-context-host="05f"]');

  const annotated = host.locator('button[data-bp-planning-context-owner="legacy-workarea"]');
  await expect(annotated.first()).toBeVisible();

  const transform = host.locator('button[data-bp-planning-context-action="transform"]');
  if (await transform.count()) {
    await transform.click();
    await expect(page.getByText("Transform / Basisdaten", { exact: false }).first()).toBeVisible();
  }
});

test("UI-MIG-05F preserves viewport and topbar migration structure", async ({ page }) => {
  await bootPlanning(page);
  await expect(page.locator('#view .wa-topbar [data-bp-planning-topbar="05e-b"]')).toBeVisible();
  await expect(page.locator("#view .wa-viewport-host")).toHaveCount(1);
  await expect(page.locator("#view .wa-left-dock")).toHaveCount(1);
  await expect(page.locator("#view .wa-right-dock")).toHaveCount(1);
});
