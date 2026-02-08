/**
 * tests/smoke.spec.js
 * -----------------------------------------------------------------------------
 * Smoke-Test (Playwright):
 *   - Startet einen kleinen Static-Server (Repo-Root)
 *   - Öffnet /index.html
 *   - Failt bei:
 *       * pageerror (uncaught)
 *       * console.error
 *       * fehlenden Basis-Elementen (#menu, #view)
 *       * "Aktives Modul" bleibt dauerhaft "(lädt...)" (best effort)
 *
 * Ziel:
 *   "Blank Screen" / kaputter Loader / kaputte Imports schnell erkennen.
 * -----------------------------------------------------------------------------
 */

const { test, expect } = require("@playwright/test");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

function contentType(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".woff") return "font/woff";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);

      if (pathname === "/") pathname = "/index.html";

      const filePath = path.join(rootDir, pathname);

      // Sicherheitsgurt: verhindere Directory-Traversal
      if (!filePath.startsWith(rootDir)) {
        res.statusCode = 403;
        return res.end("Forbidden");
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.statusCode = 404;
          return res.end("Not found");
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", contentType(filePath));
        res.end(data);
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

test("Baustellenplaner loads without fatal errors", async ({ page }) => {
  const rootDir = process.cwd();
  const { server, port } = await startStaticServer(rootDir);

  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  page.on("pageerror", (err) => {
    pageErrors.push(String(err));
  });

  // Cache aus + deterministic
  await page.route("**/*", (route) => {
    route.continue({ headers: { ...route.request().headers(), "cache-control": "no-store" } });
  });

  const url = `http://127.0.0.1:${port}/index.html?ci=1`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Basis-Elemente müssen existieren
  await expect(page.locator("#menu")).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator("#view")).toHaveCount(1, { timeout: 5000 });

  // Best-effort: "active" sollte nicht ewig "(lädt...)" bleiben
  // (Wenn eure App bewusst so bleibt, könnt ihr diese Expectation lockern/entfernen.)
  const active = page.locator("#active");
  await expect(active).toHaveCount(1);

  // Wir geben dem Loader etwas Zeit (ESM + Imports)
  await page.waitForTimeout(2500);

  // Falls es weiterhin "(lädt...)" ist, ist das ein Warnsignal – wir failen aber nur,
  // wenn zusätzlich Errors vorhanden sind. So bleibt der Test robust.
  const activeText = (await active.textContent()) || "";

  // Harte Kriterien: Errors -> fail
  if (pageErrors.length) {
    server.close();
    throw new Error("pageerror(s):\n" + pageErrors.join("\n"));
  }
  if (consoleErrors.length) {
    server.close();
    throw new Error("console.error(s):\n" + consoleErrors.join("\n"));
  }

  // Soft-check: Loader hängt fest
  // -> wir FAILEN nur, wenn wirklich exakt "(lädt...)" drin steht (wie in eurer index.html)
  if (activeText.includes("(lädt...)")) {
    server.close();
    throw new Error('Smoke-Test: #active ist nach 2.5s noch "(lädt...)" → Loader hängt / Import-Kette kaputt?');
  }

  server.close();
});
