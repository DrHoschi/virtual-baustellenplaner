import { test, expect } from "@playwright/test";

async function boot(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

async function openPlanningInsert(page) {
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  const left = page.locator("#view .wa-left-dock");
  await left.locator('.wa-tabs-btn[data-tab-id="tab.insert"]').click();
  await expect(left).toHaveAttribute("data-bp-planning-left-state", "insert");
  await expect(left.locator('[data-bp-insert-flow="v1"]')).toBeVisible();
  return left;
}

async function addDummyAsset(page) {
  await page.locator('#moduleNav button[data-module-id="module.project"]').click();
  await page.locator('#projectWorkspaceNav button[data-project-view="assets"]').click();
  await expect(page.locator("#active")).toHaveText("projectPanel:assets", { timeout: 30_000 });
  const add = page.getByRole("button", { name: "+ Dummy-Asset", exact: true });
  await expect(add).toBeVisible();
  await add.click();
  await expect(page.getByText("Dummy Asset", { exact: true }).first()).toBeVisible();
}

test("UI-MIG-05D shows the unified Quelle → Auswahl → Platzieren flow", async ({ page }) => {
  await boot(page);
  const left = await openPlanningInsert(page);
  const flow = left.locator('[data-bp-insert-flow="v1"]');

  await expect(flow).toHaveAttribute("aria-label", "Einfügen-Ablauf");
  await expect(flow.locator('[data-bp-insert-flow-step="source"]')).toHaveText("1 Quelle");
  await expect(flow.locator('[data-bp-insert-flow-step="selected"]')).toHaveText("2 Auswahl");
  await expect(flow.locator('[data-bp-insert-flow-step="placing"]')).toHaveText("3 Platzieren");
  await expect(flow).toHaveAttribute("data-bp-insert-flow-phase", "source");
});

test("UI-MIG-05D reuses ProjectAsset selection and existing Place mode", async ({ page }) => {
  await boot(page);
  await addDummyAsset(page);
  const left = await openPlanningInsert(page);

  await left.locator('button[data-bp-insert-source="assets"]').click();
  await expect(left.locator('[data-bp-insert-flow="v1"]')).toHaveAttribute("data-bp-insert-flow-source", "assets");

  const select = left.getByRole("button", { name: "Select", exact: true }).first();
  await expect(select).toBeVisible();
  await select.click();

  const flow = left.locator('[data-bp-insert-flow="v1"]');
  await expect(flow).toHaveAttribute("data-bp-insert-flow-phase", "selected");
  await expect(flow.locator('[data-bp-insert-flow-summary="true"]')).toContainText("bereit zum Platzieren");
  await expect(left.locator('[data-bp-legacy-placement-control="asset"]')).toBeHidden();

  const place = flow.locator('button[data-bp-insert-flow-action="place"]');
  await expect(place).toHaveText("Platzieren");
  await place.click();

  await expect(page.locator("#view .wa-mode-select")).toHaveValue("place");
  await expect(left.locator('[data-bp-insert-flow="v1"]')).toHaveAttribute("data-bp-insert-flow-phase", "placing");
  await expect(left.locator('[data-bp-insert-flow-summary="true"]')).toContainText("aktiver Platzierkontext");
});

test("UI-MIG-05D provides a clean return from placement flow to insert sources", async ({ page }) => {
  await boot(page);
  await addDummyAsset(page);
  const left = await openPlanningInsert(page);
  await left.locator('button[data-bp-insert-source="assets"]').click();
  await left.getByRole("button", { name: "Select", exact: true }).first().click();
  await left.locator('button[data-bp-insert-flow-action="place"]').click();

  await left.locator('button[data-bp-insert-flow-action="back-to-sources"]').click();
  await expect(left).toHaveAttribute("data-bp-insert-source", "recent-favorites");
  await expect(left.locator('[data-bp-insert-flow="v1"]')).toHaveAttribute("data-bp-insert-flow-phase", "source");
  await expect(left.locator('button[data-bp-insert-source="recent-favorites"]')).toHaveAttribute("aria-pressed", "true");
});

test("UI-MIG-05D keeps viewport, right context and Workarea structure intact", async ({ page }) => {
  await boot(page);
  await openPlanningInsert(page);
  const shell = page.locator("#view .wa-shell");
  await expect(shell.locator(":scope > .wa-center > .wa-viewport-host")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-right-dock")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-left-dock")).toHaveCount(1);
});
