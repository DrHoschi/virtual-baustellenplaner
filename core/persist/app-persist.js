/**
 * core/persist/app-persist.js
 * Version: v1.1.0-hardcut-modular-v3.2+sync (2026-02-15)
 *
 * Zentrale Persistenz-Schicht für den Baustellenplaner (Browser-only).
 *
 * Ziele dieses Patches:
 * 1) normalizeProject(project): ergänzt fehlende Felder (projectAssets, slots, presetTransform defaults)
 * 2) syncProjectRoot(state): sorgt dafür, dass state.project und state.app.project NICHT auseinanderlaufen
 *    -> eine Richtung: app.project ist Master, project ist nur Spiegel/Kompatibilität
 * 3) single write path: Speichern immer nur aus EINER Quelle (app.project)
 *
 * Wichtig:
 * - Wir ändern das Persist-Format NICHT radikal (Abwärtskompatibilität).
 * - Wir persistieren weiterhin { project, settings, ui.drafts, _meta }.
 * - Aber: "project" wird IMMER aus app.project abgeleitet (Master).
 */

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function safeJsonStringify(obj) {
  try { return JSON.stringify(obj); } catch { return null; }
}

/* ========================================================================== */
/*  Normalizer (lokal, bewusst ohne Imports -> robust in GitHub Pages)         */
/* ========================================================================== */

function isObj(x) { return !!x && typeof x === "object" && !Array.isArray(x); }

function uid(prefix = "ID") {
  return `${prefix}-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

/**
 * Ergänzt fehlende Felder/Defaults direkt am Objekt.
 * (Wir nutzen bewusst "in-place", weil es aus Store kommt und wir konsistent bleiben wollen.)
 */
function normalizeProject(project, { ensureDefaultSlot = true } = {}) {
  const p = isObj(project) ? project : {};

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

  // Assets container
  if (!isObj(p.assets)) p.assets = {};
  if (!Array.isArray(p.assets.items)) p.assets.items = [];
  if (!Array.isArray(p.assets.folders)) p.assets.folders = [];
  if (!isObj(p.assets.settings)) p.assets.settings = {};

  // optionale Felder (werden oft in Snapshots erwartet)
  if (p.customer == null) p.customer = "";
  if (p.location == null) p.location = "";

  // Projekt-Assets (neu)
  if (!Array.isArray(p.projectAssets)) p.projectAssets = [];

  for (const a of p.projectAssets) {
    if (!isObj(a)) continue;

    if (!a.id) a.id = uid("PA");
    if (!a.name) a.name = "Asset";
    if (!isObj(a.source)) a.source = { kind: "upload", note: "" };

    // Slots
    if (!Array.isArray(a.slots)) a.slots = [];

    // presetTransform (Asset-Default)
    // Defaults neutral: offsets 0, rotation 0, scales 1
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

      // Model holders
      if (s.model === undefined) s.model = null;
      if (s.exportRef === undefined) s.exportRef = null;

      // Slot-Preset (UI-Controls)
      if (!isObj(s.preset)) s.preset = {};
      if (s.preset.scale == null) s.preset.scale = 1;
      if (s.preset.rotY == null) s.preset.rotY = 0;
      if (s.preset.offsetY == null) s.preset.offsetY = 0;

      // Meta/Flags
      if (s.hasModel == null) s.hasModel = !!s.model;
      if (s.lastImportName == null) s.lastImportName = "";
      if (s.updatedAt == null) s.updatedAt = "";
      if (s.lastAction == null) s.lastAction = "";
    }

    // Optional: mind. 1 Slot sicherstellen (sonst UI/Editoren oft kaputt)
    if (ensureDefaultSlot && a.slots.length === 0) {
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

/**
 * Eine Richtung:
 * - app.project ist Master
 * - state.project ist nur Spiegel/Kompatibilität (wenn vorhanden)
 *
 * Wir mutieren "state" bewusst, damit "single source" bestehen bleibt.
 */
function syncProjectRoot(state) {
  if (!state || !isObj(state)) return state;
  if (!isObj(state.app)) state.app = {};

  // normalize Master
  state.app.project = normalizeProject(state.app.project || {});

  // Spiegel (nur für alte Stellen/Export-Kompatibilität)
  state.project = state.app.project;

  return state;
}

/* ========================================================================== */
/*  Persistor                                                                 */
/* ========================================================================== */

export function createAppPersistor({ bus, store, projectId }) {
  const key = `baustellenplaner:project:${projectId || "unknown"}`;

  let unsub = null;
  let t = null;

  function load() {
    const raw = localStorage.getItem(key);
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;

    // Abwärtskompatibilität:
    // - alt: { project, settings, ui:{drafts}, _meta }
    // - wir normalisieren und geben im selben Format zurück
    const out = parsed;

    // project normalisieren (und minimal "single source" herstellen)
    if (isObj(out.project)) {
      normalizeProject(out.project);
    } else {
      out.project = normalizeProject({});
    }

    // settings + ui.drafts absichern
    if (!isObj(out.settings)) out.settings = {};
    if (!isObj(out.ui)) out.ui = {};
    if (!isObj(out.ui.drafts)) out.ui.drafts = {};

    return out;
  }

  function saveNow() {
    if (!store) return;

    // Wir lesen bewusst NUR aus einem Objekt: app (Master)
    const app = store.get("app");
    if (!app || typeof app !== "object") return;

    // Single Source of Truth:
    // - Master: app.project
    // - normalize + sync (optional Spiegel)
    const stateLike = { app: app, project: null };
    syncProjectRoot(stateLike);

    // Optional: Wenn das Projekt auch im Store unter "project" existiert, spiegeln wir es
    // ABER nur, wenn store.set existiert. (Wenn das bei euch nicht gewünscht ist, einfach entfernen.)
    try {
      if (typeof store.set === "function") {
        // Hinweis: kann cb:store:changed triggern; in eurem Setup ist autosave aber entprellt (300ms)
        store.set("project", stateLike.project);
      }
    } catch {
      // bewusst ignorieren – Persist darf nicht crashen
    }

    const payload = {
      // --------------------------------------------------------
      // Persistiert wird: "project" als Snapshot von app.project (Master)
      // -> KEINE zweite Wahrheit, sondern nur Export/Restore-Struktur.
      // --------------------------------------------------------
      project: stateLike.app.project || {},
      settings: stateLike.app.settings || {},
      ui: {
        // Nur Drafts persistieren (keine DOM-States)
        drafts: (stateLike.app.ui && stateLike.app.ui.drafts) ? stateLike.app.ui.drafts : {}
      },
      _meta: {
        savedAt: new Date().toISOString(),
        projectId: projectId || "unknown",
        persistVersion: "v1.1.0",
        sourceOfTruth: "app.project"
      }
    };

    const txt = safeJsonStringify(payload);
    if (!txt) return;

    localStorage.setItem(key, txt);

    if (bus) bus.emit("cb:persist:saved", { key, meta: payload._meta });
  }

  function scheduleSave() {
    if (t) clearTimeout(t);
    t = setTimeout(() => saveNow(), 300);
  }

  function enableAutosave() {
    if (!bus) return;
    if (unsub) return;

    unsub = bus.on("cb:store:changed", ({ key: changedKey }) => {
      if (changedKey !== "app") return;
      scheduleSave();
    });
  }

  function disableAutosave() {
    if (unsub) {
      unsub();
      unsub = null;
    }
    if (t) {
      clearTimeout(t);
      t = null;
    }
  }

  return { key, load, saveNow, enableAutosave, disableAutosave };
}
