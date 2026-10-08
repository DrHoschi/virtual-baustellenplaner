import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator('#view .wa-bottom-bar[data-bp-planning-status-bar="05g"]')).toHaveCount(1);
}

test("UI-MIG-05G keeps a slim product status bar with real status and mode", async ({ page }) => {
  await bootPlanning(page);
  const bottom = page.locator('#view .wa-bottom-bar[data-bp-planning-status-bar="05g"]');

  await expect(bottom.locator('[data-bp-planning-status-message="true"]')).toHaveCount(1);
  await expect(bottom.locator('[data-bp-planning-status-message="true"]')).toHaveAttribute("aria-live", "polite");
  await expect(bottom.locator('[data-bp-planning-status-mode="true"]')).toHaveCount(1);
  await expect(bottom.locator('[data-bp-planning-status-mode="true"]')).toContainText(/Mode:/i);
});

test("UI-MIG-05G moves console and layout diagnostics out of the product status bar", async ({ page }) => {
  await bootPlanning(page);
  const bottom = page.locator('#view .wa-bottom-bar[data-bp-planning-status-bar="05g"]');

  await expect(bottom.getByRole("button", { name: "Console", exact: true })).toHaveCount(0);
  await expect(bottom.getByText(/^Layout\s*:/i)).toHaveCount(0);

  const devHost = page.locator('#devLayer [data-bp-planning-status-devtools="05g"]');
  await expect(devHost.locator('[data-bp-planning-status-debug-control="console"]')).toHaveCount(1);
  await expect(devHost.locator('[data-bp-planning-status-debug-control="layout"]')).toHaveCount(1);
});

test("UI-MIG-05G follows the existing Workarea mode state without owning it", async ({ page }) => {
  await bootPlanning(page);
  const topbar = page.locator("#view .wa-topbar");
  const bottom = page.locator('#view .wa-bottom-bar[data-bp-planning-status-bar="05g"]');

  await topbar.locator('button[data-bp-planning-mode="pan"]').click();
  await expect(bottom.locator('[data-bp-planning-status-mode="true"]')).toContainText("Mode: pan");

  await topbar.locator('button[data-bp-planning-mode="select"]').click();
  await expect(bottom.locator('[data-bp-planning-status-mode="true"]')).toContainText("Mode: select");
});

test("UI-MIG-05G leaves the three-region Planning workspace intact", async ({ page }) => {
  await bootPlanning(page);
  const shell = page.locator("#view .wa-shell");
  await expect(shell.locator(":scope > .wa-left-dock")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-center > .wa-viewport-host")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-right-dock")).toHaveCount(1);
});
