/**
 * core/project-sync.js
 * Version: v1.0.0 (2026-02-15)
 *
 * Eine Richtung:
 * - app.project -> project
 * Damit es KEINE Divergenz gibt.
 */

import { normalizeProject } from "./project-normalize.js";

export function syncProjectRoot(state) {
  if (!state || !state.app) return state;

  // ensure project exists + normalized
  state.app.project = normalizeProject(state.app.project);

  // Spiegel (read-only gedacht)
  state.project = state.app.project;

  return state;
}
