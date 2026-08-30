import { test, expect } from "@playwright/test";

async function waitForShell(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

test("UI-MIG-04A project workspace exposes only real project views", async ({ page }) => {
  await waitForShell(page);

  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toBeVisible();

  const expected = ["Übersicht", "Projekte", "Assets", "Bibliotheken"];
  for (const label of expected) {
    await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole("button")).toHaveCount(4);
  await expect(nav).not.toContainText(/Struktur|Versionen/i);

  await nav.getByRole("button", { name: "Projekte", exact: true }).click();
  await expect(page.locator("#active")).toHaveText("projectPanel:projects");
  await expect(nav.getByRole("button", { name: "Projekte", exact: true })).toHaveAttribute("aria-pressed", "true");

  await nav.getByRole("button", { name: "Assets", exact: true }).click();
  await expect(page.locator("#active")).toHaveText("projectPanel:assets");
  await expect(nav.getByRole("button", { name: "Assets", exact: true })).toHaveAttribute("aria-pressed", "true");

  await nav.getByRole("button", { name: "Bibliotheken", exact: true }).click();
  await expect(page.locator("#active")).toHaveText("projectPanel:libraries");
  await expect(nav.getByRole("button", { name: "Bibliotheken", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Rückfallebene bleibt während der Migration erhalten.
  await expect(page.locator("#legacyMenuWrap #menu")).toBeAttached();
});

test("UI-MIG-04A project navigation is contextual to project module", async ({ page }) => {
  await waitForShell(page);

  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toBeVisible();

  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator('#moduleNav button[data-module-id="module.planning"]')).toHaveAttribute("aria-pressed", "true");
  await expect(nav).toBeHidden();

  await page.locator('#moduleNav button[data-module-id="module.project"]').click();
  await expect(page.locator('#moduleNav button[data-module-id="module.project"]')).toHaveAttribute("aria-pressed", "true");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Übersicht", exact: true })).toHaveAttribute("aria-pressed", "true");
});
