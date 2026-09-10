import { test, expect } from "@playwright/test";

const PROJECT_ID = "P-2026-03B1";

async function waitForShell(page) {
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

function projectRecord(id) {
  return {
    project: {
      id,
      name: "PROJECT-UI-03B Productive Entry",
      type: "Industriebau",
      hall: {
        presetRef: { id: "TEST-HALL" },
        dimensions: { length: 60, width: 30, eaveHeight: 8 },
        roof: { type: "gable", peakHeight: 10 },
        grid: { longitudinal: { spacing: 15 } },
        envelope: { walls: {} }
      },
      projectAssets: []
    },
    app: {
      project: {
        id,
        name: "PROJECT-UI-03B Productive Entry",
        type: "Industriebau",
        hall: {
          presetRef: { id: "TEST-HALL" },
          dimensions: { length: 60, width: 30, eaveHeight: 8 },
          roof: { type: "gable", peakHeight: 10 },
          grid: { longitudinal: { spacing: 15 } },
          envelope: { walls: {} }
        },
        projectAssets: []
      },
      activeProject: { kind: "local", id },
      activeProjectId: id,
      settings: {},
      ui: { activeModule: "projectPanel:general" }
    }
  };
}

async function openExistingProject(page) {
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
  await expect(page.locator("#projectWorkspaceNav")).toHaveAttribute("data-project-state", "PROJECT_STATE_OPEN");
}

async function expectProjectStillOpen(page) {
  const state = await page.evaluate((id) => ({
    active: localStorage.getItem("baustellenplaner:activeProject"),
    file: localStorage.getItem(`baustellenplaner:projectfile:${id}`)
  }), PROJECT_ID);

  expect(state.active).toContain(PROJECT_ID);
  expect(state.file).toContain(PROJECT_ID);
}

test("PROJECT-UI-03B open project -> Hall3D -> project -> Planning -> project preserves project state", async ({ page }) => {
  await openExistingProject(page);

  const productiveEntry = page.locator('[data-project-ui-03b="productive-entry"]');
  await expect(productiveEntry).toBeVisible();

  const hallButton = productiveEntry.locator('[data-project-ui-03b-target="hall3d"]');
  const planningButton = productiveEntry.locator('[data-project-ui-03b-target="planning"]');
  await expect(hallButton).toHaveText(/Halle öffnen \/ bearbeiten/i);
  await expect(planningButton).toHaveText(/Planung öffnen/i);

  await hallButton.click();
  await expect(page.locator("#active")).toHaveText("projectPanel:hall3d", { timeout: 30_000 });
  await expectProjectStillOpen(page);

  await page.locator('#moduleNav button[data-module-id="module.project"]').click();
  await expect(page.locator("#active")).toHaveText("projectPanel:general", { timeout: 30_000 });

  await page.locator('[data-project-ui-03b-target="planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expectProjectStillOpen(page);

  await page.locator('#moduleNav button[data-module-id="module.project"]').click();
  await expect(page.locator("#active")).toHaveText("projectPanel:general", { timeout: 30_000 });
  await expect(page.locator("#projectWorkspaceNav")).toHaveAttribute("data-project-state", "PROJECT_STATE_OPEN");
  await expectProjectStillOpen(page);
});
