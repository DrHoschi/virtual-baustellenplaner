/**
 * core/persist/app-persist.js
 * Version: v1.1.0-wizard-interfaces-v1 (2026-02-05)
 *
 * Zentrale Persistenz-Schicht für den Baustellenplaner (Browser-only).
 *
 * Design-Ziele:
 * - Store ist Single Source of Truth (in-memory) → Persistor spiegelt in localStorage
 * - Trennung:
 *    - ProjectState ("project")  → fachliche Daten + Settings + Meta
 *    - UIState      ("ui")       → Layout/Inspector/Drafts
 *
 * Wichtig:
 * - Static Hosting: Wir können keine Dateien im Repo überschreiben.
 * - Deshalb speichern wir Änderungen pro Projekt-ID in localStorage.
 * - "Export" (Download ZIP/JSON) ist ein separater Workflow.
 */

/* ------------------------------------------------------------
 * Safe JSON helpers
 * ---------------------------------------------------------- */

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function safeJsonStringify(obj) {
  try { return JSON.stringify(obj); } catch { return null; }
}

/* ------------------------------------------------------------
 * Key-Konvention
 * ---------------------------------------------------------- */

function kProject(projectId) {
  return `baustellenplaner:project:${projectId}`;
}

function kUI(projectId) {
  return `baustellenplaner:ui:${projectId}`;
}

function kIndex() {
  return "baustellenplaner:index:projects";
}

/* ------------------------------------------------------------
 * Default Builder (minimal, aber stabil)
 * ---------------------------------------------------------- */

function nowIso() {
  try { return new Date().toISOString(); } catch { return ""; }
}

function makeProjectId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `P-${yyyy}-${rnd}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load JSON: ${url} (${res.status})`);
  return await res.json();
}

function deepMerge(a, b) {
  if (a == null) return structuredClone(b);
  if (b == null) return structuredClone(a);
  if (Array.isArray(a) || Array.isArray(b)) return structuredClone(b);
  if (typeof a !== "object" || typeof b !== "object") return structuredClone(b);
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (k in out) out[k] = deepMerge(out[k], v);
    else out[k] = structuredClone(v);
  }
  return out;
}

function buildInitialUIState({ initialPanelId = "project.wizard" } = {}) {
  return {
    layout: {
      activePanelId: initialPanelId,
      panelSizes: {},
      collapsed: { snapshot: true }
    },
    inspector: {
      tabOrder: [],
      openTabs: [],
      filters: {},
      snapshotCollapsed: true
    },
    draft: {
      formDraftsByPanel: {}
    }
  };
}

async function buildInitialProjectState({
  id,
  name,
  type,
  templateKey,
  uiPreset,
  modules
} = {}) {
  // Defaults laden (Template)
  // Hinweis: Das Repo hat bereits mehrere defaults/projectSettings.*.json.
  // Wir merge'n minimal: general/workspace/... + template
  const DEFAULT_SETTINGS_PATHS = [
    "defaults/appSettings.ui.json",
    "defaults/projectSettings.general.json",
    "defaults/projectSettings.workspace.json",
    "defaults/projectSettings.assets.json",
    "defaults/projectSettings.plugins.json"
  ];

  const templatePath = templateKey ? `defaults/projectSettings.${templateKey}.json` : null;

  let settings = {};
  for (const p of DEFAULT_SETTINGS_PATHS) settings = deepMerge(settings, await fetchJson(p));
  if (templatePath) settings = deepMerge(settings, await fetchJson(templatePath));

  const projectJson = {
    // Das ist weiterhin kompatibel zu core/loader.js (project.json als "Config")
    id,
    name,
    type: type || "industriebau",
    timezone: "Europe/Berlin",
    units: "metric",
    createdAt: nowIso(),
    version: "1.0.0",

    // Wizard
    uiPreset: uiPreset || "standard",
    templateKey: templateKey || "structure",

    // Module & Plugins
    modules: Array.isArray(modules) && modules.length ? modules : ["core", "layout"],
    pluginPack: "manifest-pack.json",

    // Settings: wir speichern als Snapshot (merge der Defaults). Overrides können später ergänzt werden.
    settingsDefaults: [],
    settingsOverrides: []
  };

  return {
    schema: "baustellenplaner.state.project.v1",
    meta: {
      id,
      name,
      createdAt: projectJson.createdAt,
      updatedAt: projectJson.createdAt,
      templateKey: projectJson.templateKey,
      uiPreset: projectJson.uiPreset,
      version: projectJson.version
    },

    // project.json-äquivalente Config (Loader-kompatibel)
    project: projectJson,

    // gemergte Settings (Editor verändert diese)
    settings,

    // fachliche Daten (hier starten wir leer)
    model: {
      areas: [],
      objects: [],
      routes: [],
      modules: {}
    },

    runtimeHints: {
      lastOpenPanel: "project.general",
      flags: {}
    }
  };
}

