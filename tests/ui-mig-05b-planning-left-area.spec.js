import { test, expect } from "@playwright/test";

async function openPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
}

test("UI-MIG-05B exposes only Objektbaum and Einfügen in the normal planning left area", async ({ page }) => {
  await openPlanning(page);

  const left = page.locator("#view .wa-left-dock");
  await expect(left).toHaveAttribute("data-bp-planning-left-area", "object-tree-insert-v1");

  const structure = left.locator('.wa-tabs-btn[data-tab-id="tab.structure"]');
  const insert = left.locator('.wa-tabs-btn[data-tab-id="tab.insert"]');

  await expect(structure).toBeVisible();
  await expect(structure).toHaveText("Objektbaum");
  await expect(insert).toBeVisible();
  await expect(insert).toHaveText("+ Einfügen");

  for (const tabId of ["tab.assemblylab", "tab.assets", "tab.tools"]) {
    const legacy = left.locator(`.wa-tabs-btn[data-tab-id="${tabId}"]`);
    await expect(legacy).toHaveAttribute("data-bp-planning-legacy-hidden", "true");
    await expect(legacy).toBeHidden();
  }
});

test("UI-MIG-05B Einfügen is temporary and can return directly to Objektbaum", async ({ page }) => {
  await openPlanning(page);

  const left = page.locator("#view .wa-left-dock");
  const structure = left.locator('.wa-tabs-btn[data-tab-id="tab.structure"]');
  const insert = left.locator('.wa-tabs-btn[data-tab-id="tab.insert"]');

  await structure.click();
  await expect(left).toHaveAttribute("data-bp-planning-left-state", "object-tree");
  await expect(left).toHaveAttribute("aria-label", "Objektbaum");

  await insert.click();
  await expect(left).toHaveAttribute("data-bp-planning-left-state", "insert");
  await expect(left).toHaveAttribute("aria-label", "Einfügen");

  // Workarea-Logik bleibt zuständig für den eigentlichen Panel-Inhalt.
  await expect(page.locator("#view .wa-left-dock .wa-panel-host")).toBeVisible();

  await structure.click();
  await expect(left).toHaveAttribute("data-bp-planning-left-state", "object-tree");
  await expect(left).toHaveAttribute("aria-label", "Objektbaum");
});

test("UI-MIG-05B does not rebuild planning docks or viewport", async ({ page }) => {
  await openPlanning(page);

  const shell = page.locator("#view .wa-shell");
  const center = shell.locator(":scope > .wa-center");

  await expect(shell.locator(":scope > .wa-left-dock")).toHaveCount(1);
  await expect(center).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-right-dock")).toHaveCount(1);
  await expect(center.locator(":scope > .wa-viewport-host")).toHaveCount(1);
});
