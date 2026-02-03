/**
 * loader.js
 * Registry -> FeatureGate -> UI Registration (Pseudocode/Template, 1:1 implementierbar)
 *
 * Erwartete Eingaben:
 *  - menu.registry.json (entries)
 *  - manifest-pack.json (Liste der Plugin-Manifeste)
 *  - projectJson (aktuelles Projekt)
 *
 * Dieses Template geht bewusst NICHT von einem konkreten UI-Framework aus.
 * Du musst nur die 'ui.registerTab(...)' / 'ui.registerTopbar(...)' Funktionen an dein System anbinden.
 */

import { createFeatureGate } from "./featureGate.js";

/** Minimaler Loader: liest JSON-Datei via fetch */
async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.json();
}

/**
 * Lädt Plugin-Manifeste aus dem Pack.
 * Hinweis: Du kannst hier später auch dynamische Plugins nachladen.
 */
export async function loadPluginManifests(packUrl) {
  const pack = await loadJson(packUrl);
  const manifests = [];
  for (const relPath of pack.plugins) {
    manifests.push(await loadJson(relPath));
  }
  return { pack, manifests };
}

/**
 * Baut eine Lookup-Map manifestId -> manifest
 * Wir verwenden pluginId als manifestId (gleiches Feld).
 */
function indexManifests(manifests) {
  const map = new Map();
  for (const m of manifests) map.set(m.pluginId, m);
  return map;
}

/**
 * DEV-Max: registriert alles, ignoriert requires.
 * Release: prüft requires via FeatureGate.
 */
function shouldRegisterEntry({ appMode, gate, requires }) {
  if (appMode === "dev") return true;
  if (!requires || requires.length === 0) return true;
  return requires.every((rk) => gate.can(rk));
}

/**
 * Hauptfunktion: Registry + Manifeste + FeatureGate -> UI
 */
export async function bootstrapMenuSystem({
  appMode = "dev",
  projectJson,
  registryUrl = "menu.registry.json",
  packUrl = "manifest-pack.json",
  ui
}) {
  const registry = await loadJson(registryUrl);
  const { manifests } = await loadPluginManifests(packUrl);
  const manifestMap = indexManifests(manifests);

  const gate = createFeatureGate({ appMode, projectJson });

  // 1) Topbar-Einträge aus Registry (rein navigativ)
  const topbar = registry.entries
    .filter((e) => e.anchor === "topbar")
    .sort((a, b) => a.order - b.order);

  for (const e of topbar) {
    // Topbar-Entries haben i.d.R. kein Manifest (kannst du später auch als Plugin machen)
    ui.registerTopbar({
      id: e.manifestId,
      title: e.title,
      tabId: e.tabId,
      order: e.order
    });
  }

  // 2) ProjectPanel Tabs via Plugin-Manifeste (weil dort Settings + UI-Logik hängen)
  const panelEntries = registry.entries
    .filter((e) => e.anchor === "projectPanel")
    .sort((a, b) => a.order - b.order);

  for (const e of panelEntries) {
    const manifest = manifestMap.get(e.manifestId);

    // Falls du nicht zu jedem Registry-Eintrag ein Manifest hast, kannst du hier fallbacken.
    if (!manifest) {
      ui.registerTab({
        anchor: "projectPanel",
        tabId: e.tabId,
        title: e.title,
        order: e.order,
        settingsPath: e.settingsPath,
        render: () => ui.renderPlaceholder(`Fehlendes Manifest: ${e.manifestId}`)
      });
      continue;
    }

    const entry = manifest.ui.menuEntries.find((me) => me.anchor === "projectPanel" && me.tabId === e.tabId) || manifest.ui.menuEntries[0];
    const requires = entry?.requires || [];

    const allowed = shouldRegisterEntry({ appMode, gate, requires });

    // Defaults sicherstellen (lazy merge):
    ui.ensureDefaults({
      projectJson,
      settingsPath: manifest.settings.path,
      defaults: manifest.settings.defaults
    });

    ui.registerTab({
      anchor: "projectPanel",
      tabId: entry.tabId,
      title: entry.title,
      icon: entry.icon || null,
      order: entry.order ?? e.order,
      settingsPath: manifest.settings.path,
      allowed,
      requires,
      render: (ctx) => {
        // Hier würdest du dein echtes Tab-UI rendern
        // ctx.projectJson, ctx.settings, ctx.updateSettings, ...
        ui.renderPlaceholder(`${entry.title} (Template)`);
      }
    });
  }

  ui.finalize();
  return { registry, manifests, gate };
}
