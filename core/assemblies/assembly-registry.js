/*
 * ============================================================================
 * DATEI: core/assemblies/assembly-registry.js
 * VERSION: v1.0.0-configurable-assemblies
 *
 * ZWECK:
 * - Lädt und verwaltet Assembly-Templates.
 * - Bietet einfache Suchfunktionen nach Familie, ID und Label.
 * ============================================================================
 */

import { normalizeAssemblyTemplate } from "./assembly-model.js";

export class AssemblyRegistry {
  constructor() {
    this._templates = new Map();
  }

  clear() {
    this._templates.clear();
  }

  registerTemplate(rawTemplate) {
    const template = normalizeAssemblyTemplate(rawTemplate);
    this._templates.set(template.id, template);
    return template;
  }

  registerMany(rawTemplates) {
    const list = Array.isArray(rawTemplates) ? rawTemplates : [];
    return list.map((tpl) => this.registerTemplate(tpl));
  }

  getTemplate(id) {
    return this._templates.get(id) || null;
  }

  listTemplates() {
    return Array.from(this._templates.values());
  }

  listByFamily(family) {
    return this.listTemplates().filter((tpl) => tpl.family === family);
  }

  search(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return this.listTemplates();

    return this.listTemplates().filter((tpl) => {
      return [tpl.id, tpl.label, tpl.family, tpl.description]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }
}

export async function loadAssemblyTemplatesFromUrl(url = "./data/assembly-templates.v1.json") {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Could not load assembly templates from ${url}: ${res.status}`);
  }
  const data = await res.json();
  const templates = Array.isArray(data.templates) ? data.templates : [];
  const registry = new AssemblyRegistry();
  registry.registerMany(templates);
  return registry;
}