/* ------------------------------------------------------------
 * Public API
 * ---------------------------------------------------------- */

export function createAppPersistor({ bus, store } = {}) {
  let unsub = null;
  let t = null;

  function readProjectState(projectId) {
    const raw = localStorage.getItem(kProject(projectId));
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  }

  function readUIState(projectId) {
    const raw = localStorage.getItem(kUI(projectId));
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  }

  function writeProjectState(projectId, projectState) {
    const txt = safeJsonStringify(projectState);
    if (!txt) return false;
    localStorage.setItem(kProject(projectId), txt);
    return true;
  }

  function writeUIState(projectId, uiState) {
    const txt = safeJsonStringify(uiState);
    if (!txt) return false;
    localStorage.setItem(kUI(projectId), txt);
    return true;
  }

  function _readIndex() {
    const raw = localStorage.getItem(kIndex());
    const parsed = raw ? safeJsonParse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  }

  function _writeIndex(list) {
    const txt = safeJsonStringify(list);
    if (!txt) return;
    localStorage.setItem(kIndex(), txt);
  }

  function rememberProjectInIndex({ id, name, createdAt }) {
    const list = _readIndex();
    const existing = list.find((x) => x && x.id === id);
    if (existing) {
      existing.name = name;
      existing.updatedAt = nowIso();
      _writeIndex(list);
      return;
    }
    list.unshift({ id, name, createdAt, updatedAt: nowIso() });
    _writeIndex(list);
  }

  /**
   * Lädt persistierte Overrides für Store-Keys "project" & "ui".
   * - Gibt { projectState, uiState } zurück (oder null)
   */
  function load({ projectId } = {}) {
    if (!projectId) return { projectState: null, uiState: null };
    return {
      projectState: readProjectState(projectId),
      uiState: readUIState(projectId)
    };
  }

  /**
   * Speichert aktuellen Store-Stand sofort.
   */
  function saveNow({ projectId } = {}) {
    if (!store) return;
    if (!projectId) return;

    const projectState = store.get("project");
    const uiState = store.get("ui");

    const okP = projectState ? writeProjectState(projectId, projectState) : true;
    const okU = uiState ? writeUIState(projectId, uiState) : true;

    if (bus) {
      bus.emit("cb:persist:status", {
        ok: !!(okP && okU),
        projectId,
        savedAt: nowIso()
      });
    }
  }

  function scheduleSave(projectId) {
    if (t) clearTimeout(t);
    t = setTimeout(() => saveNow({ projectId }), 250);
  }

  /**
   * Aktiviert AutoSave:
   * - reagiert auf cb:store:changed
   * - speichert nur, wenn "project" oder "ui" geändert wurden
   */
  function enableAutosave({ projectId } = {}) {
    if (!bus) return;
    if (!projectId) return;
    if (unsub) return;

    unsub = bus.on("cb:store:changed", ({ key }) => {
      if (key !== "project" && key !== "ui") return;
      scheduleSave(projectId);
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

  /**
   * Erstellt ein neues Projekt aus einem Template und persistiert es sofort.
   * Rückgabe: { id, projectState, uiState }
   */
  async function createProject({ templateKey, name, type, uiPreset, modules } = {}) {
    const id = makeProjectId();
    const pname = String(name || "").trim() || id;

    const projectState = await buildInitialProjectState({
      id,
      name: pname,
      type,
      templateKey,
      uiPreset,
      modules
    });

    const uiState = buildInitialUIState({ initialPanelId: "project.general" });

    // Persist sofort
    writeProjectState(id, projectState);
    writeUIState(id, uiState);
    rememberProjectInIndex({ id, name: pname, createdAt: projectState?.meta?.createdAt || nowIso() });

    return { id, projectState, uiState };
  }

  return {
    // keys
    kProject,
    kUI,
    kIndex,

    // read/write
    load,
    saveNow,
    enableAutosave,
    disableAutosave,

    // wizard
    createProject,

    // direct reads (debug)
    readProjectState,
    readUIState
  };
}
