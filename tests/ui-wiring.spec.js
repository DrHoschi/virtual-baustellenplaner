// tests/ui-wiring.spec.js
// Version: v1.5.1-baseurl-fix (2026-02-08)
//
// Fix:
// - Playwright page.goto("./index.html") / "/index.html" ist in CI oft "invalid URL",
//   wenn KEIN baseURL gesetzt ist (page startet bei about:blank).
// - Daher: baseURL aus Playwright config (use.baseURL) ODER ENV (PLAYWRIGHT_BASE_URL)
//   und URL sauber über new URL("index.html", baseURL) bilden.
//
// Erwartet im CI:
// - playwright.config.* setzt use.baseURL UND startet einen webServer
//   ODER der Workflow exportiert PLAYWRIGHT_BASE_URL passend zum Webserver.
//
// Beispiel:
//   use: { baseURL: "http://127.0.0.1:4173" }
//   webServer: { command: "npx http-server -p 4173 -c-1 .", url: "http://127.0.0.1:4173" }

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
 * BaseURL Helper
 * -------------------------------------------------------------------------- */

function getBaseURL(testInfo) {
  // 1) ENV Override (praktisch für GH Actions)
  const env = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL;
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/$/, "") + "/";

  // 2) Playwright config: use.baseURL
  const cfg = testInfo?.project?.use?.baseURL;
  if (cfg && /^https?:\/\//i.test(cfg)) return cfg.replace(/\/$/, "") + "/";

  // 3) Fail fast mit klarer Diagnose
  throw new Error(
    "Playwright baseURL fehlt. Setze in playwright.config.* unter use.baseURL z.B. " +
      '"http://127.0.0.1:4173" ODER exportiere PLAYWRIGHT_BASE_URL im Workflow.'
  );
}

/* -----------------------------------------------------------------------------
 * Boot / UI Helpers
 * -------------------------------------------------------------------------- */

async function waitForBoot(page, ff, testInfo) {
  const baseURL = getBaseURL(testInfo);
  const url = new URL("index.html", baseURL).toString();

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await ff.throwIfFatal(`page.goto(${url})`);

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

test("UI Wiring: Wizard -> Projektliste -> Projekt-Assets -> AssetLab", async ({ page }, testInfo) => {
  const ff = installFailFast(page);

  try {
    await waitForBoot(page, ff, testInfo);

    await clickMenu(page, ff, /Neu \(Wizard\)/i);
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
    await ff.throwIfFatal("waitForURL(project=local)");

    await clickMenu(page, ff, /Projektliste/i);
    await expect(page.getByRole("heading", { name: /Projektliste/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#view")).toContainText(/P-\d{4}-\d{4}/, { timeout: 30_000 });

    await clickMenu(page, ff, /Projekt-Assets/i);
    await expect(page.getByRole("heading", { name: /Projekt-Assets/i })).toBeVisible({ timeout: 30_000 });

    const addDummy = page.getByRole("button", { name: /\+ Dummy-Asset/i });
    await expect(addDummy).toBeVisible({ timeout: 30_000 });
    await addDummy.click();
    await ff.throwIfFatal("click + Dummy-Asset");

    await expect(page.locator("#view")).toContainText(/Dummy Asset/i, { timeout: 30_000 });

    const openInAssetLab = page.getByRole("button", { name: /In AssetLab öffnen/i }).first();
    await expect(openInAssetLab).toBeVisible({ timeout: 30_000 });
    await openInAssetLab.click();
    await ff.throwIfFatal("click In AssetLab öffnen");

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
