import { test, expect } from "@playwright/test";

async function openPlanningInsert(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });

  const left = page.locator("#view .wa-left-dock");
  await left.locator('.wa-tabs-btn[data-tab-id="tab.insert"]').click();
  await expect(left).toHaveAttribute("data-bp-planning-left-state", "insert");
  await expect(left.locator('[data-bp-insert-sources="v1"]')).toBeVisible();
  return left;
}

test("UI-MIG-05C exposes the four approved insert sources", async ({ page }) => {
  const left = await openPlanningInsert(page);
  const sources = left.locator('[data-bp-insert-sources="v1"]');

  await expect(sources).toHaveAttribute("aria-label", "Einfügen-Quellen");
  await expect(sources.locator('button[data-bp-insert-source="recent-favorites"]')).toHaveText("Zuletzt / Favoriten");
  await expect(sources.locator('button[data-bp-insert-source="assets"]')).toHaveText("Assets");
  await expect(sources.locator('button[data-bp-insert-source="assemblies"]')).toHaveText("Baugruppen");
  await expect(sources.locator('button[data-bp-insert-source="libraries"]')).toHaveText("Bibliotheken");
  await expect(sources.locator('button[data-bp-insert-source="recent-favorites"]')).toHaveAttribute("aria-pressed", "true");
});

test("UI-MIG-05C reuses existing Assets and Baugruppen panels as insert sources", async ({ page }) => {
  const left = await openPlanningInsert(page);

  await left.locator('button[data-bp-insert-source="assets"]').click();
  await expect(left).toHaveAttribute("data-bp-planning-left-state", "insert");
  await expect(left.locator('[data-bp-insert-sources="v1"]')).toHaveAttribute("data-bp-insert-source", "assets");
  await expect(left.locator('.wa-tabs-btn[data-tab-id="tab.assets"]')).toHaveAttribute("data-bp-planning-legacy-hidden", "true");

  await left.locator('button[data-bp-insert-source="recent-favorites"]').click();
  await expect(left).toHaveAttribute("data-bp-planning-left-state", "insert");
  await expect(left.locator('[data-bp-insert-sources="v1"]')).toHaveAttribute("data-bp-insert-source", "recent-favorites");

  await left.locator('button[data-bp-insert-source="assemblies"]').click();
  await expect(left).toHaveAttribute("data-bp-planning-left-state", "insert");
  await expect(left.locator('[data-bp-insert-sources="v1"]')).toHaveAttribute("data-bp-insert-source", "assemblies");
  await expect(left.locator('.wa-tabs-btn[data-tab-id="tab.assemblylab"]')).toHaveAttribute("data-bp-planning-legacy-hidden", "true");
});

test("UI-MIG-05C keeps Bibliotheken as one project source without duplicating library logic", async ({ page }) => {
  const left = await openPlanningInsert(page);
  const libraries = left.locator('button[data-bp-insert-source="libraries"]');

  await libraries.click();
  await expect(left).toHaveAttribute("data-bp-planning-left-state", "insert");
  await expect(left.locator('[data-bp-insert-sources="v1"]')).toHaveAttribute("data-bp-insert-source", "libraries");
  await expect(left.locator('[data-bp-insert-source-hint="true"]')).toContainText("Projektquelle");
  await expect(page.locator("#active")).toHaveText("tools:workarea");
});

test("UI-MIG-05C leaves the planning viewport and right context untouched", async ({ page }) => {
  await openPlanningInsert(page);

  const shell = page.locator("#view .wa-shell");
  const center = shell.locator(":scope > .wa-center");
  await expect(center.locator(":scope > .wa-viewport-host")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-right-dock")).toHaveCount(1);
});
