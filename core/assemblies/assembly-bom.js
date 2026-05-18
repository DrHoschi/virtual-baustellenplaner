/*
 * ============================================================================
 * DATEI: core/assemblies/assembly-bom.js
 * VERSION: v1.0.0-configurable-assemblies
 *
 * ZWECK:
 * - Erzeugt Stücklisten aus Assembly-Instanzen.
 * - Fasst gleiche Artikel zusammen.
 * ============================================================================
 */

function keyForComponent(component) {
  return [
    component.articleNo || "",
    component.manufacturer || "",
    component.label || component.id || "",
    component.unit || "Stk"
  ].join("|");
}

export function buildBomFromAssemblyInstance(instance) {
  const components = Array.isArray(instance?.components) ? instance.components : [];
  const lines = new Map();

  for (const component of components) {
    if (component.bom === false) continue;
    const key = keyForComponent(component);
    const qty = Number.isFinite(Number(component.qty)) ? Number(component.qty) : 1;

    if (!lines.has(key)) {
      lines.set(key, {
        articleNo: component.articleNo || "",
        manufacturer: component.manufacturer || "",
        label: component.label || component.id || "Unbekannt",
        unit: component.unit || "Stk",
        qty: 0,
        sourceInstances: []
      });
    }

    const line = lines.get(key);
    line.qty += qty;
    line.sourceInstances.push(instance.id);
  }

  return Array.from(lines.values());
}

export function buildBomFromAssemblyInstances(instances) {
  const globalLines = new Map();
  const list = Array.isArray(instances) ? instances : [];

  for (const instance of list) {
    for (const line of buildBomFromAssemblyInstance(instance)) {
      const key = [line.articleNo, line.manufacturer, line.label, line.unit].join("|");
      if (!globalLines.has(key)) {
        globalLines.set(key, { ...line, sourceInstances: [] });
      }
      const target = globalLines.get(key);
      target.qty += line.qty;
      target.sourceInstances.push(...line.sourceInstances);
    }
  }

  return Array.from(globalLines.values());
}
