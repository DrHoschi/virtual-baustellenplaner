/**
 * core/project-normalize.js
 * Version: v1.0.0-lifecycle-normalize (2026-02-15)
 *
 * Ziel:
 * - Defensive Defaults für Project-JSON.
 * - Panels dürfen sich nicht darauf verlassen, dass alle Felder existieren.
 *
 * Hinweis:
 * - Wir mutieren das Objekt NICHT; wir geben eine neue, normalisierte Kopie zurück.
 * - Damit bleibt Debugging stabil (keine unerwarteten Side-Effects).
 */

function isObj(x) {
  return !!x && typeof x === "object";
}

function cloneShallow(o) {
  return isObj(o) ? { ...o } : {};
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeSlot(slotIn, idx) {
  const slot = cloneShallow(slotIn);
  slot.id = typeof slot.id === "string" && slot.id ? slot.id : `PS-auto-${idx}-${Date.now()}`;
  slot.name = typeof slot.name === "string" && slot.name ? slot.name : `Variante ${idx + 1}`;
  slot.model = slot.model ?? null;
  slot.exportRef = slot.exportRef ?? null;
  slot.lastImportName = typeof slot.lastImportName === "string" ? slot.lastImportName : "";
  slot.updatedAt = typeof slot.updatedAt === "string" ? slot.updatedAt : "";
  slot.lastAction = typeof slot.lastAction === "string" ? slot.lastAction : "";
  slot.hasModel = typeof slot.hasModel === "boolean" ? slot.hasModel : !!slot.model;

  // "preset" ist historisch (scale/rotY/offsetY) – wir halten es stabil.
  const preset = cloneShallow(slot.preset);
  preset.scale = Number.isFinite(preset.scale) ? preset.scale : 1;
  preset.rotY = Number.isFinite(preset.rotY) ? preset.rotY : 0;
  preset.offsetY = Number.isFinite(preset.offsetY) ? preset.offsetY : 0;
  slot.preset = preset;

  return slot;
}

function normalizeProjectAsset(paIn, idx) {
  const pa = cloneShallow(paIn);
  pa.id = typeof pa.id === "string" && pa.id ? pa.id : `PA-auto-${idx}-${Date.now()}`;
  pa.name = typeof pa.name === "string" && pa.name ? pa.name : "Asset";
  pa.source = isObj(pa.source) ? pa.source : { kind: "unknown" };

  const slotsIn = ensureArray(pa.slots);
  pa.slots = slotsIn.length ? slotsIn.map(normalizeSlot) : [normalizeSlot({}, 0)];

  // Neu: presetTransform (globaler Transform für das Asset)
  // Default so, dass oz=1 erhalten bleibt (0 hat in einigen Flows zu "unsichtbar" geführt).
  const pt = cloneShallow(pa.presetTransform);
  pa.presetTransform = {
    sx: Number.isFinite(pt.sx) ? pt.sx : 1,
    sy: Number.isFinite(pt.sy) ? pt.sy : 1,
    sz: Number.isFinite(pt.sz) ? pt.sz : 1,
    rxDeg: Number.isFinite(pt.rxDeg) ? pt.rxDeg : 0,
    ryDeg: Number.isFinite(pt.ryDeg) ? pt.ryDeg : 0,
    rzDeg: Number.isFinite(pt.rzDeg) ? pt.rzDeg : 0,
    ox: Number.isFinite(pt.ox) ? pt.ox : 0,
    oy: Number.isFinite(pt.oy) ? pt.oy : 0,
    oz: Number.isFinite(pt.oz) ? pt.oz : 1,
  };

  return pa;
}

/**
 * normalizeProject(project)
 * - ergänzt fehlende Felder (projectAssets, slots, presetTransform defaults)
 */
export function normalizeProject(projectIn) {
  const project = cloneShallow(projectIn);

  // Schema / Basisfelder
  project.schema = typeof project.schema === "string" && project.schema ? project.schema : "baustellenplaner.project.v1";
  project.id = typeof project.id === "string" && project.id ? project.id : `P-auto-${Date.now()}`;
  project.name = typeof project.name === "string" ? project.name : "";
  project.type = typeof project.type === "string" ? project.type : "";
  project.timezone = typeof project.timezone === "string" ? project.timezone : "Europe/Berlin";
  project.units = typeof project.units === "string" ? project.units : "metric";
  project.version = typeof project.version === "string" ? project.version : "1.0.0";
  project.createdAt = typeof project.createdAt === "string" && project.createdAt ? project.createdAt : new Date().toISOString();
  project.uiPreset = typeof project.uiPreset === "string" ? project.uiPreset : "standard";
  project.modules = ensureArray(project.modules);

  project.assets = isObj(project.assets) ? project.assets : { items: [], folders: [], settings: {} };
  project.assets.items = ensureArray(project.assets.items);
  project.assets.folders = ensureArray(project.assets.folders);
  project.assets.settings = isObj(project.assets.settings) ? project.assets.settings : {};

  project.customer = typeof project.customer === "string" ? project.customer : "";
  project.location = typeof project.location === "string" ? project.location : "";

  const paIn = ensureArray(project.projectAssets);
  project.projectAssets = paIn.map(normalizeProjectAsset);

  return project;
}
