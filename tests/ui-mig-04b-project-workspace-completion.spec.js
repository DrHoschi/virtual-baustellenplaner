import { test, expect } from "@playwright/test";

async function waitForShell(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

async function createProject(page) {
  await page.locator("#globalCommandBar").getByRole("button", { name: /^Neu$/i }).click();
  await expect(page.getByRole("heading", { name: /Projekt\s*–\s*Neu/i }))
    .toBeVisible({ timeout: 30_000 });

  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toBeHidden();
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_NONE");

  // UI-REC-01B capability guard: 3D Halle stays available as a global module entry.
  await expect(page.locator('#moduleNav button[data-module-id="module.hall3d"]')).toBeVisible();

  const nameInput = page.locator('input[placeholder*="Baustelle"]');
  await nameInput.fill("PROJECT-UI-02A Projekt");
  await page.getByRole("button", { name: /^Projekt anlegen$/i }).click();
  await page.waitForURL(/project=local(%3A|:)/i, { timeout: 30_000 });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  return page.url();
}

test("PROJECT-UI-02A exposes only OPEN project-content views and keeps settings global", async ({ page }) => {
  await waitForShell(page);

  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toBeVisible();
  await expect(nav).toHaveAttribute("data-workspace-contract", "project-ui-02a");
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_OPEN");

  for (const label of ["Übersicht", "Assets", "Bibliotheken"]) {
    await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole("button", { name: "Projekte", exact: true })).toBeHidden();
  await expect(nav.getByRole("button")).toHaveCount(4);
  await expect(nav).not.toContainText(/Projektstruktur|Versionen|Einstellungen/i);

  // UI-REC-01B capability guard: Hall3D remains outside the Project content tabs.
  const hall3dButton = page.locator('#moduleNav button[data-module-id="module.hall3d"]');
  await expect(hall3dButton).toBeVisible();

  await page.locator('#moduleNav button[data-module-id="module.settings"]').click();
  await expect(page.locator("#active")).toHaveText("settings:workspace");
  await expect(nav).toBeHidden();
  await expect(page.locator("#view")).toContainText(/Grid|Snap|Viewport/i);
  await expect(hall3dButton).toBeVisible();
});

test("PROJECT-UI-02A separates OPEN project content from NONE project management", async ({ page }) => {
  await waitForShell(page);
  const projectUrl = await createProject(page);
  const projectParam = new URL(projectUrl).searchParams.get("project");
  expect(projectParam).toBeTruthy();

  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toBeVisible();
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_OPEN");

  for (const item of [
    ["Assets", "projectPanel:assets"],
    ["Bibliotheken", "projectPanel:libraries"],
    ["Übersicht", "projectPanel:general"]
  ]) {
    const [label, panelId] = item;
    await nav.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("#active")).toHaveText(panelId);
    await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_OPEN");
    expect(new URL(page.url()).searchParams.get("project")).toBe(projectParam);
  }

  await page.locator("#globalCommandBar").getByRole("button", { name: /^Datei$/i }).click();
  await expect(page.locator("#active")).toHaveText("projectPanel:projects");
  await expect(nav).toBeHidden();
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_NONE");
  await expect(page.getByRole("heading", { name: /Projektliste/i })).toBeVisible();

  // UI-REC-01B capability guard must survive PROJECT_STATE_NONE.
  await expect(page.locator('#moduleNav button[data-module-id="module.hall3d"]')).toBeVisible();

  // Legacy bleibt nur als Migrations-/Fallback-Schicht erhalten und wird nicht entfernt.
  await expect(page.locator("#legacyMenuWrap #menu")).toBeAttached();
});
