// tests/ui-wiring.spec.js
// UI-MIG-02-IM02: Shell -> Projektfluss -> Legacy-Unterseite -> AssetLab

import { test, expect } from "@playwright/test";

function installFailFast(page) {
  const logs = [];
  let fatal = null;

  page.on("console", (msg) => {
    const line = `[console.${msg.type()}] ${msg.text()}`;
    logs.push(line);
    if (msg.type() === "error" && !fatal) {
      fatal = { type: "console.error", message: msg.text(), stack: null };
    }
  });

  page.on("pageerror", (err) => {
    const message = err?.message || String(err);
    const stack = err?.stack || null;
    logs.push(`[pageerror] ${stack || message}`);
    if (!fatal) fatal = { type: "pageerror", message, stack };
  });

  page.on("requestfailed", (req) => {
    logs.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText || "unknown"}`);
  });

  async function throwIfFatal(where = "unknown") {
    if (!fatal) return;
    const msg =
      `FATAL JS ERROR during "${where}": ${fatal.type}: ${fatal.message}\n` +
      (fatal.stack ? `\n${fatal.stack}\n` : "");
    throw new Error(msg);
  }

  return { getLogs: () => logs.join("\n"), throwIfFatal };
}

async function waitForBoot(page, ff) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await ff.throwIfFatal("page.goto(/index.html)");

  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#moduleNav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#view")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });

  await ff.throwIfFatal("waitForBoot()");
}

async function clickLegacyMenu(page, ff, labelRegex) {
  const legacyToggle = page.getByRole("button", { name: /Alt-Menü/i });
  await expect(legacyToggle).toBeVisible({ timeout: 30_000 });
  await legacyToggle.click();

  const btn = page.locator("#legacyMenuWrap").getByRole("button", { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 30_000 });
  await btn.click();
  await ff.throwIfFatal(`clickLegacyMenu(${labelRegex})`);
}

test("UI Wiring: IM02 Shell -> Wizard -> Projektliste -> Projekt-Assets -> AssetLab", async ({ page }, testInfo) => {
  const ff = installFailFast(page);

  try {
    await waitForBoot(page, ff);

    // 1) Wizard über neue globale Command Bar.
    const newBtn = page.locator("#globalCommandBar").getByRole("button", { name: /^Neu$/i });
    await expect(newBtn).toBeVisible({ timeout: 30_000 });
    await newBtn.click();
    await ff.throwIfFatal("command Neu");

    await expect(page.getByRole("heading", { name: /Projekt\s*–\s*Neu \(Wizard\)/i }))
      .toBeVisible({ timeout: 30_000 });

    const nameInput = page.locator('input[placeholder*="Baustelle"]');
    await expect(nameInput).toBeVisible({ timeout: 30_000 });
    await nameInput.fill("CI Test Projekt");

    const createBtn = page.getByRole("button", { name: /Projekt anlegen \(localStorage\)/i });
    await expect(createBtn).toBeVisible({ timeout: 30_000 });
    await createBtn.click();
    await ff.throwIfFatal("click create project");

    await page.waitForURL(/project=local(%3A|:)/i, { timeout: 30_000 });
    await waitForBoot(page, ff);

    // 2) Projektliste über neue Datei-Aktion.
    const fileBtn = page.locator("#globalCommandBar").getByRole("button", { name: /^Datei$/i });
    await expect(fileBtn).toBeVisible({ timeout: 30_000 });
    await fileBtn.click();
    await ff.throwIfFatal("command Datei");

    await expect(page.getByRole("heading", { name: /Projektliste/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#view")).toContainText(/P-\d{4}-\d{4}/, { timeout: 30_000 });

    // 3) Projekt-Assets bleibt in IM02 bewusst über Legacy-Unterseite erreichbar.
    await clickLegacyMenu(page, ff, /Projekt-Assets/i);
    await expect(
      page.getByRole("heading", { name: /Projekt\s*(?:[–-]\s*)?(?:Projekt-)?Assets/i })
    ).toBeVisible({ timeout: 30_000 });

    const addDummy = page.getByRole("button", { name: /\+ Dummy-Asset/i });
    await expect(addDummy).toBeVisible({ timeout: 30_000 });
    await addDummy.click();
    await ff.throwIfFatal("click + Dummy-Asset");

    await expect(page.locator("#view")).toContainText(/Dummy Asset/i, { timeout: 30_000 });

    const openInAssetLab = page.getByRole("button", { name: /In AssetLab öffnen/i }).first();
    await expect(openInAssetLab).toBeVisible({ timeout: 30_000 });
    await openInAssetLab.click();
    await ff.throwIfFatal("click In AssetLab öffnen");

    // 4) AssetLab sichtbar + neue Modulnavigation zeigt Asset-Entwicklung aktiv.
    await expect(page.getByRole("heading", { name: /AssetLab 3D/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#view")).toContainText(/PA-/, { timeout: 30_000 });
    await expect(page.locator('#moduleNav button[data-module-id="module.asset-development"]')).toHaveAttribute("aria-pressed", "true");

  } catch (err) {
    await testInfo.attach("console.txt", {
      body: Buffer.from(ff.getLogs() || "(no logs)"),
      contentType: "text/plain",
    });
    await testInfo.attach("dom.html", {
      body: Buffer.from((await page.content().catch(() => "")) || "(no html)"),
      contentType: "text/html",
    });
    await testInfo.attach("screenshot.png", {
      body: await page.screenshot({ fullPage: true }).catch(() => Buffer.from("")),
      contentType: "image/png",
    });
    throw err;
  }
});
