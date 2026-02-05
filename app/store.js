/**
 * Baustellenplaner – App Store (Single Source of Truth)
 * Datei: app/store.js
 * Version: v1.1.0-wizard-interfaces-v1 (2026-02-05)
 *
 * Ziel (nach Wizard/State-Refactor):
 * - EIN Store als zentrale Wahrheit (in-memory)
 * - Zwei Haupt-States:
 *    - "project"  → ProjectState (fachlicher Inhalt + Settings + Meta)
 *    - "ui"       → UIState (Layout/Inspector/Drafts)
 * - Weitere Keys (z.B. "core", "layout") bleiben möglich.
 *
 * Event-Contract (Bus):
 * - Commands (Requests):
 *    - req:project:update  { path, value, op? }
 *    - req:ui:update       { path, value, op? }
 * - Callbacks:
 *    - cb:project:changed  { path, value, op, state }
 *    - cb:ui:changed       { path, value, op, state }
 *    - cb:store:changed    { key, state }
 *    - cb:store:inited     { key, state }
 *
 * Wichtig:
 * - Panels dürfen keinen "eigenen" Schatten-State besitzen.
 * - Tab-Wechsel ist egal → alles kommt aus Store.
 */

/* --------------------------------------------
 * Helpers
 * -------------------------------------------- */

function deepClone(obj) {
  // Für Blueprint absolut ausreichend (Plain JSON Strukturen)
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

function isObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Setzt einen Wert tief in ein Objekt.
 * @param {object} root
 * @param {string} path "a.b.c"
 * @param {any} value
 */
function setByPath(root, path, value) {
  if (!isObject(root)) return;
  const parts = String(path || "").split(".").filter(Boolean);
  if (parts.length === 0) return;

  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!isObject(cur[k])) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Simple Patch-Operationen.
 * op = "set" (default) | "merge"
 */
function applyUpdate({ state, path, value, op }) {
  const mode = op || "set";

  if (mode === "merge") {
    // Merge in Zielobjekt (oder ersetzt, wenn nicht-objekt)
    const parts = String(path || "").split(".").filter(Boolean);
    if (parts.length === 0) return;

    let cur = state;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!isObject(cur[k])) cur[k] = {};
      cur = cur[k];
    }
    const leaf = parts[parts.length - 1];
    if (isObject(cur[leaf]) && isObject(value)) cur[leaf] = { ...cur[leaf], ...value };
    else cur[leaf] = value;
    return;
  }

  // Default: set
  setByPath(state, path, value);
}

/* --------------------------------------------
 * Store
 * -------------------------------------------- */

export function createStore({ bus = null } = {}) {
  /** @type {Map<string, any>} */
  const states = new Map();

  function has(key) {
    return states.has(key);
  }

  function get(key) {
    return states.get(key);
  }

  function set(key, nextState) {
    states.set(key, nextState);
    if (bus) bus.emit("cb:store:changed", { key, state: nextState });
  }

  function init(key, initialState) {
    if (states.has(key)) return;
    states.set(key, deepClone(initialState));
    if (bus) bus.emit("cb:store:inited", { key, state: states.get(key) });
  }

  function update(key, fn) {
    const prev = states.get(key);
    const draft = deepClone(prev);
    fn(draft);
    states.set(key, draft);
    if (bus) bus.emit("cb:store:changed", { key, state: draft });
  }

  function updatePath(key, { path, value, op } = {}) {
    update(key, (draft) => {
      applyUpdate({ state: draft, path, value, op });
    });
  }

  function snapshot() {
    const obj = {};
    for (const [k, v] of states.entries()) obj[k] = deepClone(v);
    return obj;
  }

  /* ------------------------------------------
   * Bus Commands Wiring
   * ------------------------------------------ */
  function wireBusCommands() {
    if (!bus) return;

    // Project updates
    bus.on("req:project:update", ({ path, value, op } = {}) => {
      updatePath("project", { path, value, op });
      if (bus) bus.emit("cb:project:changed", { path, value, op: op || "set", state: get("project") });
    });

    // UI updates
    bus.on("req:ui:update", ({ path, value, op } = {}) => {
      updatePath("ui", { path, value, op });
      if (bus) bus.emit("cb:ui:changed", { path, value, op: op || "set", state: get("ui") });
    });
  }

  // Direkt beim Erstellen aktivieren (wenn bus vorhanden)
  wireBusCommands();

  return { has, get, set, init, update, updatePath, snapshot };
}
