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

async function captureRuntimeDiagnosis(page, runtimeMessages) {
  const snapshot = await page.evaluate(() => {
    const view = document.getElementById("view");
    const active = document.getElementById("active");
    const projectNav = document.getElementById("projectWorkspaceNav");
    const productiveEntry = document.querySelector('[data-project-ui-03b="productive-entry"]');
    const panelErrorText = Array.from(document.querySelectorAll("#view *"))
      .map((el) => (el.textContent || "").trim())
      .find((text) => text.includes("Panel-Fehler")) || null;

    return {
      url: location.href,
      activePanel: active?.textContent?.trim() || null,
      projectState: projectNav?.dataset?.projectState || null,
      projectNavHidden: projectNav?.hidden ?? null,
      viewText: view?.innerText || null,
      viewHtml: view?.innerHTML || null,
      productiveEntryPresent: !!productiveEntry,
      panelErrorText
    };
  });

  console.log("[PROJECT-UI-03B][B-03B-001][RUNTIME-DIAG]", JSON.stringify({
    snapshot,
    runtimeMessages
  }, null, 2));
}

test("PROJECT-UI-03B open project -> Hall3D -> project -> Planning -> project preserves project state", async ({ page }) => {
  const runtimeMessages = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      runtimeMessages.push({ type: "console.error", text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    runtimeMessages.push({ type: "pageerror", text: err?.stack || err?.message || String(err) });
  });

  await openExistingProject(page);

  const productiveEntry = page.locator('[data-project-ui-03b="productive-entry"]');
  if (await productiveEntry.count() === 0) {
    await captureRuntimeDiagnosis(page, runtimeMessages);
  }
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
