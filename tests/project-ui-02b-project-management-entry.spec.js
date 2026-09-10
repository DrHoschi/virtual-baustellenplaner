import { test, expect } from "@playwright/test";

const VALID_ID = "P-2026-02B1";
const INVALID_ID = "P-2026-02B2";

async function waitForShell(page) {
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

async function openProjectManagement(page) {
  await page.locator("#globalCommandBar").getByRole("button", { name: /^Datei$/i }).click();
  await expect(page.locator("#active")).toHaveText("projectPanel:projects");
  const nav = page.locator("#projectWorkspaceNav");
  await expect(nav).toBeHidden();
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_NONE");
  await expect(page.getByRole("heading", { name: /Projektliste/i })).toBeVisible();
  await expect(page.locator('#moduleNav button[data-module-id="module.hall3d"]')).toBeVisible();
  return nav;
}

function validProjectRecord(id) {
  return {
    project: {
      id,
      name: "PROJECT-UI-02B Valid",
      type: "Industriebau",
      projectAssets: []
    },
    app: {
      project: {
        id,
        name: "PROJECT-UI-02B Valid",
        type: "Industriebau",
        projectAssets: []
      },
      activeProject: { kind: "local", id },
      activeProjectId: id,
      settings: {},
      ui: { activeModule: "projectPanel:projects" }
    }
  };
}

test("PROJECT-UI-02B valid existing project Open completes at Overview / PROJECT_STATE_OPEN", async ({ page }) => {
  await page.addInitScript(({ id, record }) => {
    localStorage.setItem(`baustellenplaner:projectfile:${id}`, JSON.stringify(record));
    localStorage.removeItem("baustellenplaner:activeProject");
    sessionStorage.removeItem("bp:project-ui-02b:open-target");
  }, { id: VALID_ID, record: validProjectRecord(VALID_ID) });

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await waitForShell(page);
  const nav = await openProjectManagement(page);

  const card = page.locator("#view").getByText(VALID_ID, { exact: true }).locator("..");
  await card.getByRole("button", { name: /^Öffnen$/i }).click();

  await page.waitForURL(new RegExp(`project=local(%3A|:)${VALID_ID}`), { timeout: 30_000 });
  await waitForShell(page);

  await expect(page.locator("#active")).toHaveText("projectPanel:general", { timeout: 30_000 });
  await expect(nav).toBeVisible();
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_OPEN");
  await expect(nav.getByRole("button")).toHaveCount(3);
  for (const label of ["Übersicht", "Assets", "Bibliotheken"]) {
    await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole("button", { name: "Projekte", exact: true })).toBeHidden();
  await expect(page.locator('#moduleNav button[data-module-id="module.hall3d"]')).toBeVisible();

  const pending = await page.evaluate(() => sessionStorage.getItem("bp:project-ui-02b:open-target"));
  expect(pending).toBeNull();
});

test("PROJECT-UI-02B invalid existing project Open is blocked and remains PROJECT_STATE_NONE", async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem(`baustellenplaner:projectfile:${id}`, "{ invalid-json");
    localStorage.removeItem("baustellenplaner:activeProject");
    sessionStorage.removeItem("bp:project-ui-02b:open-target");
  }, { id: INVALID_ID });

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await waitForShell(page);
  const nav = await openProjectManagement(page);
  const beforeUrl = page.url();

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("alert");
    expect(dialog.message()).toMatch(/konnte nicht geöffnet werden|ungültig/i);
    await dialog.accept();
  });

  const card = page.locator("#view").getByText(INVALID_ID, { exact: true }).locator("..");
  await card.getByRole("button", { name: /^Öffnen$/i }).click();

  await expect(page.locator("#active")).toHaveText("projectPanel:projects");
  await expect(nav).toBeHidden();
  await expect(nav).toHaveAttribute("data-project-state", "PROJECT_STATE_NONE");
  expect(page.url()).toBe(beforeUrl);
  await expect(page.locator('#moduleNav button[data-module-id="module.hall3d"]')).toBeVisible();

  const activeProject = await page.evaluate(() => localStorage.getItem("baustellenplaner:activeProject"));
  const pending = await page.evaluate(() => sessionStorage.getItem("bp:project-ui-02b:open-target"));
  expect(activeProject).toBeNull();
  expect(pending).toBeNull();
});
