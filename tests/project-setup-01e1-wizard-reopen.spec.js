import { test, expect } from "@playwright/test";

async function waitForBoot(page) {
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

test("PROJECT-SETUP-01E.1 hall wizard persists project.hall and reopens it unchanged", async ({ page }) => {
  const bootstrapId = "P-2026-E1BOOT";

  // Establish the test origin before using localStorage.
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(({ bootstrapId }) => {
    localStorage.clear();
    localStorage.setItem(`baustellenplaner:projectfile:${bootstrapId}`, JSON.stringify({
      schema: "bp-projectfile",
      version: "1.0",
      project: {
        schema: "baustellenplaner.project.v1",
        id: bootstrapId,
        name: "E1 Bootstrap",
        type: "industriebau",
        timezone: "Europe/Berlin",
        units: "metric",
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        uiPreset: "standard",
        modules: ["core", "layout"],
        assets: { items: [], folders: [], settings: {} },
        projectAssets: [],
      },
      app: {
        settings: {},
        ui: {
          activeModule: "projectPanel:wizard",
          drafts: {},
        },
      },
    }));
  }, { bootstrapId });

  await page.goto(`/index.html?project=local:${bootstrapId}`, { waitUntil: "domcontentloaded" });
  await waitForBoot(page);
  await expect(page.locator("#active")).toHaveText("projectPanel:wizard");
  await expect(page.getByRole("heading", { name: "Projekt – Neu", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Industriehalle \/ Hallenplanung/ }).click();
  await expect(page.getByText("3 · Hallengrunddaten", { exact: true })).toBeVisible();

  const view = page.locator("#view");
  await view.locator('input[type="text"]').fill("E1 Musterhalle");

  const numbers = view.locator('input[type="number"]');
  await expect(numbers).toHaveCount(5);
  await numbers.nth(0).fill("72");
  await numbers.nth(1).fill("36");
  await numbers.nth(2).fill("9");
  await numbers.nth(3).fill("12");
  await numbers.nth(4).fill("6");

  await Promise.all([
    page.waitForURL((url) => String(url.searchParams.get("project") || "").startsWith("local:P-"), { timeout: 30_000 }),
    page.getByRole("button", { name: "Projekt anlegen", exact: true }).click(),
  ]);

  await waitForBoot(page);

  const projectRef = new URL(page.url()).searchParams.get("project");
  expect(projectRef).toMatch(/^local:P-/);
  const projectId = projectRef.slice("local:".length);

  const projectFile = await page.evaluate((id) => {
    const raw = localStorage.getItem(`baustellenplaner:projectfile:${id}`);
    return raw ? JSON.parse(raw) : null;
  }, projectId);

  expect(projectFile?.project?.modules).toEqual(["core", "layout", "hall3d"]);
  expect(projectFile?.project?.hall?.schema).toBe("baustellenplaner.hall.v1");
  expect(projectFile?.project?.hall?.presetRef).toEqual({ id: "hall_industry_gable_v1", version: 1 });
  expect(projectFile?.project?.hall?.dimensions).toEqual({ length: 72, width: 36, eaveHeight: 9 });
  expect(projectFile?.project?.hall?.roof).toEqual({ type: "gable", peakHeight: 12 });
  expect(projectFile?.project?.hall?.grid?.longitudinal).toEqual({ mode: "spacing", spacing: 6 });

  // Exercise the existing central persistor instead of adding a new hall save path.
  await page.waitForFunction(() => !!window.__BP_PERSISTOR__, null, { timeout: 30_000 });
  const saved = await page.evaluate(() => window.__BP_PERSISTOR__.saveNow("test:project-setup-01e1"));
  expect(saved).toBe(true);

  const persisted = await page.evaluate((id) => {
    const raw = localStorage.getItem(`baustellenplaner:project:${id}`);
    return raw ? JSON.parse(raw) : null;
  }, projectId);
  expect(persisted?.project?.hall?.dimensions).toEqual({ length: 72, width: 36, eaveHeight: 9 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoot(page);

  const runtimeSnapshot = await page.locator("#snapshot").textContent();
  const runtime = JSON.parse(runtimeSnapshot || "{}");
  expect(runtime?.app?.project?.id).toBe(projectId);
  expect(runtime?.app?.project?.hall?.dimensions).toEqual({ length: 72, width: 36, eaveHeight: 9 });
  expect(runtime?.app?.project?.hall?.roof).toEqual({ type: "gable", peakHeight: 12 });
  expect(runtime?.app?.project?.hall?.grid?.longitudinal?.spacing).toBe(6);

  // User-visible readback: after reopen the persisted hall must be visible in Project → Übersicht.
  const projectModuleButton = page.locator('#moduleNav button[data-module-id="module.project"]');
  if (await projectModuleButton.count()) {
    await projectModuleButton.click();
  }
  const projectNav = page.locator("#projectWorkspaceNav");
  await expect(projectNav).toBeVisible();
  await projectNav.getByRole("button", { name: "Übersicht", exact: true }).click();
  await expect(page.locator("#active")).toHaveText("projectPanel:general");

  await expect(page.getByText("Gespeicherte Hallenparameter", { exact: true })).toBeVisible();
  await expect(page.getByText("72 m × 36 m", { exact: true })).toBeVisible();
  await expect(page.getByText("9 m", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Satteldach · First 12 m", { exact: true })).toBeVisible();
  await expect(page.getByText("6 m", { exact: true }).first()).toBeVisible();
});
