import { test, expect } from "@playwright/test";

async function waitForShell(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

test("UI-MIG-05A maps existing Workarea into planning structure without rebuilding it", async ({ page }) => {
  await waitForShell(page);

  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });

  const root = page.locator("#view.wa-panel-root");
  const shell = page.locator("#view .wa-shell");
  const left = page.locator("#view .wa-left-dock");
  const center = page.locator("#view .wa-center");
  const viewport = page.locator("#view .wa-viewport-host");
  const right = page.locator("#view .wa-right-dock");

  await expect(root).toHaveAttribute("data-bp-workspace", "planning");
  await expect(root).toHaveAttribute("data-bp-planning-layout", "mapped-v1");
  await expect(shell).toHaveAttribute("data-bp-planning-layout", "three-region-v1");

  await expect(left).toHaveAttribute("data-bp-planning-region", "structure-content");
  await expect(left).toHaveAttribute("aria-label", /Objektbaum|Einfügen/);
  await expect(center).toHaveAttribute("data-bp-planning-region", "workspace");
  await expect(viewport).toHaveAttribute("data-bp-planning-region", "viewport");
  await expect(right).toHaveAttribute("data-bp-planning-region", "context");
  await expect(right).toHaveAttribute("aria-label", "Kontext und Eigenschaften");

  // 05A darf die bestehende Workarea-Struktur nicht re-parenten.
  await expect(shell.locator(":scope > .wa-left-dock")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-center")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-right-dock")).toHaveCount(1);
  await expect(center.locator(":scope > .wa-viewport-host")).toHaveCount(1);

  await expect(page.locator("body")).toHaveClass(/bp-planning-workspace-active/);
});

test("UI-MIG-05A planning marker is presentation state only", async ({ page }) => {
  await waitForShell(page);

  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("body")).toHaveClass(/bp-planning-workspace-active/);

  await page.locator('#moduleNav button[data-module-id="module.project"]').click();
  await expect(page.locator('#moduleNav button[data-module-id="module.project"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).not.toHaveClass(/bp-planning-workspace-active/);
});
