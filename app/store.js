/**
 * Baustellenplaner – Minimal Store
 * Datei: app/store.js
 * Version: v1.0.0 (2026-02-03)
 *
 * Ziel:
 * - State pro Modul-Key (z.B. "layout", "core")
 * - Optional: Change-Events über Bus (wenn Bus übergeben)
 * - Sehr bewusst simpel gehalten (kein Redux, keine Magie)
 *
 * Wichtige Design-Entscheidung:
 * - Store speichert Plain-Objects
 * - set() ersetzt den State vollständig (klarer Datenfluss)
 * - update() für bequeme Mutation (intern kopiert)
 */

function deepClone(obj) {
  // Für Blueprint absolut ausreichend (Plain JSON Strukturen)
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

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

  function snapshot() {
    const obj = {};
    for (const [k, v] of states.entries()) obj[k] = deepClone(v);
    return obj;
  }

  return { has, get, set, init, update, snapshot };
}
