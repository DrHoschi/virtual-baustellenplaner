/**
 * Baustellenplaner – Manifest-Pack Loader (minimal)
 * Datei: core/manifest-pack.js
 * Version: v1.0.0 (2026-02-08)
 *
 * Ziel:
 * - Lädt ein manifest-pack.json (oder andere URL) und die darin gelisteten Plugin-Manifeste.
 * - Robust gegen fehlende Felder, liefert IMMER ein Ergebnisobjekt zurück.
 *
 * Erwartetes Format:
 * {
 *   "plugins": ["plugins/foo/manifest.json", "plugins/bar/manifest.json"]
 * }
 */

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`loadJson: ${res.status} ${res.statusText} (${url})`);
  return await res.json();
}

export async function loadManifestPack(packUrl = "manifest-pack.json") {
  const pack = await loadJson(packUrl);

  const pluginPaths = Array.isArray(pack?.plugins) ? pack.plugins : [];
  const manifests = [];

  for (const p of pluginPaths) {
    try {
      manifests.push(await loadJson(p));
    } catch (e) {
      // Wir brechen nicht ab – ein Plugin darf kaputt sein, ohne die App zu killen.
      console.warn("[manifest-pack] plugin manifest failed:", p, e);
    }
  }

  return { pack, manifests };
}

export default { loadManifestPack };
