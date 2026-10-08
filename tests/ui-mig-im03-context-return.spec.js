import { test, expect } from "@playwright/test";

async function waitForShell(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

async function openProjectAssets(page) {
  const project = page.locator('#moduleNav button[data-module-id="module.project"]');
  await project.click();
  await expect(project).toHaveAttribute("aria-pressed", "true");

  const assets = page.locator('#projectWorkspaceNav button[data-project-view="assets"]');
  await expect(assets).toBeVisible({ timeout: 30_000 });
  await assets.click();
}

test("IM03 contextual transition offers Back and restores source workspace", async ({ page }) => {
  await waitForShell(page);

  await openProjectAssets(page);
  await expect(page.getByRole("heading", { name: /Projekt\s*(?:[–-]\s*)?(?:Projekt-)?Assets/i }))
    .toBeVisible({ timeout: 30_000 });

  const addDummy = page.getByRole("button", { name: /\+ Dummy-Asset/i });
  await addDummy.click();
  await expect(page.locator("#view")).toContainText(/Dummy Asset/i, { timeout: 30_000 });

  const restored = page.evaluate(() => new Promise((resolve) => {
    document.addEventListener("bp:navigation:context-restored", (ev) => resolve(ev.detail), { once: true });
  }));

  await page.getByRole("button", { name: /In AssetLab öffnen/i }).first().click();
  await expect(page.getByRole("heading", { name: /AssetLab 3D/i })).toBeVisible({ timeout: 30_000 });

  const back = page.locator("#globalCommandBar").getByRole("button", { name: "Projekt", exact: true });
  await expect(back).toBeVisible();
  await expect(back).toHaveText(/Projekt/i);
  await back.click();

  await expect(page.getByRole("heading", { name: /Projekt\s*(?:[–-]\s*)?(?:Projekt-)?Assets/i }))
    .toBeVisible({ timeout: 30_000 });
  await expect(back).toBeHidden();
  await expect(page.locator('#moduleNav button[data-module-id="module.project"]')).toHaveAttribute("aria-pressed", "true");

  const detail = await restored;
  expect(detail.panel).toBe("projectPanel:assets");
  expect(detail.moduleId).toBe("module.project");
});

test("IM03 direct module switch does not keep contextual Back history", async ({ page }) => {
  await waitForShell(page);

  await openProjectAssets(page);
  await page.getByRole("button", { name: /\+ Dummy-Asset/i }).click();
  await page.getByRole("button", { name: /In AssetLab öffnen/i }).first().click();
  await expect(page.getByRole("heading", { name: /AssetLab 3D/i })).toBeVisible({ timeout: 30_000 });

  const back = page.locator("#globalCommandBar").getByRole("button", { name: "Projekt", exact: true });
  await expect(back).toBeVisible();

  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator('#moduleNav button[data-module-id="module.planning"]')).toHaveAttribute("aria-pressed", "true");
  await expect(back).toBeHidden();
});
