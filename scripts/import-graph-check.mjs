/**
 * scripts/import-graph-check.mjs
 * -----------------------------------------------------------------------------
 * Ziel:
 *   - Prüft alle relativen Imports (import ... from "./x.js", import("./x.js"))
 *   - Meldet Fehler, wenn das Ziel nicht existiert.
 *
 * Warum:
 *   Viele "Nichts wird angezeigt"-Fälle kommen nicht nur von Syntaxfehlern,
 *   sondern auch von kaputten Import-Pfaden nach Refactor/Move.
 *
 * Output:
 *   - GitHub Actions Annotations: ::error file=...,line=...::...
 * -----------------------------------------------------------------------------
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
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

function stripQueryHash(p) {
  return p.split("?")[0].split("#")[0];
}

/**
 * Sehr pragmatische Import-Erkennung:
 * - static:  import ... from "..."
 * - bare:    import "..."
 * - dynamic: import("...")
 *
 * Wir versuchen NICHT, JS komplett zu parsen (damit ohne deps lauffähig).
 */
function extractImports(code) {
  const out = [];

  // static/bare imports
  // import x from "y";
  // import {x} from 'y';
  // import "y";
  const rxStatic = /import\s+(?:[^'"\n;]+\s+from\s+)?["']([^"']+)["']/g;

  // dynamic import("y")
  const rxDyn = /import\(\s*["']([^"']+)["']\s*\)/g;

  let m;
  while ((m = rxStatic.exec(code))) out.push({ spec: m[1], index: m.index });
  while ((m = rxDyn.exec(code))) out.push({ spec: m[1], index: m.index });

  return out;
}

function indexToLineCol(code, index) {
  // 1-based line/col
  let line = 1;
  let col = 1;
  for (let i = 0; i < index && i < code.length; i++) {
    if (code[i] === "\n") { line++; col = 1; }
    else col++;
  }
  return { line, col };
}

/**
 * Resolving-Regeln (ESM pragmatisch):
 *  - wenn Import "./x.js" exakt existiert -> ok
 *  - wenn ohne ext: "./x" -> probiere .js, .mjs, .json
 *  - wenn Ordner: "./x/" oder "./x" ist Ordner -> probiere index.js / index.mjs
 */
function resolveTarget(fromFile, spec) {
  const cleaned = stripQueryHash(spec);

  // Nur relative/absolute Projektpfade prüfen
  const isRel = cleaned.startsWith("./") || cleaned.startsWith("../");
  const isAbs = cleaned.startsWith("/"); // projekt-root gemeint (bei euch selten, aber möglich)
  if (!isRel && !isAbs) return { kind: "skip" };

  const baseDir = path.dirname(fromFile);
  const start = isAbs ? path.join(ROOT, cleaned) : path.resolve(baseDir, cleaned);

  const candidates = [];

  // 1) direkt
  candidates.push(start);

  // 2) ohne Extension -> try known ext
  if (!path.extname(start)) {
    candidates.push(start + ".js");
    candidates.push(start + ".mjs");
    candidates.push(start + ".json");
  }

  // 3) directory -> index.*
  candidates.push(path.join(start, "index.js"));
  candidates.push(path.join(start, "index.mjs"));

  for (const c of candidates) {
    if (existsSync(c)) return { kind: "ok", resolved: c };
  }

  return { kind: "missing", tried: candidates };
}

const files = walk(ROOT).sort();

let failed = 0;
let checked = 0;

for (const f of files) {
  const code = readFileSync(f, "utf8");
  const imports = extractImports(code);

  for (const imp of imports) {
    const spec = imp.spec;
    const res = resolveTarget(f, spec);

    if (res.kind === "skip") continue;
    checked++;

    if (res.kind === "missing") {
      failed++;

      const relFile = path.relative(ROOT, f);
      const { line, col } = indexToLineCol(code, imp.index);

      const msg = `Import not found: "${spec}" (from ${relFile}).`;

      console.log(`::error file=${relFile},line=${line},col=${col}::${msg}`);
      // Debug im Log: was wurde versucht?
      console.log(`Tried: ${res.tried.map(p => path.relative(ROOT, p)).join(" | ")}`);
    }
  }
}

console.log(`Import-Graph: checked ${checked} relative imports.`);

if (failed > 0) {
  console.error(`❌ Import-Graph check failed: ${failed} missing import(s).`);
  process.exit(1);
} else {
  console.log("✅ Import-Graph check passed.");
}
