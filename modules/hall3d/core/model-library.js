/**
 * modules/hall3d/core/model-library.js
 * Version: v1.1.0 (2026-02-04)
 *
 * Änderung: fetch-Pfade robust über import.meta.url (damit Module in Unterordnern laufen).
 */

let cache = null;

function _url(rel) {
  return new URL(rel, import.meta.url).toString();
}

export async function loadLibraries() {
  if (cache) return cache;

  const [models, presets] = await Promise.all([
    fetch(_url("../data/library.models.json")).then((r) => r.json()),
    fetch(_url("../data/presets.halls.json")).then((r) => r.json())
  ]);

  cache = { models, presets };
  return cache;
}
