/**
 * core/project-sync.js
 * Version: v1.0.0-lifecycle-sync (2026-02-15)
 *
 * Ziel:
 * - Wir haben historisch 2 Project-Wurzeln im State gesehen:
 *   - state.project
 *   - state.app.project
 *
 * Das führt zu "Ghost Bugs": UI zeigt A, Persist speichert B.
 *
 * Regel (eine Richtung):
 * - app.project ist Source-of-Truth.
 * - state.project ist nur ein Mirror (Komfort für alte Panels).
 */

function isObj(x) {
  return !!x && typeof x === "object";
}

/**
 * syncProjectRoot(state)
 * - sorgt dafür, dass state.project und state.app.project immer gleich sind (eine Richtung!)
 * - mutiert state (gezielt, weil es ein Lifecycle-Utility ist)
 */
export function syncProjectRoot(state) {
  if (!isObj(state)) return state;
  if (!isObj(state.app)) state.app = {};

  // Wenn app.project fehlt, aber state.project existiert, übernehmen wir einmalig.
  // Danach gilt: app.project -> state.project.
  if (!isObj(state.app.project) && isObj(state.project)) {
    state.app.project = state.project;
  }

  // Mirror
  if (isObj(state.app.project)) {
    state.project = state.app.project;
  }

  return state;
}
