import { test, expect } from "@playwright/test";

const modules = {
  project: '#moduleNav button[data-module-id="module.project"]',
  planning: '#moduleNav button[data-module-id="module.planning"]',
  asset: '#moduleNav button[data-module-id="module.asset-development"]',
  settings: '#moduleNav button[data-module-id="module.settings"]'
};

async function boot(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#view")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

test("IM02 Shell: four real entries, workspace host and legacy/dev isolation", async ({ page }) => {
  await boot(page);
  await expect(page.locator("#moduleNav")).toBeVisible();

  for (const selector of Object.values(modules)) {
    await expect(page.locator(selector)).toBeVisible();
  }

  await expect(page.locator("#legacyMenuWrap")).toBeHidden();
  await expect(page.locator("#devLayer")).toBeHidden();

  await page.locator(modules.planning).click();
  await expect(page.locator(modules.planning)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator("#view")).toContainText(/Arbeitsbereich|Struktur|Einfügen/i, { timeout: 30_000 });

  await page.locator(modules.project).click();
  await expect(page.locator(modules.project)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#active")).toHaveText("projectPanel:general", { timeout: 30_000 });

  await page.locator(modules.settings).click();
  await expect(page.locator(modules.settings)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#active")).toHaveText("settings:workspace", { timeout: 30_000 });

  await page.locator(modules.asset).click();
  await expect(page.locator(modules.asset)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#active")).toHaveText("projectPanel:assetlab3d", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /AssetLab 3D/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /Alt-Menü/i }).click();
  await expect(page.locator("#legacyMenuWrap")).toBeVisible();
  await page.getByRole("button", { name: /Alt-Menü/i }).click();
  await expect(page.locator("#legacyMenuWrap")).toBeHidden();

  await page.locator("#globalCommandBar").getByRole("button", { name: /^Debug$/i }).click();
  await expect(page.locator("#devLayer")).toBeVisible();
  await expect(page.locator("#debugTools")).toBeVisible();
});

test("IM02 Shell: small layout uses module drawer and keeps workspace", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);

  await expect(page.locator("body")).not.toHaveClass(/bp-shell-mobile-modules-open/);
  await page.locator("#globalCommandBar").getByRole("button", { name: /Arbeitsbereiche öffnen/i }).click();
  await expect(page.locator("body")).toHaveClass(/bp-shell-mobile-modules-open/);
  await expect(page.locator(modules.planning)).toBeVisible();

  await page.locator(modules.planning).click();
  await expect(page.locator("body")).not.toHaveClass(/bp-shell-mobile-modules-open/);
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator("#view")).toBeVisible();
});
