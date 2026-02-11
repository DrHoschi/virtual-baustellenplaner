// tests/ui-wiring.spec.js
// Version: v1.5.0-failfast-debug (2026-02-08)
//
// Ziel:
// - Wizard -> Projektliste -> Projekt-Assets -> AssetLab
//
// WICHTIG (Fail-Fast):
// - Sobald ein JS-Fehler auftritt (pageerror) oder console.error,
//   brechen wir den Test sofort ab.
//   => Damit wartest du NICHT 30 Sekunden auf ein Element,
//      sondern siehst sofort den echten Grund.
//
// Artefakte bei Fail:
// - console.txt
// - dom.html
// - screenshot.png
// - Playwright Trace (wenn in Config aktiviert: trace: retain-on-failure)

import { test, expect } from "@playwright/test";

/* -----------------------------------------------------------------------------
 * Logging & Fail-Fast Hook
 * -------------------------------------------------------------------------- */

function installFailFast(page) {
  const logs = [];
  let fatal = null; // { type, message, stack }

  // Alles sammeln (für Attachments)
  page.on("console", (msg) => {
    const line = `[console.${msg.type()}] ${msg.text()}`;
    logs.push(line);

    // console.error zählt bei uns als "fatal", weil ihr oft genau so still sterbt
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

  // Helfer: wenn fatal gesetzt ist -> sofort abbrechen
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

  // Wenn beim initialen Laden schon ein JS Error passiert -> sofort raus
  await ff.throwIfFatal("page.goto(/index.html)");

  // "Menu muss sichtbar" ist unser härtestes Signal: App ist grundsätzlich da
  await expect(page.locator("#menu")).toBeVisible({ timeout: 30_000 });

  // Falls #active existiert: nicht ewig "(lädt...)"
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

  // Nach dem Klick sofort prüfen: hat der Klick einen JS Error ausgelöst?
  await ff.throwIfFatal(`clickMenu(${labelRegex})`);
}

/* -----------------------------------------------------------------------------
 * Test
 * -------------------------------------------------------------------------- */

test("UI Wiring: Wizard -> Projektliste -> Projekt-Assets -> AssetLab", async ({ page }, testInfo) => {
  const ff = installFailFast(page);

  try {
    await waitForBoot(page, ff);

    // 1) Wizard öffnen
    await clickMenu(page, ff, /Neu \(Wizard\)/i);

    // Wenn wir hier ankommen, gab es KEINEN fatalen JS error beim mounten.
    // Jetzt dürfen wir auf UI-Elemente warten.
    await expect(page.getByRole("heading", { name: /Projekt\s*–\s*Neu \(Wizard\)/i }))
      .toBeVisible({ timeout: 30_000 });

    // Projektname setzen
    const nameInput = page.locator('input[placeholder*="Baustelle"]');
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

    // 3) Projekt-Assets -> Dummy -> AssetLab
    await clickMenu(page, ff, /Projekt-Assets/i);
    await expect(page.getByRole("heading", { name: /Projekt-Assets/i })).toBeVisible({ timeout: 30_000 });

    const addDummy = page.getByRole("button", { name: /\+ Dummy-Asset/i });
    await expect(addDummy).toBeVisible({ timeout: 30_000 });
    await addDummy.click();
    await ff.throwIfFatal("click + Dummy-Asset");

    await expect(page.locator("#view")).toContainText(/Dummy Asset/i, { timeout: 30_000 });

    // Slot-UI sollte sichtbar sein (Variante 1 + Export Buttons)
    await expect(page.getByText(/Slot:/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Export GLB/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Export GLTF/i }).first()).toBeVisible({ timeout: 30_000 });

    const openInAssetLab = page.getByRole("button", { name: /In AssetLab öffnen/i }).first();
    await expect(openInAssetLab).toBeVisible({ timeout: 30_000 });
    await openInAssetLab.click();
    await ff.throwIfFatal("click In AssetLab öffnen");

    // 4) AssetLab sichtbar + Kontext
    await expect(page.getByRole("heading", { name: /AssetLab 3D/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#view")).toContainText(/PA-/, { timeout: 30_000 });

  } catch (err) {
    // Artefakte immer anheften
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
