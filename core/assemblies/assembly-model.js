/*
 * ============================================================================
 * DATEI: core/assemblies/assembly-model.js
 * VERSION: v1.0.0-configurable-assemblies
 * STAND: 2026-05-18
 *
 * ZWECK:
 * - Gemeinsames Datenmodell für konfigurierbare Baugruppen.
 * - Erzeugt konkrete Instanzen aus Master-Templates.
 * - Normalisiert Varianten, Komponenten und Ports.
 *
 * WICHTIG:
 * - Diese Datei ist bewusst unabhängig von der UI.
 * - Sie darf später von WorkareaPanel, ProjectAssetsPanel oder einem
 *   separaten AssemblyPanel importiert werden.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

export const ASSEMBLY_SCHEMA = "baustellenplaner.assembly.v1";
export const ASSEMBLY_INSTANCE_TYPE = "assembly.instance";

// ---------------------------------------------------------------------------
// Kleine Hilfsfunktionen
// ---------------------------------------------------------------------------

function nowIso() {
  return new Date().toISOString();
}

function safeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function uniqueId(prefix = "asm") {
  const a = Date.now().toString(36);
  const b = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${a}-${b}`;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Template-Normalisierung
// ---------------------------------------------------------------------------

export function normalizeAssemblyTemplate(raw) {
  const tpl = raw && typeof raw === "object" ? raw : {};

  const id = safeString(tpl.id);
  if (!id) {
    throw new Error("Assembly template has no id.");
  }

  const components = Array.isArray(tpl.components) ? tpl.components : [];
  const ports = Array.isArray(tpl.ports) ? tpl.ports : [];
  const variants = Array.isArray(tpl.variants) ? tpl.variants : [];

  return {
    schema: safeString(tpl.schema, ASSEMBLY_SCHEMA),
    id,
    family: safeString(tpl.family, "unknown"),
    label: safeString(tpl.label, id),
    description: safeString(tpl.description, ""),
    defaultVariantId: safeString(tpl.defaultVariantId, variants[0]?.id || ""),
    defaultSize: {
      width: safeNumber(tpl.defaultSize?.width, 1),
      height: safeNumber(tpl.defaultSize?.height, 1),
      depth: safeNumber(tpl.defaultSize?.depth, 0.5)
    },
    parameters: cloneJson(tpl.parameters || {}),
    components: components.map(normalizeAssemblyComponent),
    ports: ports.map(normalizeAssemblyPort),
    variants: variants.map(normalizeAssemblyVariant),
    bomRules: cloneJson(tpl.bomRules || {}),
    meta: cloneJson(tpl.meta || {})
  };
}

export function normalizeAssemblyComponent(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const id = safeString(c.id);
  if (!id) {
    throw new Error("Assembly component has no id.");
  }

  return {
    id,
    label: safeString(c.label, id),
    kind: safeString(c.kind, "generic"),
    qty: safeNumber(c.qty, 1),
    unit: safeString(c.unit, "Stk"),
    articleNo: safeString(c.articleNo, ""),
    manufacturer: safeString(c.manufacturer, ""),
    bom: c.bom !== false,
    tags: Array.isArray(c.tags) ? c.tags.slice() : [],
    position: {
      x: safeNumber(c.position?.x, 0),
      y: safeNumber(c.position?.y, 0),
      z: safeNumber(c.position?.z, 0),
      rotation: safeNumber(c.position?.rotation, 0)
    },
    data: cloneJson(c.data || {})
  };
}

export function normalizeAssemblyPort(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const id = safeString(p.id);
  if (!id) {
    throw new Error("Assembly port has no id.");
  }

  return {
    id,
    label: safeString(p.label, id),
    kind: safeString(p.kind, "generic"),
    direction: safeString(p.direction, "inout"),
    componentId: safeString(p.componentId, ""),
    voltage: safeString(p.voltage, ""),
    signal: safeString(p.signal, ""),
    cableHint: safeString(p.cableHint, ""),
    position: {
      x: safeNumber(p.position?.x, 0),
      y: safeNumber(p.position?.y, 0),
      z: safeNumber(p.position?.z, 0)
    },
    data: cloneJson(p.data || {})
  };
}

export function normalizeAssemblyVariant(raw) {
  const v = raw && typeof raw === "object" ? raw : {};
  const id = safeString(v.id);
  if (!id) {
    throw new Error("Assembly variant has no id.");
  }

  return {
    id,
    label: safeString(v.label, id),
    description: safeString(v.description, ""),
    enabledComponents: Array.isArray(v.enabledComponents) ? v.enabledComponents.slice() : [],
    enabledPorts: Array.isArray(v.enabledPorts) ? v.enabledPorts.slice() : [],
    overrides: cloneJson(v.overrides || {}),
    tags: Array.isArray(v.tags) ? v.tags.slice() : []
  };
}

// ---------------------------------------------------------------------------
// Instanz-Erzeugung
// ---------------------------------------------------------------------------

export function createAssemblyInstance(template, options = {}) {
  const tpl = normalizeAssemblyTemplate(template);
  const variantId = safeString(options.variantId, tpl.defaultVariantId);
  const variant = findVariant(tpl, variantId) || tpl.variants[0];

  if (!variant) {
    throw new Error(`Assembly template '${tpl.id}' has no usable variant.`);
  }

  const instanceId = safeString(options.id, uniqueId("asm"));
  const name = safeString(options.name, tpl.label);

  return {
    schema: ASSEMBLY_SCHEMA,
    type: ASSEMBLY_INSTANCE_TYPE,
    id: instanceId,
    templateId: tpl.id,
    templateFamily: tpl.family,
    templateLabel: tpl.label,
    variantId: variant.id,
    variantLabel: variant.label,
    name,
    x: safeNumber(options.x, 0),
    y: safeNumber(options.y, 0),
    z: safeNumber(options.z, 0),
    rotation: safeNumber(options.rotation, 0),
    scale: safeNumber(options.scale, 1),
    size: cloneJson(options.size || tpl.defaultSize),
    parameters: {
      ...cloneJson(tpl.parameters || {}),
      ...cloneJson(options.parameters || {})
    },
    technical: {
      area: safeString(options.area, ""),
      group: safeString(options.group, ""),
      cabinet: safeString(options.cabinet, ""),
      equipmentTag: safeString(options.equipmentTag, "")
    },
    components: getActiveComponents(tpl, variant.id),
    ports: getActivePorts(tpl, variant.id),
    connections: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    meta: cloneJson(options.meta || {})
  };
}

export function findVariant(template, variantId) {
  const id = safeString(variantId);
  return (template.variants || []).find((v) => v.id === id) || null;
}

export function getActiveComponents(template, variantId) {
  const tpl = normalizeAssemblyTemplate(template);
  const variant = findVariant(tpl, variantId) || tpl.variants[0];
  const enabled = new Set(variant?.enabledComponents || []);
  return tpl.components.filter((c) => enabled.has(c.id)).map(cloneJson);
}

export function getActivePorts(template, variantId) {
  const tpl = normalizeAssemblyTemplate(template);
  const variant = findVariant(tpl, variantId) || tpl.variants[0];
  const enabledPorts = new Set(variant?.enabledPorts || []);
  const enabledComponents = new Set(variant?.enabledComponents || []);

  return tpl.ports
    .filter((p) => {
      if (enabledPorts.has(p.id)) return true;
      if (p.componentId && enabledComponents.has(p.componentId)) return true;
      return false;
    })
    .map(cloneJson);
}

export function switchAssemblyVariant(instance, template, nextVariantId) {
  const tpl = normalizeAssemblyTemplate(template);
  const variant = findVariant(tpl, nextVariantId);
  if (!variant) {
    throw new Error(`Unknown variant '${nextVariantId}' for template '${tpl.id}'.`);
  }

  return {
    ...cloneJson(instance),
    variantId: variant.id,
    variantLabel: variant.label,
    components: getActiveComponents(tpl, variant.id),
    ports: getActivePorts(tpl, variant.id),
    updatedAt: nowIso()
  };
}
