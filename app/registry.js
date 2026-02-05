/**
 * Baustellenplaner – Minimal Registry
 * Datei: app/registry.js
 * Version: v1.0.0 (2026-02-03)
 *
 * Ziel:
 * - Module registrieren (Manifest + init-Callback)
 * - Dependencies prüfen (minimal)
 * - UI kann Menüpunkte rein datengetrieben bauen (aus Manifest)
 *
 * Hinweis:
 * - Diese Registry ist bewusst "leicht". In deinem anderen Chat hattet ihr evtl.
 *   schon eine Registry/Registration-Datei, aber hier ist es:
 *   (a) generisch, (b) UI-fokussiert (Menü-Auslesung), (c) initAll mit Context.
 */

export function createRegistry() {
  /** @type {Map<string, any>} */
  const modules = new Map(); // key -> { manifest, init(ctx), api? }

  function registerModule({ manifest, init }) {
    if (!manifest || !manifest.key) throw new Error("registerModule: manifest.key fehlt");
    const key = manifest.key;
    if (modules.has(key)) throw new Error(`registerModule: Modul bereits registriert: ${key}`);
    modules.set(key, { manifest, init: init || null, isInited: false });
  }

  function getModule(key) {
    return modules.get(key) || null;
  }

  function getManifests() {
    return [...modules.values()].map((m) => m.manifest);
  }

  function _resolveOrder(activeKeys) {
    // Topologische Sortierung (sehr klein gehalten)
    const result = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(k) {
      if (visited.has(k)) return;
      if (visiting.has(k)) throw new Error(`Dependency cycle detected at "${k}"`);
      visiting.add(k);

      const entry = modules.get(k);
      if (!entry) throw new Error(`Aktives Modul "${k}" ist nicht registriert.`);
      const deps = (entry.manifest.dependencies || []).filter((d) => activeKeys.includes(d));
      deps.forEach(visit);

      visiting.delete(k);
      visited.add(k);
      result.push(k);
    }

    activeKeys.forEach(visit);
    return result;
  }

  function initAll({ activeModuleKeys, ctx }) {
    const order = _resolveOrder(activeModuleKeys);

    order.forEach((k) => {
      const entry = modules.get(k);
      if (!entry) return;
      if (entry.isInited) return;

      if (typeof entry.init === "function") {
        entry.init(ctx);
      }
      entry.isInited = true;
    });

    return order;
  }

  function computeMenuModel({ uiConfig, activeModuleKeys }) {
    // Liefert eine strukturierte Liste: Gruppen -> Items
    const groups = (uiConfig?.groups || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const groupMap = new Map(groups.map((g) => [g.key, { ...g, items: [] }]));

    activeModuleKeys.forEach((key) => {
      const entry = modules.get(key);
      if (!entry) return;
      const m = entry.manifest;
      const menu = m.menu || null;
      if (!menu) return;

      const gKey = menu.group || "tools";
      const target = groupMap.get(gKey) || groupMap.get("tools");
      if (!target) return;

      target.items.push({
        moduleKey: m.key,
        label: m.label || m.key,
        icon: menu.icon || null,
        order: menu.order ?? 999
      });
    });

    // Items sortieren
    for (const g of groupMap.values()) {
      g.items.sort((a, b) => (a.order || 0) - (b.order || 0) || a.label.localeCompare(b.label));
    }

    return groups.map((g) => groupMap.get(g.key)).filter(Boolean);
  }

  return { registerModule, getModule, getManifests, initAll, computeMenuModel };
}
