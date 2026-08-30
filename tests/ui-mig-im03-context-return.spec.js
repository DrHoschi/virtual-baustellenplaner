import { test, expect } from "@playwright/test";

async function waitForShell(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

async function openLegacy(page, label) {
  await page.getByRole("button", { name: /Alt-Menü/i }).click();
  const btn = page.locator("#legacyMenuWrap").getByRole("button", { name: label }).first();
  await expect(btn).toBeVisible({ timeout: 30_000 });
  await btn.click();
}

test("IM03 contextual transition offers Back and restores source workspace", async ({ page }) => {
  await waitForShell(page);

  await openLegacy(page, /Projekt-Assets/i);
  await expect(page.getByRole("heading", { name: /Projekt\s*(?:[–-]\s*)?(?:Projekt-)?Assets/i }))
    .toBeVisible({ timeout: 30_000 });

  const addDummy = page.getByRole("button", { name: /\+ Dummy-Asset/i });
  await addDummy.click();
  await expect(page.locator("#view")).toContainText(/Dummy Asset/i, { timeout: 30_000 });

  // Für einen deterministischen UI-State-Test machen wir den Host temporär scrollbar.
  await page.locator("#view").evaluate((el) => {
    el.style.height = "120px";
    el.style.overflow = "auto";
    const spacer = document.createElement("div");
    spacer.dataset.im03Spacer = "true";
    spacer.style.height = "600px";
    el.appendChild(spacer);
    el.scrollTop = 90;
  });
  await expect.poll(() => page.locator("#view").evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  const restored = page.evaluate(() => new Promise((resolve) => {
    document.addEventListener("bp:navigation:context-restored", (ev) => resolve(ev.detail), { once: true });
  }));

  await page.getByRole("button", { name: /In AssetLab öffnen/i }).first().click();
  await expect(page.getByRole("heading", { name: /AssetLab 3D/i })).toBeVisible({ timeout: 30_000 });

  const back = page.getByRole("button", { name: /Zur vorherigen Aufgabe zurück/i });
  await expect(back).toBeVisible();
  await expect(back).toHaveText(/Projekt/i);
  await back.click();

  await expect(page.getByRole("heading", { name: /Projekt\s*(?:[–-]\s*)?(?:Projekt-)?Assets/i }))
    .toBeVisible({ timeout: 30_000 });
  await expect(back).toBeHidden();

  const detail = await restored;
  expect(detail.panel).toBe("projectPanel:assets");
  expect(detail.moduleId).toBe("module.project");
  await expect.poll(() => page.locator("#view").evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test("IM03 direct module switch does not keep contextual Back history", async ({ page }) => {
  await waitForShell(page);

  await openLegacy(page, /Projekt-Assets/i);
  await page.getByRole("button", { name: /\+ Dummy-Asset/i }).click();
  await page.getByRole("button", { name: /In AssetLab öffnen/i }).first().click();
  await expect(page.getByRole("heading", { name: /AssetLab 3D/i })).toBeVisible({ timeout: 30_000 });

  const back = page.getByRole("button", { name: /Zur vorherigen Aufgabe zurück/i });
  await expect(back).toBeVisible();

  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator('#moduleNav button[data-module-id="module.planning"]')).toHaveAttribute("aria-pressed", "true");
  await expect(back).toBeHidden();
});
