/**
 * scripts/manifest-check.mjs
 * Version: v1.0.0 (2026-02-08)
 *
 * Prüft die Plugin-/Menüverdrahtung statisch:
 * - manifest-pack.json existiert und ist parsebar
 * - alle Plugin-Pfade existieren
 * - pluginId einzigartig
 * - menuEntries haben anchor/tabId/title
 * - Kombination anchor:tabId einzigartig (damit kein Menü-Eintrag den anderen überschreibt)
 * - für projectPanel-Einträge: PanelRegistry hat register("projectPanel", "<tabId>")
 *
 * Ausgabe:
 * - GitHub Actions Annotations (file/line soweit möglich)
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PACK_PATH = path.join(ROOT, 'manifest-pack.json');
const PANEL_REG_PATH = path.join(ROOT, 'ui', 'panels', 'panel-registry.js');

function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`⚠️ ${msg}`);
}

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8');
  try { return JSON.parse(raw); } catch (e) {
    die(`JSON parse failed: ${path.relative(ROOT, file)} (${String(e?.message || e)})`);
  }
}

function ghError(fileRel, message) {
  // line/col sind hier schwer statisch zu bestimmen; wir annotieren wenigstens file
  console.log(`::error file=${fileRel}::${message}`);
}

function collectProjectPanelTabIds() {
  if (!fs.existsSync(PANEL_REG_PATH)) return new Set();
  const src = fs.readFileSync(PANEL_REG_PATH, 'utf8');
  const out = new Set();
  // sehr bewusst "dumm": wir wollen nicht parsen, sondern nur robust finden
  // Muster: register("projectPanel", "wizard", ...)
  const rx = /register\(\s*['"]projectPanel['"]\s*,\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = rx.exec(src))) {
    out.add(m[1]);
  }
  return out;
}

if (!fs.existsSync(PACK_PATH)) {
  die('manifest-pack.json fehlt im Repo-Root.');
}

const pack = readJson(PACK_PATH);
const pluginPaths = Array.isArray(pack?.plugins) ? pack.plugins : [];

if (!pluginPaths.length) {
  die('manifest-pack.json enthält keine plugins[].');
}

const projectPanelTabs = collectProjectPanelTabIds();
if (!projectPanelTabs.size) {
  warn('Konnte keine projectPanel-Registrierungen aus ui/panels/panel-registry.js extrahieren (oder Datei fehlt).');
}

const seenPluginIds = new Set();
const seenMenuKeys = new Set();

let errors = 0;

for (const rel of pluginPaths) {
  const file = path.join(ROOT, rel);
  const relNorm = rel.replace(/\\/g, '/');

  if (!fs.existsSync(file)) {
    errors++;
    ghError('manifest-pack.json', `Plugin-Datei fehlt: ${relNorm}`);
    continue;
  }

  const plugin = readJson(file);

  // pluginId
  const pid = String(plugin?.pluginId || '').trim();
  if (!pid) {
    errors++;
    ghError(relNorm, 'pluginId fehlt oder ist leer.');
  } else {
    if (seenPluginIds.has(pid)) {
      errors++;
      ghError(relNorm, `pluginId ist doppelt: ${pid}`);
    }
    seenPluginIds.add(pid);
  }

  const entries = plugin?.ui?.menuEntries;
  if (!Array.isArray(entries)) continue;

  for (const e of entries) {
    const anchor = String(e?.anchor || '').trim();
    const tabId = String(e?.tabId || '').trim();
    const title = String(e?.title || '').trim();

    if (!anchor || !tabId || !title) {
      errors++;
      ghError(relNorm, `menuEntry unvollständig: anchor/tabId/title müssen gesetzt sein (got anchor="${anchor}" tabId="${tabId}" title="${title}")`);
      continue;
    }

    const key = `${anchor}:${tabId}`;
    if (seenMenuKeys.has(key)) {
      errors++;
      ghError(relNorm, `menuEntry-Key ist doppelt (überschreibt Menü): ${key}`);
    }
    seenMenuKeys.add(key);

    // Wiring-Regel: Alles, was im projectPanel auftaucht, muss als echtes Panel existieren.
    if (anchor === 'projectPanel' && projectPanelTabs.size) {
      if (!projectPanelTabs.has(tabId)) {
        errors++;
        ghError(relNorm, `projectPanel:"${tabId}" ist im Menü, aber NICHT in ui/panels/panel-registry.js registriert.`);
      }
    }
  }
}

if (errors > 0) {
  console.error(`❌ Manifest-Check failed: ${errors} Problem(e).`);
  process.exit(1);
}

console.log(`✅ Manifest-Check ok: ${pluginPaths.length} Plugin-Dateien, ${seenPluginIds.size} pluginId(s), ${seenMenuKeys.size} menuEntry(s).`);
