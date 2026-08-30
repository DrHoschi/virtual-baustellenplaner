import { test, expect } from "@playwright/test";

async function waitForShell(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

async function createProject(page) {
  await page.locator("#globalCommandBar").getByRole("button", { name: /^Neu$/i }).click();
  await expect(page.getByRole("heading", { name: /Projekt\s*–\s*Neu \(Wizard\)/i }))
    .toBeVisible({ timeout: 30_000 });

  const nameInput = page.locator('input[placeholder*="Baustelle"]');
  await nameInput.fill("UI-MIG-04B Projekt");
  await page.getByRole("button", { name: /Projekt anlegen \(localStorage\)/i }).click();
  await page.waitForURL(/project=local(%3A|:)/i, { timeout: 30_000 });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  return page.url();
}

test("UI-MIG-04B exposes only implemented project views and keeps settings global", async ({ page }) => {
  await waitForShell(page);

  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toBeVisible();
  await expect(nav).toHaveAttribute("data-workspace-contract", "ui-mig-04b");
  await expect(nav.getByRole("button")).toHaveCount(4);

  for (const label of ["Übersicht", "Projekte", "Assets", "Bibliotheken"]) {
    await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(nav).not.toContainText(/Projektstruktur|Versionen|Einstellungen/i);

  await page.locator('#moduleNav button[data-module-id="module.settings"]').click();
  await expect(page.locator("#active")).toHaveText("settings:workspace");
  await expect(nav).toBeHidden();
  await expect(page.locator("#view")).toContainText(/Grid|Snap|Viewport/i);
});

test("UI-MIG-04B switching project views preserves current project context", async ({ page }) => {
  await waitForShell(page);
  const projectUrl = await createProject(page);
  const projectParam = new URL(projectUrl).searchParams.get("project");
  expect(projectParam).toBeTruthy();

  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toBeVisible();

  for (const item of [
    ["Projekte", "projectPanel:projects"],
    ["Assets", "projectPanel:assets"],
    ["Bibliotheken", "projectPanel:libraries"],
    ["Übersicht", "projectPanel:general"]
  ]) {
    const [label, panelId] = item;
    await nav.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("#active")).toHaveText(panelId);
    expect(new URL(page.url()).searchParams.get("project")).toBe(projectParam);
  }

  // Legacy bleibt nur als Migrations-/Fallback-Schicht erhalten und wird nicht entfernt.
  await expect(page.locator("#legacyMenuWrap #menu")).toBeAttached();
});
