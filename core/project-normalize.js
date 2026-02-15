/**
 * core/project-normalize.js
 * Version: v1.0.0 (2026-02-15)
 *
 * Ziel:
 * - normalizeProject(project): ergänzt fehlende Felder + Defaults
 * - normalizeState(state): optional, wenn du Snapshot/Import normalisieren willst
 *
 * WICHTIG:
 * - Keine Nebenwirkungen außerhalb des zurückgegebenen Objekts (pure-ish).
 * - Du kannst es “in place” verwenden, aber safer ist “clone + normalize”.
 */

function uid(prefix = "ID") {
  // simple, deterministic genug für lokale Nutzung
  return `${prefix}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }

export function normalizeProject(input) {
  const p = isObj(input) ? input : {};

  // Grundstruktur
  if (!p.schema) p.schema = "baustellenplaner.project.v1";
  if (!p.id) p.id = uid("P");
  if (!p.name) p.name = "Neues Projekt";
  if (!p.type) p.type = "industriebau";
  if (!p.timezone) p.timezone = "Europe/Berlin";
  if (!p.units) p.units = "metric";
  if (!p.version) p.version = "1.0.0";
  if (!p.createdAt) p.createdAt = new Date().toISOString();
  if (!p.uiPreset) p.uiPreset = "standard";
  if (!Array.isArray(p.modules)) p.modules = ["core"];

  // Assets container (alt/neu)
  if (!isObj(p.assets)) p.assets = {};
  if (!Array.isArray(p.assets.items)) p.assets.items = [];
  if (!Array.isArray(p.assets.folders)) p.assets.folders = [];
  if (!isObj(p.assets.settings)) p.assets.settings = {};

  // Felder, die bei dir existieren (optional)
  if (p.customer == null) p.customer = "";
  if (p.location == null) p.location = "";

  // Projekt-Assets (dein aktueller Schwerpunkt)
  if (!Array.isArray(p.projectAssets)) p.projectAssets = [];

  for (const a of p.projectAssets) {
    if (!isObj(a)) continue;

    if (!a.id) a.id = uid("PA");
    if (!a.name) a.name = "Asset";
    if (!isObj(a.source)) a.source = { kind: "upload", note: "" };

    if (!Array.isArray(a.slots)) a.slots = [];

    // presetTransform Default (falls ihr das nutzen wollt)
    // Defaults: neutral (0 offset, 1 scale, 0 rotation)
    if (!isObj(a.presetTransform)) {
      a.presetTransform = { sx: 1, sy: 1, sz: 1, ryDeg: 0, ox: 0, oy: 0, oz: 0 };
    } else {
      if (a.presetTransform.sx == null) a.presetTransform.sx = 1;
      if (a.presetTransform.sy == null) a.presetTransform.sy = 1;
      if (a.presetTransform.sz == null) a.presetTransform.sz = 1;
      if (a.presetTransform.ryDeg == null) a.presetTransform.ryDeg = 0;
      if (a.presetTransform.ox == null) a.presetTransform.ox = 0;
      if (a.presetTransform.oy == null) a.presetTransform.oy = 0;
      if (a.presetTransform.oz == null) a.presetTransform.oz = 0;
    }

    for (const s of a.slots) {
      if (!isObj(s)) continue;

      if (!s.id) s.id = uid("PS");
      if (!s.name) s.name = "Variante";

      // Model holder
      if (s.model === undefined) s.model = null;
      if (s.exportRef === undefined) s.exportRef = null;

      // UI-Preset pro Slot (das nutzt dein Assets Panel)
      if (!isObj(s.preset)) s.preset = {};
      if (s.preset.scale == null) s.preset.scale = 1;
      if (s.preset.rotY == null) s.preset.rotY = 0;
      if (s.preset.offsetY == null) s.preset.offsetY = 0;

      // Flags/Meta
      if (s.hasModel == null) s.hasModel = !!s.model;
      if (s.lastImportName == null) s.lastImportName = "";
      if (s.updatedAt == null) s.updatedAt = "";
      if (s.lastAction == null) s.lastAction = "";
    }

    // Wenn ein Asset keine Slots hat, gib ihm 1 Default-Slot (optional)
    if (a.slots.length === 0) {
      a.slots.push({
        id: uid("PS"),
        name: "Variante 1",
        model: null,
        preset: { scale: 1, rotY: 0, offsetY: 0 },
        hasModel: false,
        lastImportName: "",
        updatedAt: "",
        lastAction: "",
        exportRef: null
      });
    }
  }

  return p;
}
