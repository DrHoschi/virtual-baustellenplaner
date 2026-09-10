import { test, expect } from "@playwright/test";

const PROJECT_ID = "P-2026-04A1";

async function waitForShell(page) {
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

function projectRecord(id) {
  const project = {
    schema: "baustellenplaner.project.v1",
    id,
    name: "PROJECT-UI-04A Existing Project Hall Creation",
    type: "industriebau",
    timezone: "Europe/Berlin",
    units: "metric",
    version: "1.0.0",
    modules: ["core", "layout"],
    assets: { items: [], folders: [], settings: {} },
    projectAssets: [],
  };

  return {
    schema: "bp-projectfile",
    version: "1.0",
    project,
    app: {
      settings: {},
      ui: { drafts: {} },
    },
  };
}

async function seedAndOpenExistingProject(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await waitForShell(page);

  await page.evaluate(({ id, record }) => {
    localStorage.setItem(`baustellenplaner:projectfile:${id}`, JSON.stringify(record));
    localStorage.removeItem("baustellenplaner:activeProject");
    sessionStorage.removeItem("bp:project-ui-02b:open-target");
  }, { id: PROJECT_ID, record: projectRecord(PROJECT_ID) });

  await page.locator("#globalCommandBar").getByRole("button", { name: /^Datei$/i }).click();
  await expect(page.locator("#active")).toHaveText("projectPanel:projects");

  const card = page.locator("#view").getByText(PROJECT_ID, { exact: true }).locator("..");
  await card.getByRole("button", { name: /^Öffnen$/i }).click();

  await page.waitForURL(new RegExp(`project=local(%3A|:)${PROJECT_ID}`), { timeout: 30_000 });
  await waitForShell(page);
  await expect(page.locator("#active")).toHaveText("projectPanel:general", { timeout: 30_000 });
}

async function storedProject(page) {
  return page.evaluate((id) => {
    const raw = localStorage.getItem(`baustellenplaner:projectfile:${id}`);
    return raw ? JSON.parse(raw) : null;
  }, PROJECT_ID);
}

test("PROJECT-UI-04A existing project hall create + edit rebuilds live and persists", async ({ page }) => {
  await seedAndOpenExistingProject(page);

  const productiveEntry = page.locator('[data-project-ui-03b="productive-entry"]');
  await expect(productiveEntry).toBeVisible();
  await productiveEntry.locator('[data-project-ui-03b-target="hall3d"]').click();

  await expect(page.locator("#active")).toHaveText("projectPanel:hall3d", { timeout: 30_000 });
  const createForm = page.locator('[data-bp-hall-create-form="true"]');
  await expect(createForm).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-hall3d-status="no-hall"]')).toBeVisible();

  await page.locator('[data-bp-hall-create-field="length"]').fill("72");
  await page.locator('[data-bp-hall-create-field="width"]').fill("36");
  await page.locator('[data-bp-hall-create-field="eaveHeight"]').fill("9");
  await page.locator('[data-bp-hall-create-field="roofType"]').selectOption("gable");
  await page.locator('[data-bp-hall-create-field="peakHeight"]').fill("12");
  await page.locator('[data-bp-hall-create-field="gridSpacing"]').fill("6");
  await page.locator('[data-bp-hall-create-submit="true"]').click();

  const editForm = page.locator('[data-bp-hall-edit-form="true"]');
  await expect(editForm).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-hall3d-status="ready"]')).toBeVisible({ timeout: 30_000 });

  let stored = await storedProject(page);
  expect(stored?.project?.id).toBe(PROJECT_ID);
  expect(stored?.project?.hall?.schema).toBe("baustellenplaner.hall.v1");
  expect(stored?.project?.hall?.dimensions).toEqual({ length: 72, width: 36, eaveHeight: 9 });
  expect(stored?.project?.hall?.roof).toEqual({ type: "gable", peakHeight: 12 });
  expect(stored?.project?.hall?.grid?.longitudinal?.spacing).toBe(6);

  // B-04A-001: edit while Hall3D remains active. Successful live rebuild must
  // replace the mounted editor DOM immediately; leaving/re-entering is forbidden.
  const editFormBefore = await editForm.elementHandle();
  await editForm.locator('input[type="number"]').nth(0).fill("84");
  await editForm.getByRole("button", { name: /^Halle übernehmen$/i }).click();

  await expect.poll(async () => editFormBefore ? editFormBefore.evaluate((el) => el.isConnected) : true, {
    timeout: 30_000,
  }).toBe(false);
  await expect(page.locator("#active")).toHaveText("projectPanel:hall3d");
  await expect(page.locator('[data-bp-hall-edit-form="true"]')).toBeVisible();
  await expect(page.locator('[data-hall3d-status="ready"]')).toBeVisible();

  stored = await storedProject(page);
  expect(stored?.project?.hall?.dimensions?.length).toBe(84);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForShell(page);
  await expect(page.locator("#active")).toHaveText("projectPanel:hall3d", { timeout: 30_000 });
  await expect(page.locator('[data-bp-hall-edit-form="true"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-hall3d-status="ready"]')).toBeVisible({ timeout: 30_000 });

  stored = await storedProject(page);
  expect(stored?.project?.id).toBe(PROJECT_ID);
  expect(stored?.project?.hall?.dimensions?.length).toBe(84);

  await page.locator('#moduleNav button[data-module-id="module.project"]').click();
  await expect(page.locator("#active")).toHaveText("projectPanel:general", { timeout: 30_000 });
  await expect(page.locator('[data-project-ui-03b-target="planning"]')).toBeVisible();
});
