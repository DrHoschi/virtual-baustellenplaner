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

  // PROJECT_STATE_NONE: Create Flow besitzt keine Projektinhalt-Tabzeile.
  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toBeHidden();
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_NONE");

  const nameInput = page.locator('input[placeholder*="Baustelle"]');
  await nameInput.fill("PROJECT-UI-02A Projekt");
  await page.getByRole("button", { name: /Projekt anlegen \(localStorage\)/i }).click();
  await page.waitForURL(/project=local(%3A|:)/i, { timeout: 30_000 });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  return page.url();
}

test("PROJECT-UI-02A exposes only OPEN project-content views", async ({ page }) => {
  await waitForShell(page);

  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toHaveAttribute("data-workspace-contract", "project-ui-02a");

  // Der bestehende Default-Boot lädt weiterhin ein Projekt. 02A ändert den Loader
  // ausdrücklich nicht und prüft hier nur die sichtbare State-Shell.
  await expect(nav).toBeVisible();
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_OPEN");

  for (const label of ["Übersicht", "Assets", "Bibliotheken"]) {
    await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole("button", { name: "Projekte", exact: true })).toBeHidden();
  await expect(nav).not.toContainText(/Projektstruktur|Versionen|Einstellungen/i);

  await page.locator('#moduleNav button[data-module-id="module.settings"]').click();
  await expect(page.locator("#active")).toHaveText("settings:workspace");
  await expect(nav).toBeHidden();
  await expect(page.locator("#view")).toContainText(/Grid|Snap|Viewport/i);
});

test("PROJECT-UI-02A separates OPEN content from NONE project management", async ({ page }) => {
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

  // Global Datei nutzt in 02A noch bewusst die bestehende Legacy-Route. Das Ziel
  // ist aber jetzt PROJECT_STATE_NONE und zeigt keine OPEN-Projektinhalt-Tabs mehr.
  await page.locator("#globalCommandBar").getByRole("button", { name: /^Datei$/i }).click();
  await expect(page.locator("#active")).toHaveText("projectPanel:projects");
  await expect(nav).toBeHidden();
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_NONE");
  await expect(page.getByRole("heading", { name: /Projektliste/i })).toBeVisible();

  // Legacy bleibt nur als Migrations-/Fallback-Schicht erhalten und wird nicht entfernt.
  await expect(page.locator("#legacyMenuWrap #menu")).toBeAttached();
});
