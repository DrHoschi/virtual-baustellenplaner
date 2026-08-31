import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator('#view .wa-topbar [data-bp-planning-topbar="05e-b"]')).toBeVisible();
}

test("UI-MIG-05E-B groups only existing product controls semantically", async ({ page }) => {
  await bootPlanning(page);
  const topbar = page.locator("#view .wa-topbar");

  await expect(topbar.locator('[data-bp-planning-topbar-section="work-tools"]')).toBeVisible();
  await expect(topbar.locator('[data-bp-planning-topbar-section="navigation"]')).toBeVisible();
  await expect(topbar.locator('[data-bp-planning-topbar-section="view-options"]')).toBeVisible();
  await expect(topbar.locator('[data-bp-planning-topbar-section="workspace-layout"]')).toBeVisible();

  await expect(topbar.locator('button[data-bp-planning-mode="select"]')).toHaveText("Auswahl");
  await expect(topbar.locator('button[data-bp-planning-mode="place"]')).toHaveText("Platzieren");
  await expect(topbar.locator('button[data-bp-planning-mode="edit"]')).toHaveAttribute("data-bp-planning-legacy", "true");
  await expect(topbar.locator('button[data-bp-planning-mode="pan"]')).toHaveText("Pan");

  await expect(topbar.locator('[data-bp-planning-navigation-control="zoom"]')).toBeVisible();
  await expect(topbar.locator('[data-bp-planning-view-options="grid-snap"]')).toContainText("Grid:");
  await expect(topbar.locator('[data-bp-planning-view-options="grid-snap"]')).toContainText("Snap:");
});

test("UI-MIG-05E-B reuses the existing Workarea mode handler", async ({ page }) => {
  await bootPlanning(page);
  const topbar = page.locator("#view .wa-topbar");
  const legacyMode = topbar.locator(".wa-mode-select");

  await topbar.locator('button[data-bp-planning-mode="pan"]').click();
  await expect(legacyMode).toHaveValue("pan");

  await topbar.locator('button[data-bp-planning-mode="select"]').click();
  await expect(legacyMode).toHaveValue("select");

  await topbar.locator('button[data-bp-planning-mode="place"]').click();
  await expect(legacyMode).toHaveValue("place");
});

test("UI-MIG-05E-B moves Workarea diagnostics out of the product topbar", async ({ page }) => {
  await bootPlanning(page);
  const topbar = page.locator("#view .wa-topbar");

  await expect(topbar.locator(".wa-debug-group")).toHaveCount(0);
  const devGroup = page.locator('#devLayer [data-bp-planning-devtools="05e-b"] .wa-debug-group');
  await expect(devGroup).toHaveCount(1);
  await expect(devGroup).toContainText("Dummy Select");
  await expect(devGroup).toContainText("Layout JSON");
  await expect(devGroup).toContainText("CrashLog");
  await expect(devGroup).toContainText("Focus");
});

test("UI-MIG-05E-B does not invent missing master tools", async ({ page }) => {
  await bootPlanning(page);
  const topbar = page.locator('#view .wa-topbar [data-bp-planning-topbar="05e-b"]');

  await expect(topbar.getByRole("button", { name: "Verschieben", exact: true })).toHaveCount(0);
  await expect(topbar.getByRole("button", { name: "Drehen", exact: true })).toHaveCount(0);
  await expect(topbar.getByRole("button", { name: "Messen", exact: true })).toHaveCount(0);
  await expect(topbar.getByRole("button", { name: "Fokus", exact: true })).toHaveCount(0);
  await expect(topbar.getByRole("button", { name: "Achsen", exact: true })).toHaveCount(0);
});

test("UI-MIG-05E-B keeps the mapped Workarea regions intact", async ({ page }) => {
  await bootPlanning(page);
  const shell = page.locator("#view .wa-shell");
  await expect(shell.locator(":scope > .wa-left-dock")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-center > .wa-viewport-host")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-right-dock")).toHaveCount(1);
});
