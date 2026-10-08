/**
 * scripts/syntax-check.mjs
 * -----------------------------------------------------------------------------
 * Prüft alle .js/.mjs Dateien auf Syntaxfehler via "node --check".
 * Gibt bei Fehlern GitHub Actions Annotations aus:
 *   ::error file=...,line=...,col=...::...
 *
 * Warum das wichtig ist:
 *   In eurem ESM-Setup kann EIN Syntaxfehler in irgendeinem importierten Modul
 *   den kompletten App-Start killen -> "Blank Screen".
 * -----------------------------------------------------------------------------
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  "vendor",
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".cache",
]);

const EXT_OK = new Set([".js", ".mjs"]);

function walk(dir, out = []) {
  const items = readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);

    if (it.isDirectory()) {
      if (IGNORE_DIRS.has(it.name)) continue;
      walk(full, out);
      continue;
    }

    if (it.isFile()) {
      const ext = path.extname(it.name).toLowerCase();
      if (EXT_OK.has(ext)) out.push(full);
    }
  }
  return out;
}

/**
 * Versucht aus node --check stderr Datei/Zeile/Spalte zu extrahieren.
 * Node-Ausgaben unterscheiden sich leicht, wir sind daher "tolerant".
 */
function parseNodeCheck(stderrText) {
  const lines = stderrText.split("\n");

  let file = null, line = null, col = null;
  let message = null;

  for (const l of lines) {
    if (l.includes("SyntaxError")) {
      message = l.trim();
      break;
    }
  }
  if (!message) message = lines.find(l => l.trim().length > 0)?.trim() ?? "Syntax error";

  // Kandidat: (optional file:///)-prefix, dann "... .js/.mjs : line (: col)"
  const rx = /(file:\/\/\/)?([^:\n]+?\.(?:m?js)):(\d+)(?::(\d+))?/i;

  for (const l of lines) {
    const m = l.match(rx);
    if (m) {
      file = m[2];
      line = Number(m[3]);
      col = m[4] ? Number(m[4]) : 1;
      break;
    }
  }

  if (file && file.startsWith("file:///")) file = file.replace("file:///", "/");

  return { file, line, col, message, raw: stderrText };
}

function checkFile(file) {
  const res = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.status === 0) return { ok: true };

  const parsed = parseNodeCheck(res.stderr || "");
  return { ok: false, file, ...parsed, stderr: res.stderr };
}

const files = walk(ROOT).sort();

let failed = 0;
console.log(`Checking ${files.length} JS files...`);

for (const f of files) {
  const rel = path.relative(ROOT, f);
  const r = checkFile(f);

  if (!r.ok) {
    failed++;

    const annoFile = r.file ? path.relative(ROOT, r.file) : rel;
    const annoLine = r.line ?? 1;
    const annoCol = r.col ?? 1;

    console.log(`::error file=${annoFile},line=${annoLine},col=${annoCol}::${r.message}`);

    console.log("----- node --check output -----");
    console.log((r.stderr || "").trim());
    console.log("--------------------------------");
  }
}

if (failed > 0) {
  console.error(`❌ Syntax check failed: ${failed} file(s) with errors.`);
  process.exit(1);
} else {
  console.log("✅ Syntax check passed.");
}
