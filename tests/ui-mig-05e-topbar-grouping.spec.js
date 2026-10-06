import { test, expect } from "@playwright/test";

async function bootPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
  await expect(page.locator('#view .wa-topbar [data-bp-planning-topbar="05e-b"]')).toBeVisible();
}

test("UI-MIG-05E-B groups only existing product controls semantically", async ({ page }) => {
  await bootPlanning(page);
  const topbar = page.locator("#view .wa-topbar");

  await expect(topbar.locator('[data-bp-planning-topbar-section="work-tools"]')).toBeVisible();
  await expect(topbar.locator('[data-bp-planning-topbar-section="navigation"]')).toBeVisible();
  await expect(topbar.locator('[data-bp-planning-topbar-section="view-options"]')).toBeHidden();
  await expect(topbar.locator('[data-bp-planning-topbar-section="workspace-layout"]')).toBeHidden();

  await expect(topbar.locator('button[data-bp-planning-mode="select"]')).toHaveText("Auswahl");
  await expect(topbar.locator('button[data-bp-planning-mode="place"]')).toHaveText("Platzieren");
  await expect(topbar.locator('button[data-bp-planning-mode="measure"]')).toHaveAttribute("aria-label", "Kabeltrasse");
  await expect(topbar.locator('button[data-bp-planning-mode="edit"]')).toHaveAttribute("data-bp-planning-legacy", "true");
  await expect(topbar.locator('button[data-bp-planning-mode="pan"]')).toHaveText("Pan");

  await expect(topbar.locator('[data-bp-planning-navigation-control="zoom"]')).toBeVisible();
  await expect(topbar.locator('[data-bp-planning-view-options="grid-snap"]')).toContainText("Grid:");
  await expect(topbar.locator('[data-bp-planning-view-options="grid-snap"]')).toContainText("Snap:");
});

test("UI-MIG-05E-B reuses the existing Workarea mode handler", async ({ page }) => {
  await bootPlanning(page);
  const topbar = page.locator("#view .wa-topbar");
  const legacyMode = topbar.locator(".wa-mode-select");

  await topbar.locator('button[data-bp-planning-mode="pan"]').click();
  await expect(legacyMode).toHaveValue("pan");

  await topbar.locator('button[data-bp-planning-mode="select"]').click();
  await expect(legacyMode).toHaveValue("select");

  await topbar.locator('button[data-bp-planning-mode="place"]').click();
  await expect(legacyMode).toHaveValue("place");

  await topbar.locator('button[data-bp-planning-mode="measure"]').click();
  await expect(legacyMode).toHaveValue("measure");
});

test("Planning exposes cable-tray drawing controls and completes a drawn route on phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootPlanning(page);

  const topbar = page.locator("#view .wa-topbar");
  const routeTool = topbar.getByRole("button", { name: "Kabeltrasse", exact: true });
  await expect(routeTool).toBeVisible();
  await routeTool.click();
  await expect(topbar.locator(".wa-mode-select")).toHaveValue("measure");
  await expect(routeTool).toHaveAttribute("aria-pressed", "true");

  const controls = page.locator("#view .wa-tray-drawing-panel");
  await expect(controls).toBeVisible();
  await expect(controls.getByLabel("Breite")).toHaveValue("200");
  await expect(controls.getByLabel("Trasse")).toHaveValue("new");
  await expect(controls.getByLabel("Ausführung")).toHaveValue("standard");
  await controls.getByLabel("Breite").selectOption("100");
  await expect(controls.getByLabel("Breite")).toHaveValue("100");
  await controls.getByLabel("Trasse").selectOption("existing");
  await expect(controls.getByLabel("Trasse")).toHaveValue("existing");
  await controls.getByLabel("Ausführung").selectOption("heavy");
  await expect(controls.getByLabel("Ausführung")).toHaveValue("heavy");

  const canvas = page.locator("#view .wa-viewport-host canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.35);
  await page.mouse.click(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.35);
  await expect(page.locator("#view .wa-bottom-bar > div").first()).toContainText("Bestand 100:");

  await controls.getByRole("button", { name: "Trasse abschließen" }).click();
  await expect(page.locator("#view .wa-bottom-bar > div").first()).toContainText("Trasse abgeschlossen (finish)");
  await expect(controls).toBeVisible();
});

test("Completed cable-tray routes remain in the scene across width changes and new routes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootPlanning(page);

  const topbar = page.locator("#view .wa-topbar");
  await topbar.getByRole("button", { name: "Kabeltrasse", exact: true }).click();
  const controls = page.locator("#view .wa-tray-drawing-panel");
  const width = controls.getByLabel("Breite");
  const canvas = page.locator("#view .wa-viewport-host canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  const drawLine = async (y) => {
    await page.mouse.click(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * y);
    await page.mouse.click(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * y);
    await controls.getByRole("button", { name: "Trasse abschließen" }).click();
  };

  await width.selectOption("100");
  await drawLine(0.3);
  await width.selectOption("200");
  await drawLine(0.5);
  await width.selectOption("100");
  await drawLine(0.7);

  const status = page.locator("#view .wa-bottom-bar > div").first();
  await expect(status).toContainText(/Neu 100: (?!0\.00)/);
  await expect(status).toContainText(/Neu 200: (?!0\.00)/);
});

test("UI-MIG-05E-B moves Workarea diagnostics out of the product topbar", async ({ page }) => {
  await bootPlanning(page);
  const topbar = page.locator("#view .wa-topbar");

  await expect(topbar.locator(".wa-debug-group")).toHaveCount(0);
  const devGroup = page.locator('#devLayer [data-bp-planning-devtools="05e-b"] .wa-debug-group');
  await expect(devGroup).toHaveCount(1);
  await expect(devGroup).toContainText("Dummy Select");
  await expect(devGroup).toContainText("Layout JSON");
  await expect(devGroup).toContainText("CrashLog");
  await expect(devGroup).toContainText("Focus");
});

test("UI-MIG-05E-B does not invent missing master tools", async ({ page }) => {
  await bootPlanning(page);
  const topbar = page.locator('#view .wa-topbar [data-bp-planning-topbar="05e-b"]');

  await expect(topbar.getByRole("button", { name: "Verschieben", exact: true })).toHaveCount(0);
  await expect(topbar.getByRole("button", { name: "Drehen", exact: true })).toHaveCount(0);
  await expect(topbar.getByRole("button", { name: "Messen", exact: true })).toHaveCount(0);
  await expect(topbar.getByRole("button", { name: "Fokus", exact: true })).toHaveCount(0);
  await expect(topbar.getByRole("button", { name: "Achsen", exact: true })).toHaveCount(0);
});

test("UI-MIG-05E-B keeps the mapped Workarea regions intact", async ({ page }) => {
  await bootPlanning(page);
  const shell = page.locator("#view .wa-shell");
  await expect(shell.locator(":scope > .wa-left-dock")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-center > .wa-viewport-host")).toHaveCount(1);
  await expect(shell.locator(":scope > .wa-right-dock")).toHaveCount(1);
});
