// tests/ui-wiring.spec.js
// Version: v1.6.0-slots-wiring (2026-02-09)
//
// Ziel:
// - Wizard -> Projektliste -> Projekt-Assets -> Dummy-Asset (Slots UI) -> AssetLab
//
// Fail-Fast: pageerror oder console.error => sofort Abbruch
// Artefakte bei Fail: console.txt / dom.html / screenshot.png / trace (wenn aktiviert)

import { test, expect } from "@playwright/test";

/* -----------------------------------------------------------------------------
 * Logging & Fail-Fast Hook
 * -------------------------------------------------------------------------- */

function installFailFast(page) {
  const logs = [];
  let fatal = null; // { type, message, stack }

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

  return {
    getLogs: () => logs.join("\n"),
    throwIfFatal,
  };
}

/* -----------------------------------------------------------------------------
 * Boot / UI Helpers
 * -------------------------------------------------------------------------- */

async function waitForBoot(page, ff) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await ff.throwIfFatal("page.goto(/index.html)");

  await expect(page.locator("#menu")).toBeVisible({ timeout: 30_000 });

  const active = page.locator("#active");
  if (await active.count()) {
    await expect(active).toBeVisible({ timeout: 30_000 });
    await expect(active).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  }

  await ff.throwIfFatal("waitForBoot()");
}

async function clickMenu(page, ff, labelRegex) {
  const btn = page.getByRole("button", { name: labelRegex }).first();
  await expect(btn).toBeVisible({ timeout: 30_000 });
  await btn.click();
  await ff.throwIfFatal(`clickMenu(${labelRegex})`);
}

/* -----------------------------------------------------------------------------
 * Test
 * -------------------------------------------------------------------------- */

test("UI Wiring: Wizard -> Projektliste -> Projekt-Assets (Slots) -> AssetLab", async ({ page }, testInfo) => {
  const ff = installFailFast(page);

  try {
    await waitForBoot(page, ff);

    // 1) Wizard öffnen
    await clickMenu(page, ff, /Neu \(Wizard\)/i);
    await expect(page.getByRole("heading", { name: /Projekt\s*–\s*Neu \(Wizard\)/i }))
      .toBeVisible({ timeout: 30_000 });

    // Projektname setzen (wenn Placeholder sich ändert: robust bleiben)
    const nameInput =
      page.locator('input[placeholder*="Baustelle"]').first()
      .or(page.locator('input[name="projectName"]').first())
      .or(page.locator("input").first());

    await expect(nameInput).toBeVisible({ timeout: 30_000 });
    await nameInput.fill("CI Test Projekt");

    // Projekt anlegen (localStorage)
    const createBtn = page.getByRole("button", { name: /Projekt anlegen \(localStorage\)/i });
    await expect(createBtn).toBeVisible({ timeout: 30_000 });
    await createBtn.click();
    await ff.throwIfFatal("click create project");

    // Redirect abwarten
    await page.waitForURL(/project=local(%3A|:)/i, { timeout: 30_000 });
    await ff.throwIfFatal("waitForURL(project=local)");

    // 2) Projektliste prüfen
    await clickMenu(page, ff, /Projektliste/i);
    await expect(page.getByRole("heading", { name: /Projektliste/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#view")).toContainText(/P-\d{4}-\d{4}/, { timeout: 30_000 });

    // 3) Projekt-Assets -> Dummy -> Slot UI prüfen
    await clickMenu(page, ff, /Projekt-Assets/i);
    await expect(page.getByRole("heading", { name: /Projekt-Assets/i })).toBeVisible({ timeout: 30_000 });

    const addDummy = page.getByRole("button", { name: /\+ Dummy-Asset/i });
    await expect(addDummy).toBeVisible({ timeout: 30_000 });
    await addDummy.click();
    await ff.throwIfFatal("click + Dummy-Asset");

    await expect(page.locator("#view")).toContainText(/Dummy Asset/i, { timeout: 30_000 });

    // --- Slots: Grund-UI muss sichtbar sein ---
    await expect(page.locator("#view")).toContainText(/Slot:/i, { timeout: 30_000 });

    const btnAddSlot = page.getByRole("button", { name: /^\+\s*Slot$/i }).first();
    const btnDelSlot = page.getByRole("button", { name: /Slot löschen/i }).first();
    await expect(btnAddSlot).toBeVisible({ timeout: 30_000 });
    await expect(btnDelSlot).toBeVisible({ timeout: 30_000 });

    // Ein Select sollte existieren und mindestens "Variante 1" enthalten
    const slotSelect = page.locator("#view select").first();
    await expect(slotSelect).toBeVisible({ timeout: 30_000 });
    await expect(slotSelect).toContainText(/Variante 1/i, { timeout: 30_000 });

    // + Slot klicken -> jetzt sollte Variante 2 auswählbar/da sein
    await btnAddSlot.click();
    await ff.throwIfFatal("click + Slot");
    await expect(slotSelect).toContainText(/Variante 2/i, { timeout: 30_000 });

    // 4) In AssetLab öffnen (Kontext aus ProjectAsset)
    const openInAssetLab = page.getByRole("button", { name: /In AssetLab öffnen/i }).first();
    await expect(openInAssetLab).toBeVisible({ timeout: 30_000 });
    await openInAssetLab.click();
    await ff.throwIfFatal("click In AssetLab öffnen");

    // AssetLab sichtbar + Kontext
    await expect(page.getByRole("heading", { name: /AssetLab 3D/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#view")).toContainText(/PA-/, { timeout: 30_000 });

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
