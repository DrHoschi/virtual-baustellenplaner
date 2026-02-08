/**
 * core/manifest-pack.js
 * Version: v1.0.0 (2026-02-08)
 *
 * Hintergrund:
 * - Einige Stände importieren in core/loader.js "./manifest-pack.js"
 * - Tatsächlich liegt der Pack als "manifest-pack.json" im Projekt-Root.
 *
 * Dieses Modul stellt eine kleine Helper-Funktion bereit.
 */
export async function loadManifestPack({ url = "./manifest-pack.json" } = {}) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest-pack: HTTP ${res.status} (${url})`);
  const json = await res.json();
  if (!json || !Array.isArray(json.plugins)) {
    throw new Error("manifest-pack: Ungültige Struktur (plugins[] fehlt)");
  }
  return json;
}
