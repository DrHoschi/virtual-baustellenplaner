import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
}

test("R2F-03 keeps one compact-first Properties host and reuses existing actions", async ({ page }) => {
  await bootPlanning(page);
  const right = page.locator('#view .wa-right-dock[data-bp-planning-context="05f"]');
  const host = right.locator('[data-bp-planning-context-host="05f"]');

  await expect(host).toHaveCount(1);
  await expect(host).toHaveAttribute("data-bp-properties-ux", "r2f-03");
  await expect(host).toHaveAttribute("data-bp-properties-ux-mode", "compact-first");

  const legacyTabs = right.locator('[data-bp-planning-legacy-context-tabs="true"]');
  await expect(legacyTabs).toBeHidden();
  await expect(legacyTabs.locator('.wa-tabs-btn[data-tab-id="tab.properties"]')).toHaveCount(1);

  const actions = host.locator('button[data-bp-properties-ux-action]');
  await expect(actions.first()).toBeVisible();
  await expect(actions.first()).toHaveAttribute("data-bp-planning-context-owner", "legacy-workarea");

  const transform = host.locator('button[data-bp-properties-ux-action="transform"]');
  if (await transform.count()) {
    await expect(transform).toHaveAttribute("data-bp-properties-ux-level", "compact");
  }

  for (const action of ["details", "electrical", "bom", "parameters"]) {
    const button = host.locator(`button[data-bp-properties-ux-action="${action}"]`);
    if (await button.count()) {
      await expect(button).toHaveAttribute("data-bp-properties-ux-level", "details");
    }
  }
});

test("R2F-03 does not replace the Planning workspace or selection surfaces", async ({ page }) => {
  await bootPlanning(page);
  await expect(page.locator("#view .wa-left-dock")).toHaveCount(1);
  await expect(page.locator("#view .wa-viewport-host")).toHaveCount(1);
  await expect(page.locator("#view .wa-right-dock")).toHaveCount(1);
});
