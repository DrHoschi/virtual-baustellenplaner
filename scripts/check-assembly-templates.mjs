#!/usr/bin/env node
/*
 * Prüft die Assembly-Template-Datei auf grundlegende Konsistenz.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "data", "assembly-templates.v1.json");

function fail(message) {
  console.error(`[assembly-check] ERROR: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(file)) {
  fail(`Missing file: ${file}`);
  process.exit();
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const templates = Array.isArray(data.templates) ? data.templates : [];

if (!templates.length) {
  fail("No templates found.");
}

const templateIds = new Set();

for (const tpl of templates) {
  if (!tpl.id) fail("Template without id.");
  if (templateIds.has(tpl.id)) fail(`Duplicate template id: ${tpl.id}`);
  templateIds.add(tpl.id);

  const componentIds = new Set((tpl.components || []).map((c) => c.id));
  const portIds = new Set((tpl.ports || []).map((p) => p.id));

  for (const c of tpl.components || []) {
    if (!c.id) fail(`Component without id in ${tpl.id}`);
  }

  for (const p of tpl.ports || []) {
    if (!p.id) fail(`Port without id in ${tpl.id}`);
    if (p.componentId && !componentIds.has(p.componentId)) {
      fail(`Port '${p.id}' in '${tpl.id}' references unknown component '${p.componentId}'.`);
    }
  }

  const variants = tpl.variants || [];
  if (!variants.length) fail(`Template '${tpl.id}' has no variants.`);

  if (tpl.defaultVariantId && !variants.some((v) => v.id === tpl.defaultVariantId)) {
    fail(`Template '${tpl.id}' defaultVariantId '${tpl.defaultVariantId}' not found.`);
  }

  for (const v of variants) {
    if (!v.id) fail(`Variant without id in ${tpl.id}`);
    for (const cid of v.enabledComponents || []) {
      if (!componentIds.has(cid)) fail(`Variant '${v.id}' in '${tpl.id}' enables unknown component '${cid}'.`);
    }
    for (const pid of v.enabledPorts || []) {
      if (!portIds.has(pid)) fail(`Variant '${v.id}' in '${tpl.id}' enables unknown port '${pid}'.`);
    }
  }
}

if (!process.exitCode) {
  console.log(`[assembly-check] OK: ${templates.length} templates checked.`);
}
